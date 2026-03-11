import { afterEach, describe, expect, it, vi } from 'vitest';
import { staticFetch } from '../src/fetch/staticFetcher.js';

function makeResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(status === 304 ? null : body, {
    status,
    headers,
  });
}

describe('staticFetch conditional requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends if-none-match / if-modified-since when validators are provided', async () => {
    const fetchMock = vi.fn(async () => makeResponse(200, '<html><body>fresh</body></html>', {
      'content-type': 'text/html',
      etag: 'W/"v2"',
      'last-modified': 'Wed, 11 Mar 2026 02:00:00 GMT',
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await staticFetch({
      url: 'https://example.com/page',
      timeoutMs: 5_000,
      retryMax: 0,
      userAgent: 'test-agent',
      conditional: {
        etag: 'W/"v1"',
        lastModified: 'Wed, 11 Mar 2026 01:00:00 GMT',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const req = ((firstCall && firstCall.at(1)) ?? {}) as RequestInit;
    expect(req.headers).toMatchObject({
      'if-none-match': 'W/"v1"',
      'if-modified-since': 'Wed, 11 Mar 2026 01:00:00 GMT',
    });
    expect(result.cacheValidation?.revalidated).toBe(true);
    expect(result.cacheValidation?.notModified).toBe(false);
    expect(result.cacheValidation?.etag).toBe('W/"v2"');
  });

  it('reuses previous html when server returns 304 not modified', async () => {
    const fetchMock = vi.fn(async () => makeResponse(304, '', {
      etag: 'W/"v1"',
      'last-modified': 'Wed, 11 Mar 2026 01:00:00 GMT',
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await staticFetch({
      url: 'https://example.com/page',
      timeoutMs: 5_000,
      retryMax: 0,
      userAgent: 'test-agent',
      conditional: {
        etag: 'W/"v1"',
        lastModified: 'Wed, 11 Mar 2026 01:00:00 GMT',
        previousResult: {
          requestedUrl: 'https://example.com/page',
          finalUrl: 'https://example.com/page',
          statusCode: 200,
          contentType: 'text/html',
          html: '<html><body>cached body</body></html>',
          fetchedAt: '2026-03-11T01:00:00.000Z',
          headers: {
            'content-type': 'text/html',
            etag: 'W/"v1"',
            'last-modified': 'Wed, 11 Mar 2026 01:00:00 GMT',
          },
          via: 'static',
        },
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('cached body');
    expect(result.cacheValidation?.revalidated).toBe(true);
    expect(result.cacheValidation?.notModified).toBe(true);
  });
});
