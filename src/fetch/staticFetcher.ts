import { ExtractError } from '../types/errors.js';

export interface StaticFetchRequest {
  url: string;
  timeoutMs: number;
  retryMax: number;
  userAgent: string;
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

  for (let attempt = 0; attempt <= request.retryMax; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), request.timeoutMs);

    try {
      const res = await fetch(request.url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: buildRequestHeaders(request),
      });
      clearTimeout(timer);

      const responseHeaders = Object.fromEntries(res.headers.entries());
      const validators = extractValidators(responseHeaders);

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
