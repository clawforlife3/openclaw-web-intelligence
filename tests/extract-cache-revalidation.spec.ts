import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithRouterMock = vi.fn();
const pageCacheGetMock = vi.fn();
const pageCacheSetMock = vi.fn();

vi.mock('../src/cache/requestCache.js', () => ({
  RequestCache: class {
    get() {
      return null;
    }
    set() {
      // no-op
    }
  },
}));

vi.mock('../src/cache/pageCache.js', () => ({
  PageCache: class {
    get(url: string) {
      return pageCacheGetMock(url);
    }
    set(url: string, value: unknown) {
      pageCacheSetMock(url, value);
    }
  },
}));

vi.mock('../src/fetch/fetchWithRouter.js', () => ({
  fetchWithRouter: fetchWithRouterMock,
}));

vi.mock('../src/fetch/browserFetcher.js', () => ({
  browserFetch: vi.fn(),
}));

vi.mock('../src/observability/requestLogger.js', () => ({
  logExtractRequest: vi.fn(async () => undefined),
}));

const { extract } = await import('../src/engines/extract/httpExtractor.js');

describe('extract cache revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    pageCacheGetMock.mockReturnValue({
      fetchResult: {
        requestedUrl: 'https://example.com/page',
        finalUrl: 'https://example.com/page',
        statusCode: 200,
        contentType: 'text/html',
        html: '<html><head><title>Cached</title></head><body><main><p>cached snapshot</p></main></body></html>',
        fetchedAt: '2026-03-11T01:00:00.000Z',
        headers: {
          'content-type': 'text/html',
          etag: 'W/"v1"',
          'last-modified': 'Wed, 11 Mar 2026 01:00:00 GMT',
        },
        via: 'static',
      },
      validators: {
        etag: 'W/"v1"',
        lastModified: 'Wed, 11 Mar 2026 01:00:00 GMT',
      },
      updatedAt: '2026-03-11T01:00:01.000Z',
    });

    fetchWithRouterMock.mockResolvedValue({
      fetchResult: {
        requestedUrl: 'https://example.com/page',
        finalUrl: 'https://example.com/page',
        statusCode: 200,
        contentType: 'text/html',
        html: '<html><head><title>Cached</title></head><body><main><p>cached snapshot</p></main></body></html>',
        fetchedAt: '2026-03-11T02:00:00.000Z',
        headers: {
          'content-type': 'text/html',
          etag: 'W/"v1"',
          'last-modified': 'Wed, 11 Mar 2026 01:00:00 GMT',
        },
        via: 'static',
        cacheValidation: {
          revalidated: true,
          notModified: true,
          etag: 'W/"v1"',
          lastModified: 'Wed, 11 Mar 2026 01:00:00 GMT',
        },
      },
      decision: {
        mode: 'extract',
        strategy: 'static',
        allowFallback: false,
        reason: 'User explicitly requested static rendering.',
      },
      fallbackUsed: false,
    });
  });

  it('uses conditional revalidation when static page cache exists', async () => {
    const result = await extract({
      urls: ['https://example.com/page'],
      renderMode: 'auto',
      cacheTtlSeconds: 120,
      includeLinks: true,
    });

    expect(fetchWithRouterMock).toHaveBeenCalledTimes(1);
    const req = fetchWithRouterMock.mock.calls[0][0] as Record<string, unknown>;
    expect(req.renderMode).toBe('static');
    expect(req.conditional).toMatchObject({
      etag: 'W/"v1"',
      lastModified: 'Wed, 11 Mar 2026 01:00:00 GMT',
    });

    expect(result.data.documents[0].cache?.hit).toBe(true);
    expect(result.data.documents[0].fetch?.reason).toContain('304 Not Modified');
    expect(pageCacheSetMock).toHaveBeenCalledTimes(1);
  });
});
