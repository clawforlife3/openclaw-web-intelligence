import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/fetch/fetchWithRouter.js', () => ({
  fetchWithRouter: vi.fn(async (request: { url: string }) => ({
    fetchResult: {
      requestedUrl: request.url,
      finalUrl: request.url,
      statusCode: 200,
      contentType: 'text/html',
      html: '<html><head><title>App</title></head><body><div id="root"></div><script src="app.js"></script><script src="vendor.js"></script><script src="runtime.js"></script></body></html>',
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

vi.mock('../src/fetch/browserFetcher.js', () => ({
  browserFetch: vi.fn(async (request: { url: string }) => ({
    requestedUrl: request.url,
    finalUrl: request.url,
    statusCode: 200,
    contentType: 'text/html',
    html: '<html><head><title>Rendered Crawl</title></head><body><main><h1>Crawl Loaded</h1><a href="https://example.com/next">Next</a><p>This page required browser rendering during crawl.</p></main></body></html>',
    fetchedAt: new Date().toISOString(),
    headers: { 'content-type': 'text/html' },
    via: 'browser',
  })),
}));

const { crawl } = await import('../src/engines/crawl/crawler.js');

describe('crawl browser auto-detection', () => {
  it('retries with browser in crawl mode when static result looks like JS shell', async () => {
    const result = await crawl({
      seedUrl: 'https://example.com/app',
      limit: 1,
      maxDepth: 1,
      cacheTtlSeconds: 0,
    });

    const doc = result.data.documents[0];
    expect(doc.fetch?.initialStrategy).toBe('static');
    expect(doc.fetch?.strategy).toBe('browser');
    expect(doc.fetch?.autoRetried).toBe(true);
    expect(doc.fetch?.retryReason).toBe('js_app_shell_detected');
    expect(doc.text).toContain('Crawl Loaded');
  });
});
