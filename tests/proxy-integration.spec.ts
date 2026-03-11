import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProxyPool } from '../src/proxy/pool.js';
import { staticFetch } from '../src/fetch/staticFetcher.js';

const integration = process.env.ALLOW_LOCAL_LISTEN_TESTS === '1' ? describe : describe.skip;

let upstream: http.Server;
let proxy: http.Server;
let upstreamUrl = '';
let proxyUrl = '';
let proxiedRequests = 0;

integration('proxy integration harness', () => {
  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><body>upstream ${req.url}</body></html>`);
    });

    proxy = http.createServer((clientReq, clientRes) => {
      proxiedRequests += 1;
      const target = new URL(clientReq.url || '');
      const upstreamReq = http.request({
        hostname: '127.0.0.1',
        port: Number(new URL(upstreamUrl).port),
        path: `${target.pathname}${target.search}`,
        method: clientReq.method,
        headers: clientReq.headers,
      }, (upstreamRes) => {
        clientRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(clientRes);
      });
      clientReq.pipe(upstreamReq);
    });

    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
    const upstreamAddr = upstream.address();
    if (!upstreamAddr || typeof upstreamAddr === 'string') throw new Error('No upstream address');
    upstreamUrl = `http://127.0.0.1:${upstreamAddr.port}`;

    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', () => resolve()));
    const proxyAddr = proxy.address();
    if (!proxyAddr || typeof proxyAddr === 'string') throw new Error('No proxy address');
    proxyUrl = `http://127.0.0.1:${proxyAddr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => proxy.close((err) => err ? reject(err) : resolve()));
    await new Promise<void>((resolve, reject) => upstream.close((err) => err ? reject(err) : resolve()));
  });

  it('routes outbound requests through the proxy and updates health', async () => {
    const pool = createProxyPool({
      proxies: [proxyUrl],
      strategy: 'round-robin',
      minHealthThreshold: 0.5,
    });

    const result = await staticFetch({
      url: `${upstreamUrl}/proxy-check`,
      timeoutMs: 5000,
      retryMax: 0,
      userAgent: 'proxy-test',
    });

    expect(result.statusCode).toBe(200);
    expect(proxiedRequests).toBeGreaterThan(0);
    expect(pool.getStats().healthy).toBe(1);
  });
});
