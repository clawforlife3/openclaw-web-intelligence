import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { monitor } from '../src/monitor/monitor.js';
import { getCache } from '../src/storage/cache.js';

let server: http.Server;
let baseUrl = '';
let version = 'v1';

beforeAll(async () => {
  getCache({ enabled: true, ttlSeconds: 0 }).clear();

  server = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><head><title>Monitor ${version}</title></head><body><main><h1>${version}</h1><p>payload ${version}</p></main></body></html>`);
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

describe('monitor / diff v1', () => {
  it('creates initial snapshot on first run', async () => {
    version = 'v1';
    const result = await monitor({
      targetType: 'page',
      target: `${baseUrl}/page`,
      schedule: 'every 1h',
      execution: { operation: 'extract' },
    });

    expect(result.data.status).toBe('created');
    expect(result.data.changed).toBe(true);
    expect(result.data.change?.fields).toContain('initial_snapshot');
  });

  it('detects text/title changes on subsequent run', async () => {
    version = 'v2';
    const result = await monitor({
      targetType: 'page',
      target: `${baseUrl}/page`,
      schedule: 'every 1h',
      execution: { operation: 'extract' },
    });

    expect(result.data.status).toBe('checked');
    expect(result.data.changed).toBe(true);
    expect(result.data.change?.fields).toContain('title');
    expect(result.data.change?.fields).toContain('text');
  });
});
