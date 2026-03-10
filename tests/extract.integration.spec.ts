import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extract } from '../src/engines/extract/httpExtractor.js';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/docs') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html lang="en"><head><title>Docs Page</title><meta name="description" content="docs desc"><link rel="canonical" href="/docs"/></head><body><h1>Getting Started</h1><p>Read docs now.</p><a href="/docs/next">Next</a></body></html>');
      return;
    }
    if (req.url === '/blog') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Blog Article</title></head><body><article><h1>My Blog</h1><p>Content.</p></article></body></html>');
      return;
    }
    if (req.url === '/landing') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>Landing</title></head><body><main><h1>Hero</h1><p>CTA text</p></main></body></html>');
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

describe('extract integration', () => {
  it('extracts docs page metadata and links', async () => {
    const result = await extract({ urls: [`${baseUrl}/docs`] });
    const doc = result.data.documents[0];
    expect(doc.title).toBe('Docs Page');
    expect(doc.metadata.description).toBe('docs desc');
    expect(doc.links.length).toBeGreaterThan(0);
  });

  it('extracts blog page content', async () => {
    const result = await extract({ urls: [`${baseUrl}/blog`] });
    const doc = result.data.documents[0];
    expect(doc.markdown).toContain('Blog Article');
    expect(doc.text).toContain('My Blog');
  });

  it('extracts landing page content', async () => {
    const result = await extract({ urls: [`${baseUrl}/landing`] });
    const doc = result.data.documents[0];
    expect(doc.markdown).toContain('Landing');
    expect(doc.text).toContain('Hero');
  });
});
