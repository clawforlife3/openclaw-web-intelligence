import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extract } from '../src/engines/extract/httpExtractor.js';
import { crawl } from '../src/engines/crawl/crawler.js';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/docs') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html lang="en"><head><title>Docs Page</title><meta name="description" content="docs desc"><link rel="canonical" href="/docs"/></head><body><h1>Getting Started</h1><p>Read docs now.</p><a href="/docs/next">Next</a></body></html>');
      return;
    }
    if (req.url === '/docs/next') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Next Page</title></head><body><h1>Next</h1></body></html>');
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

describe('shared extraction pipeline', () => {
  it('keeps extract and crawl document fields aligned', async () => {
    const extractResult = await extract({ urls: [`${baseUrl}/docs`], cacheTtlSeconds: 0 });
    const crawlResult = await crawl({ seedUrl: `${baseUrl}/docs`, limit: 1, maxDepth: 1, cacheTtlSeconds: 0 });

    const extracted = extractResult.data.documents[0];
    const crawled = crawlResult.data.documents[0];

    expect(crawled.title).toBe(extracted.title);
    expect(crawled.text).toBe(extracted.text);
    expect(crawled.metadata.description).toBe(extracted.metadata.description);
    expect(crawled.links).toEqual(extracted.links);
  });

  it('marks request cache on repeated extract requests', async () => {
    const request = { urls: [`${baseUrl}/docs`], cacheTtlSeconds: 60 };

    const first = await extract(request);
    const second = await extract(request);

    expect(first.meta?.cached).toBe(false);
    expect(second.meta?.cached).toBe(true);
  });
});
