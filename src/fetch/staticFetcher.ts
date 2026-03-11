import { ProxyAgent } from 'undici';
import { ExtractError } from '../types/errors.js';
import { getEvasionManager } from '../anti-bot/evasion.js';
import { buildFetchPolicy, getOutcome } from './policy.js';
import { getSessionStore } from '../anti-bot/sessionStore.js';
import { handleChallenge } from '../anti-bot/challenge.js';
import { recordDomainOutcome } from '../observability/metrics.js';
import { getDomainFromUrl } from '../observability/trace.js';

export interface StaticFetchRequest {
  url: string;
  timeoutMs: number;
  retryMax: number;
  userAgent: string;
  proxyUrl?: string;
  conditional?: {
    etag?: string;
    lastModified?: string;
    previousResult?: StaticFetchResult;
  };
}

export interface StaticFetchResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType?: string;
  html: string;
  fetchedAt: string;
  headers: Record<string, string>;
  via?: 'static' | 'browser';
  cacheValidation?: {
    revalidated: boolean;
    notModified: boolean;
    etag?: string;
    lastModified?: string;
  };
}

function extractValidators(headers: Record<string, string>): { etag?: string; lastModified?: string } {
  return {
    etag: headers.etag,
    lastModified: headers['last-modified'],
  };
}

function buildRequestHeaders(request: StaticFetchRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': request.userAgent,
  };

  if (request.conditional?.etag) {
    headers['if-none-match'] = request.conditional.etag;
  }

  if (request.conditional?.lastModified) {
    headers['if-modified-since'] = request.conditional.lastModified;
  }

  return headers;
}

export async function staticFetch(request: StaticFetchRequest): Promise<StaticFetchResult> {
  let lastErr: unknown;
  const evasion = getEvasionManager();
  const sessionStore = getSessionStore();

  for (let attempt = 0; attempt <= request.retryMax; attempt += 1) {
    if (evasion) {
      await evasion.delay();
    }
    const ctrl = new AbortController();
    const policy = buildFetchPolicy({ ...request, strategy: 'static' });
    const timer = setTimeout(() => ctrl.abort(), policy.timeoutMs);

    // Get evasion headers if enabled
    let evasionHeaders: Record<string, string> = {};
    if (evasion) {
      evasionHeaders = evasion.getHeaders();
    }

    const fetchOptions: RequestInit = {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        ...buildRequestHeaders(request),
        ...evasionHeaders,
        ...(policy.cookieHeader ? { cookie: policy.cookieHeader } : {}),
      },
      // @ts-expect-error - dispatcher is undici-specific
      dispatcher: policy.proxyUrl ? new ProxyAgent(policy.proxyUrl) : undefined,
    };

    try {
      const startTime = Date.now();
      const res = await fetch(request.url, fetchOptions);
      const latency = Date.now() - startTime;
      clearTimeout(timer);

      // Report proxy result if used
      if (policy.proxy) {
        const pool = (await import('../proxy/pool.js')).getProxyPool();
        if (pool) {
          pool.reportResult(policy.proxy.id, res.ok, latency);
        }
      }

      // Check for blocking if evasion is enabled
      if (evasion) {
        const analysis = evasion.analyzeResponse(res.status, Object.fromEntries(res.headers.entries()));
        if (analysis.blocked) {
          throw new ExtractError('ANTI_BOT_BLOCKED', analysis.reason || 'Blocked by anti-bot', true, {
            url: request.url,
            status: res.status,
          });
        }
      }

      const responseHeaders = Object.fromEntries(res.headers.entries());
      sessionStore?.updateFromResponse(
        request.url,
        typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
      );
      const validators = extractValidators(responseHeaders);
      const bodyForChallenge = res.status >= 400 ? await res.clone().text() : undefined;

      await handleChallenge({
        url: request.url,
        statusCode: res.status,
        headers: responseHeaders,
        body: bodyForChallenge,
      });

      if (res.status === 403 || res.status === 429) {
        throw new ExtractError('ANTI_BOT_BLOCKED', `Blocked by anti-bot or rate limiting: ${res.status}`, true, {
          url: request.url,
          status: res.status,
        });
      }

      if (res.status === 304) {
        const previous = request.conditional?.previousResult;
        if (!previous) {
          throw new ExtractError('INTERNAL_ERROR', `Received 304 but no previous cache snapshot for ${request.url}`, false, {
            url: request.url,
          });
        }

        return {
          ...previous,
          fetchedAt: new Date().toISOString(),
          headers: { ...previous.headers, ...responseHeaders },
          via: 'static',
          cacheValidation: {
            revalidated: true,
            notModified: true,
            ...validators,
          },
        };
      }

      if (!res.ok) {
        throw new ExtractError('FETCH_HTTP_ERROR', `HTTP ${res.status} on ${request.url}`, res.status >= 500, {
          url: request.url,
          status: res.status,
        });
      }

      const html = await res.text();
      recordDomainOutcome({
        domain: getDomainFromUrl(request.url),
        latencyMs: latency,
        success: true,
      });
      return {
        requestedUrl: request.url,
        finalUrl: res.url,
        statusCode: res.status,
        contentType: res.headers.get('content-type') || undefined,
        html,
        fetchedAt: new Date().toISOString(),
        headers: responseHeaders,
        via: 'static',
        cacheValidation: {
          revalidated: Boolean(request.conditional?.etag || request.conditional?.lastModified),
          notModified: false,
          ...validators,
        },
      };
    } catch (err) {
      clearTimeout(timer);
      if (policy.proxy) {
        const pool = (await import('../proxy/pool.js')).getProxyPool();
        if (pool) {
          pool.reportResult(policy.proxy.id, false, policy.timeoutMs);
        }
      }
      recordDomainOutcome({
        domain: getDomainFromUrl(request.url),
        blocked: err instanceof ExtractError && err.code === 'ANTI_BOT_BLOCKED',
      });
      lastErr = err;
      if (attempt < request.retryMax) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  if (lastErr instanceof ExtractError) throw lastErr;
  if (lastErr instanceof Error && lastErr.name === 'AbortError') {
    throw new ExtractError('FETCH_TIMEOUT', `Timeout while fetching ${request.url}`, true, {
      url: request.url,
      timeoutMs: request.timeoutMs,
      outcome: getOutcome(false, 'static'),
    });
  }

  throw new ExtractError('INTERNAL_ERROR', `Failed to fetch ${request.url}`, true, { url: request.url });
}
