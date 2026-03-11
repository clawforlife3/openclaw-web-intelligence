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
      res.end('<html lang="en"><head><title>Docs Page</title><meta name="description" content="docs desc"></head><body><nav><a href="/docs">Docs</a><a href="/docs/api">API</a></nav><div class="table-of-contents"><a href="#install">Install</a></div><main><section><h1>Getting Started</h1><h2>Install</h2><pre><code>npm install demo</code></pre></section></main></body></html>');
      return;
    }
    if (req.url === '/blog') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Blog Article</title><meta property="og:type" content="article"><meta name="author" content="Nova"><meta property="article:modified_time" content="2026-03-12"><meta property="article:tag" content="OpenClaw"><script type="application/ld+json">{"@type":"Article","headline":"My Blog","author":{"name":"Nova"},"datePublished":"2026-03-11","dateModified":"2026-03-12","articleSection":"Engineering"}</script></head><body><article><h1>My Blog</h1><time datetime="2026-03-11">March 11</time><p>Content.</p></article></body></html>');
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

describe('structured extraction v1', () => {
  it('extracts docs structured fields in extract mode', async () => {
    const result = await extract({ urls: [`${baseUrl}/docs`], includeStructured: true, cacheTtlSeconds: 0 });
    const doc = result.data.documents[0];

    expect(doc.structured.kind).toBe('docs');
    expect(doc.structured.headingTree).toContain('Getting Started');
    expect(doc.structured.codeBlockCount).toBeGreaterThan(0);
    expect(doc.structured.hasTableOfContents).toBe(true);
    expect(doc.structured.pathType).toBe('guide');
  });

  it('extracts article structured fields in extract mode', async () => {
    const result = await extract({ urls: [`${baseUrl}/blog`], includeStructured: true, cacheTtlSeconds: 0 });
    const doc = result.data.documents[0];

    expect(doc.structured.kind).toBe('article');
    expect(doc.structured.author).toBe('Nova');
    expect(doc.structured.publishedAt).toBe('2026-03-11');
    expect(doc.structured.updatedAt).toBe('2026-03-12');
    expect(doc.structured.section).toBe('Engineering');
    expect(doc.structured.tagCount).toBe(1);
  });

  it('keeps structured extraction available in crawl mode', async () => {
    const result = await crawl({ seedUrl: `${baseUrl}/docs`, includeStructured: true, limit: 1, maxDepth: 1, cacheTtlSeconds: 0 });
    const doc = result.data.documents[0];

    expect(doc.structured.kind).toBe('docs');
    expect(doc.structured.navLinkCount).toBeGreaterThan(0);
    expect(doc.structured.sectionCount).toBeGreaterThan(0);
  });
});
