import * as cheerio from 'cheerio';
import { z } from 'zod';
import { logExtractRequest } from '../../observability/requestLogger.js';
import { ExtractError } from '../../types/errors.js';
import { generateRequestId, generateTraceId } from '../../types/utils.js';
import { ExtractRequestSchema, ExtractResponseSchema, type ExtractResponse } from '../../types/schemas.js';

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\./, '');
}

function isDomainAllowed(targetHost: string, allowDomains: string[], denyDomains: string[]): boolean {
  const host = normalizeDomain(targetHost);
  const denied = denyDomains.map(normalizeDomain).some((d) => host === d || (host.length > d.length && host.endsWith(`.${d}`)));
  if (denied) return false;

  if (allowDomains.length === 0) return true;
  return allowDomains.map(normalizeDomain).some((a) => host === a || (host.length > a.length && host.endsWith(`.${a}`)));
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function htmlToMarkdownLite(html: string): string {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  return `${title ? `# ${title}\n\n` : ''}${bodyText}`.trim();
}

// Simple confidence scoring based on content quality
function calculateConfidence(html: string, text: string): number {
  const hasTitle = /<title>[^<]+<\/title>/i.test(html);
  const hasMetaDesc = /<meta[^>]+name="description"[^>]*>/i.test(html);
  const hasContent = text.length > 100;
  const hasLinks = /<a[^>]+href/i.test(html);
  
  let score = 0.5;
  if (hasTitle) score += 0.15;
  if (hasMetaDesc) score += 0.15;
  if (hasContent) score += 0.1;
  if (hasLinks) score += 0.1;
  
  return Math.min(1, Math.max(0, score));
}

// Simple source quality based on HTTP status
function calculateSourceQuality(status: number): number {
  if (status >= 200 && status < 300) return 0.95;
  if (status >= 300 && status < 400) return 0.8;
  if (status >= 400 && status < 500) return 0.5;
  return 0.3;
}

async function fetchWithRetry(url: string, options: { timeoutMs: number; retryMax: number; userAgent: string }) {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= options.retryMax; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), options.timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'user-agent': options.userAgent,
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new ExtractError('FETCH_HTTP_ERROR', `HTTP ${res.status} on ${url}`, res.status >= 500, {
          url,
          status: res.status,
        });
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < options.retryMax) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  if (lastErr instanceof ExtractError) throw lastErr;
  if (lastErr instanceof Error && lastErr.name === 'AbortError') {
    throw new ExtractError('FETCH_TIMEOUT', `Timeout while fetching ${url}`, true, { url, timeoutMs: options.timeoutMs });
  }
  throw new ExtractError('INTERNAL_ERROR', `Failed to fetch ${url}`, true, { url });
}

type ExtractRequestInput = z.input<typeof ExtractRequestSchema>;

export async function extract(request: ExtractRequestInput): Promise<ExtractResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const started = Date.now();

  try {
    const input = ExtractRequestSchema.parse(request);
    const documents = [] as ExtractResponse['data']['documents'];

    for (const url of input.urls) {
      const parsed = new URL(url);
      if (!isDomainAllowed(parsed.hostname, input.allowDomains, input.denyDomains)) {
        throw new ExtractError('DOMAIN_POLICY_DENIED', `Domain denied by policy: ${parsed.hostname}`, false, {
          url,
          host: parsed.hostname,
        });
      }

      const res = await fetchWithRetry(url, {
        timeoutMs: input.timeoutMs,
        retryMax: input.retryMax,
        userAgent: input.userAgent,
      });
      const html = await res.text();

      let $: cheerio.CheerioAPI;
      try {
        $ = cheerio.load(html);
      } catch {
        throw new ExtractError('PARSE_ERROR', `Unable to parse HTML from ${url}`, false, { url });
      }

      const text = htmlToText(html);
      const markdown = htmlToMarkdownLite(html);
      const confidence = calculateConfidence(html, text);
      const sourceQuality = calculateSourceQuality(res.status);

      const links = input.includeLinks
        ? $('a[href]')
            .map((_, el) => $(el).attr('href'))
            .get()
            .filter((v): v is string => !!v)
            .map((href) => {
              try {
                return new URL(href, res.url).toString();
              } catch {
                return null;
              }
            })
            .filter((v): v is string => !!v)
        : [];

      const title = $('title').first().text().trim() || undefined;
      const canonicalRaw = $('link[rel="canonical"]').attr('href');
      let canonical: string | undefined;
      if (canonicalRaw) {
        try {
          canonical = new URL(canonicalRaw, res.url).toString();
        } catch {
          canonical = undefined;
        }
      }

      documents.push({
        url,
        finalUrl: res.url,
        title,
        markdown,
        text,
        html: input.includeHtml ? html : null,
        links,
        metadata: {
          title,
          description: $('meta[name="description"]').attr('content') || undefined,
          canonical,
          language: $('html').attr('lang') || undefined,
          statusCode: res.status,
          contentType: res.headers.get('content-type') || undefined,
        },
        structured: {},
        confidence,
        sourceQuality,
        untrusted: true,
        extractedAt: new Date().toISOString(),
      });
    }

    const output: ExtractResponse = {
      success: true,
      data: { documents },
      meta: {
        requestId,
        traceId,
        cached: false,
        tookMs: Date.now() - started,
        schemaVersion: 'v1',
      },
    };

    // Validate against schema
    ExtractResponseSchema.parse(output);

    await logExtractRequest({
      requestId,
      urlCount: output.data.documents.length,
      status: 'ok',
      tookMs: Date.now() - started,
    });

    return output;
  } catch (err) {
    const known = err instanceof ExtractError
      ? err
      : new ExtractError('VALIDATION_ERROR', (err as Error).message || 'Invalid request', false);

    await logExtractRequest({
      requestId,
      urlCount: Array.isArray((request as { urls?: unknown }).urls) ? (request as { urls: unknown[] }).urls.length : 0,
      status: 'error',
      tookMs: Date.now() - started,
      errorCode: known.code,
      errorMessage: known.message,
    });

    throw known;
  }
}
