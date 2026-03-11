import { ExtractError } from '../types/errors.js';
import { getProxyPool, type Proxy } from '../proxy/pool.js';
import { getEvasionManager } from '../anti-bot/evasion.js';

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

  // Apply evasion delay and get evasion headers if enabled
  const evasion = getEvasionManager();
  if (evasion) {
    await evasion.delay();
  }

  for (let attempt = 0; attempt <= request.retryMax; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), request.timeoutMs);

    let proxy: Proxy | null = null;
    let usedProxyUrl: string | undefined = request.proxyUrl;
    
    // Use proxy pool if no explicit proxy specified
    if (!usedProxyUrl) {
      const pool = getProxyPool();
      if (pool) {
        proxy = pool.getProxy();
        if (proxy) {
          usedProxyUrl = proxy.url;
        }
      }
    }

    // Get evasion headers if enabled
    let evasionHeaders: Record<string, string> = {};
    if (evasion) {
      evasionHeaders = evasion.getHeaders();
    }

    const fetchOptions: RequestInit = {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { ...buildRequestHeaders(request), ...evasionHeaders },
    };

    try {
      const startTime = Date.now();
      const res = await fetch(request.url, fetchOptions);
      const latency = Date.now() - startTime;
      clearTimeout(timer);

      // Report proxy result if used
      if (proxy) {
        const pool = getProxyPool();
        if (pool) {
          pool.reportResult(proxy.id, res.ok, latency);
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
      const validators = extractValidators(responseHeaders);

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
    });
  }

  throw new ExtractError('INTERNAL_ERROR', `Failed to fetch ${request.url}`, true, { url: request.url });
}
