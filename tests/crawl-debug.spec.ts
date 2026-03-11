import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/engines/crawl/robotsPolicy.js', () => ({
  evaluateRobotsPolicy: vi.fn(async (url: string) => {
    if (url.includes('/blocked')) {
      return { allowed: false, reason: 'disallowed', robotsUrl: 'https://example.com/robots.txt' };
    }
    return { allowed: true, reason: 'allowed', robotsUrl: 'https://example.com/robots.txt' };
  }),
}));

vi.mock('../src/fetch/fetchWithRouter.js', () => ({
  fetchWithRouter: vi.fn(async (request: { url: string }) => ({
    fetchResult: {
      requestedUrl: request.url,
      finalUrl: request.url,
      statusCode: 200,
      contentType: 'text/html',
      html: '<html><head><title>Docs</title></head><body><main><h1>Docs</h1><a href="https://example.com/ok">OK</a><a href="https://example.com/blocked">Blocked</a></main></body></html>',
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
  })),
}));

const { crawl, map } = await import('../src/engines/crawl/crawler.js');

describe('crawl/map debug metadata', () => {
  it('records robots decisions for crawl', async () => {
    const result = await crawl({ seedUrl: 'https://example.com/docs', limit: 2, maxDepth: 1, cacheTtlSeconds: 0 });
    const robots = result.data.debug?.robots;
    expect(robots).toBeDefined();
    expect(robots!.blockedCount).toBe(1);
    expect(robots!.decisions.some((d) => d.url.includes('/blocked') && d.allowed === false)).toBe(true);
  });

  it('records seed robots decision for map', async () => {
    const result = await map({ url: 'https://example.com/docs', limit: 1, maxDepth: 1, cacheTtlSeconds: 0 });
    const robots = result.data.debug?.robots;
    expect(robots).toBeDefined();
    expect(robots!.decisions[0]?.phase).toBe('seed');
    expect(robots!.decisions[0]?.robotsUrl).toContain('/robots.txt');
  });
});
