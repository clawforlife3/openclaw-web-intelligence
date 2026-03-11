import { z } from 'zod';
import { RequestCache } from '../../cache/requestCache.js';
import { PageCache } from '../../cache/pageCache.js';
import { browserFetch } from '../../fetch/browserFetcher.js';
import { fetchWithRouter } from '../../fetch/fetchWithRouter.js';
import { extractDocument, evaluateBrowserRetry } from '../../extract/extractPipeline.js';
import { logExtractRequest } from '../../observability/requestLogger.js';
import { getPreferredStrategy, recordFetchOutcome } from '../retry/hostPolicyMemory.js';
import { ExtractError } from '../../types/errors.js';
import { generateRequestId, generateTraceId } from '../../types/utils.js';
import { ExtractRequestSchema, ExtractResponseSchema, type ExtractResponse, type RetryReason } from '../../types/schemas.js';

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

type ExtractRequestInput = z.input<typeof ExtractRequestSchema>;

export async function extract(request: ExtractRequestInput): Promise<ExtractResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const started = Date.now();

  try {
    const input = ExtractRequestSchema.parse(request);
    const requestCache = new RequestCache<ExtractResponse>('extract', { enabled: input.cacheTtlSeconds > 0, ttlSeconds: input.cacheTtlSeconds });
    const pageCache = new PageCache({ enabled: input.cacheTtlSeconds > 0, ttlSeconds: input.cacheTtlSeconds });

    const cached = requestCache.get(input as unknown as Record<string, unknown>);
    if (cached) {
      return {
        ...cached,
        meta: {
          schemaVersion: cached.meta?.schemaVersion ?? 'v1',
          ...cached.meta,
          requestId,
          traceId,
          cached: true,
          tookMs: Date.now() - started,
        },
      };
    }

    const documents = [] as ExtractResponse['data']['documents'];

    for (const url of input.urls) {
      const parsed = new URL(url);
      if (!isDomainAllowed(parsed.hostname, input.allowDomains, input.denyDomains)) {
        throw new ExtractError('DOMAIN_POLICY_DENIED', `Domain denied by policy: ${parsed.hostname}`, false, {
          url,
          host: parsed.hostname,
        });
      }

      const cachedPage = pageCache.get(url);
      let fetchResult = cachedPage?.fetchResult;
      let fromPageCache = true;
      let initialStrategy: 'static' | 'browser' = input.renderMode === 'browser' ? 'browser' : 'static';
      let finalStrategy: 'static' | 'browser' = initialStrategy;
      let retryReason: RetryReason | undefined;
      let autoRetried = false;
      let fallbackUsed = false;
      let routeReason = 'Cached page result reused.';

      if (cachedPage && cachedPage.fetchResult.via !== 'browser' && input.renderMode !== 'browser') {
        try {
          const routed = await fetchWithRouter({
            mode: 'extract',
            url,
            renderMode: 'static',
            timeoutMs: input.timeoutMs,
            retryMax: input.retryMax,
            userAgent: input.userAgent,
            conditional: {
              etag: cachedPage.validators.etag,
              lastModified: cachedPage.validators.lastModified,
              previousResult: cachedPage.fetchResult,
            },
          });

          fetchResult = routed.fetchResult;
          initialStrategy = routed.decision.strategy;
          finalStrategy = fetchResult.via === 'browser' ? 'browser' : 'static';
          fallbackUsed = routed.fallbackUsed;
          fromPageCache = fetchResult.cacheValidation?.notModified === true;
          routeReason = fromPageCache
            ? 'Static cache revalidated by 304 Not Modified.'
            : 'Static cache revalidated and refreshed with latest content.';
          pageCache.set(url, fetchResult);
        } catch {
          fetchResult = cachedPage.fetchResult;
          fromPageCache = true;
          finalStrategy = fetchResult.via === 'browser' ? 'browser' : 'static';
          routeReason = 'Static cache revalidation failed; fallback to cached snapshot.';
        }
      } else if (!fetchResult) {
        fromPageCache = false;
        // Get host policy before making fetch decision
        let hostPolicyStrategy: 'static' | 'browser' | 'unknown' = 'unknown';
        try {
          const host = new URL(url).hostname;
          hostPolicyStrategy = getPreferredStrategy(host);
        } catch {
          // Ignore URL parsing errors
        }

        const routed = await fetchWithRouter({
          mode: 'extract',
          url,
          renderMode: input.renderMode,
          timeoutMs: input.timeoutMs,
          retryMax: input.retryMax,
          userAgent: input.userAgent,
          hostPolicyStrategy,
        });
        fetchResult = routed.fetchResult;
        initialStrategy = routed.decision.strategy;
        finalStrategy = fetchResult.via === 'browser' ? 'browser' : 'static';
        fallbackUsed = routed.fallbackUsed;
        routeReason = routed.decision.reason;
        pageCache.set(url, fetchResult);
      } else {
        finalStrategy = fetchResult.via === 'browser' ? 'browser' : 'static';
      }

      let document = extractDocument(fetchResult, {
        includeHtml: input.includeHtml,
        includeLinks: input.includeLinks,
        includeStructured: input.includeStructured,
      });

      if (!fromPageCache && input.renderMode === 'auto' && finalStrategy === 'static') {
        const retryDecision = evaluateBrowserRetry(fetchResult, document);
        if (retryDecision.shouldRetryWithBrowser) {
          retryReason = retryDecision.reason;
          try {
            const browserResult = await browserFetch({
              url,
              timeoutMs: input.timeoutMs,
              retryMax: input.retryMax,
              userAgent: input.userAgent,
              waitUntil: 'domcontentloaded',
            });
            fetchResult = browserResult;
            finalStrategy = 'browser';
            autoRetried = true;
            pageCache.set(url, fetchResult);
            document = extractDocument(fetchResult, {
              includeHtml: input.includeHtml,
              includeLinks: input.includeLinks,
              includeStructured: input.includeStructured,
            });
          } catch (err) {
            if (!(err instanceof ExtractError && err.code === 'BROWSER_UNAVAILABLE')) {
              throw err;
            }
          }
        }
      }

      document.cache = {
        hit: fromPageCache,
        ttlSeconds: input.cacheTtlSeconds,
      };
      document.fetch = {
        strategy: finalStrategy,
        initialStrategy,
        autoRetried,
        fallbackUsed,
        reason: routeReason,
        retryReason,
        outcome: autoRetried ? 'success_retry' : (finalStrategy === 'browser' ? 'success_browser' : 'success_static'),
        retryCount: autoRetried ? 1 : 0,
        wasShellDetection: retryReason ? ['js_app_shell_detected', 'noscript_shell_detected', 'dom_shell_detected'].includes(retryReason) : false,
      };

      // Record outcome to host policy memory
      const outcome = autoRetried ? 'success_retry' : (finalStrategy === 'browser' ? 'success_browser' : 'success_static');
      try {
        const host = new URL(url).hostname;
        const wasShell = retryReason ? ['js_app_shell_detected', 'noscript_shell_detected', 'dom_shell_detected'].includes(retryReason) : false;
        recordFetchOutcome(host, outcome, wasShell);
      } catch {
        // Ignore URL parsing errors for policy recording
      }

      documents.push(document);
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

    ExtractResponseSchema.parse(output);
    requestCache.set(input as unknown as Record<string, unknown>, output);

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
