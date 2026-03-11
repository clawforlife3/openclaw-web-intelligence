import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExtractError } from '../src/types/errors.js';

vi.mock('../src/fetch/browserFetcher.js', () => ({
  browserFetch: vi.fn(async () => {
    throw new ExtractError('BROWSER_UNAVAILABLE', 'mock browser unavailable', false, { via: 'mock' });
  }),
}));

const { fetchWithRouter } = await import('../src/fetch/fetchWithRouter.js');
const { extract } = await import('../src/engines/extract/httpExtractor.js');

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Fallback Page</title></head><body><h1>Hello</h1></body></html>');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<html><body>not found</body></html>');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('No address');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('browser fallback routing', () => {
  it('falls back to static when browser path is unavailable and static fallback is allowed', async () => {
    const result = await fetchWithRouter({
      mode: 'extract',
      renderMode: 'auto',
      url: `${baseUrl}/page`,
      htmlHint: '<div id="root"></div>',
      timeoutMs: 10_000,
      retryMax: 0,
      userAgent: 'test-agent',
    });

    expect(result.fetchResult.finalUrl).toContain('/page');
    expect(result.decision.strategy).toBe('browser');
    expect(result.fallbackUsed).toBe(true);
  });

  it('throws when browser mode is explicitly required', async () => {
    await expect(
      extract({ urls: [`${baseUrl}/page`], renderMode: 'browser', cacheTtlSeconds: 0 }),
    ).rejects.toMatchObject({ code: 'BROWSER_UNAVAILABLE' } satisfies Partial<ExtractError>);
  });
});
