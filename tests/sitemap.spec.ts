import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { map, crawl } from '../src/engines/crawl/crawler.js';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/page1</loc>
    <lastmod>2026-03-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/page2</loc>
    <lastmod>2026-03-10</lastmod>
  </url>
</urlset>`);
      return;
    }
    if (req.url === '/page1') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Page 1</title></head><body><h1>Page 1</h1></body></html>');
      return;
    }
    if (req.url === '/page2') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Page 2</title></head><body><h1>Page 2</h1></body></html>');
      return;
    }
    res.writeHead(404);
    res.end('Not found');
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

describe('sitemap discovery', () => {
  it('discovers URLs from sitemap in map mode', async () => {
    const result = await map({
      url: baseUrl,
      limit: 10,
      discoverFromSitemap: true,
      cacheTtlSeconds: 0,
    });

    expect(result.success).toBe(true);
    expect(result.data.urls.length).toBeGreaterThan(0);
    expect(result.data.urls[0].discoveredBy).toBe('sitemap');
  });

  it('discovers URLs from sitemap in crawl mode', async () => {
    const result = await crawl({
      seedUrl: baseUrl,
      limit: 10,
      discoverFromSitemap: true,
      cacheTtlSeconds: 0,
    });

    expect(result.success).toBe(true);
    expect(result.data.documents.length).toBeGreaterThan(0);
  });

  it('falls back to BFS when sitemap not available', async () => {
    const result = await map({
      url: `${baseUrl}/nonexistent`,
      limit: 5,
      discoverFromSitemap: true,
      cacheTtlSeconds: 0,
    });

    // Should still work but with BFS fallback
    expect(result.success).toBe(true);
  });
});
