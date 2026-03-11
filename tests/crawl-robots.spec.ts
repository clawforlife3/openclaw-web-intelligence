import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtractError } from '../src/types/errors.js';

const fetchWithRouterMock = vi.fn();

vi.mock('../src/fetch/fetchWithRouter.js', () => ({
  fetchWithRouter: fetchWithRouterMock,
}));

vi.mock('../src/fetch/browserFetcher.js', () => ({
  browserFetch: vi.fn(),
}));

const { crawl, map } = await import('../src/engines/crawl/crawler.js');
const { clearRobotsPolicyCache } = await import('../src/engines/crawl/robotsPolicy.js');

describe('crawl/map robots enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearRobotsPolicyCache();
    fetchWithRouterMock.mockResolvedValue({
      fetchResult: {
        requestedUrl: 'https://example.com/docs',
        finalUrl: 'https://example.com/docs',
        statusCode: 200,
        contentType: 'text/html',
        html: '<html><head><title>Docs</title></head><body><main><a href="https://example.com/private">Private</a></main></body></html>',
        fetchedAt: new Date().toISOString(),
        headers: { 'content-type': 'text/html' },
        via: 'static',
      },
      decision: {
        mode: 'crawl',
        strategy: 'static',
        allowFallback: true,
        fallbackStrategy: 'browser',
        reason: 'Default to static fetch first; browser remains fallback path for Phase 2.',
      },
      fallbackUsed: false,
    });
  });

  it('throws when seed url is denied by robots in strict mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('User-agent: *\nDisallow: /docs\n', { status: 200 })));

    await expect(crawl({
      seedUrl: 'https://example.com/docs',
      robotsMode: 'strict',
      cacheTtlSeconds: 0,
    })).rejects.toMatchObject({ code: 'ROBOTS_POLICY_DENIED' } satisfies Partial<ExtractError>);
  });

  it('skips child links denied by robots during crawl and map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('User-agent: *\nDisallow: /private\n', { status: 200 })));

    const crawlResult = await crawl({
      seedUrl: 'https://example.com/docs',
      robotsMode: 'strict',
      cacheTtlSeconds: 0,
      limit: 2,
      maxDepth: 2,
    });

    const mapResult = await map({
      url: 'https://example.com/docs',
      robotsMode: 'strict',
      cacheTtlSeconds: 0,
      limit: 2,
      maxDepth: 2,
    });

    expect(crawlResult.data.summary.skipped).toBe(1);
    expect(crawlResult.data.documents).toHaveLength(1);
    expect(mapResult.data.summary.excluded).toBe(1);
    expect(mapResult.data.urls).toHaveLength(1);
  });
});

