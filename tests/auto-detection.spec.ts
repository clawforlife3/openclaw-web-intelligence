import { describe, expect, it, vi } from 'vitest';
import { evaluateBrowserRetry, extractDocument } from '../src/extract/extractPipeline.js';
import type { StaticFetchResult } from '../src/fetch/staticFetcher.js';

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
      mode: 'extract',
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
    html: '<html><head><title>Rendered App</title></head><body><main><h1>Loaded</h1><p>This content came from browser rendering and is much longer than the static shell.</p></main></body></html>',
    fetchedAt: new Date().toISOString(),
    headers: { 'content-type': 'text/html' },
    via: 'browser',
  })),
}));

const { extract } = await import('../src/engines/extract/httpExtractor.js');

describe('browser auto-detection', () => {
  it('flags thin JS shell pages for browser retry', () => {
    const fetchResult: StaticFetchResult = {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com',
      statusCode: 200,
      contentType: 'text/html',
      html: '<html><head><title>App</title></head><body><div id="root"></div><script src="app.js"></script><script src="vendor.js"></script><script src="runtime.js"></script></body></html>',
      fetchedAt: new Date().toISOString(),
      headers: { 'content-type': 'text/html' },
    };

    const document = extractDocument(fetchResult, { includeLinks: true });
    const decision = evaluateBrowserRetry(fetchResult, document);

    expect(decision.shouldRetryWithBrowser).toBe(true);
    expect(decision.reason).toBe('js_app_shell_detected');
  });

  it('flags noscript shell pages for browser retry', () => {
    const fetchResult: StaticFetchResult = {
      requestedUrl: 'https://example.com/docs',
      finalUrl: 'https://example.com/docs',
      statusCode: 200,
      contentType: 'text/html',
      html: '<html><head><title>Docs App</title></head><body><noscript>Please enable JavaScript to run this app.</noscript><div id="app"></div><script src="bundle.js"></script><script src="vendor.js"></script></body></html>',
      fetchedAt: new Date().toISOString(),
      headers: { 'content-type': 'text/html' },
    };

    const document = extractDocument(fetchResult, { includeLinks: true });
    const decision = evaluateBrowserRetry(fetchResult, document);

    expect(decision.shouldRetryWithBrowser).toBe(true);
    expect(decision.reason).toBe('js_app_shell_detected');
  });

  it('retries with browser in auto mode when static result looks like JS shell', async () => {
    const result = await extract({
      urls: ['https://example.com/app'],
      renderMode: 'auto',
      cacheTtlSeconds: 0,
      includeLinks: true,
    });

    const doc = result.data.documents[0];
    expect(doc.fetch?.initialStrategy).toBe('static');
    expect(doc.fetch?.strategy).toBe('browser');
    expect(doc.fetch?.autoRetried).toBe(true);
    expect(doc.fetch?.retryReason).toBe('js_app_shell_detected');
    expect(doc.text).toContain('Loaded');
  });
});
