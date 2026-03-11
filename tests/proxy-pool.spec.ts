import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProxyPool, createProxyPool, getProxyPool } from '../src/proxy/pool.js';
import { getMetrics, resetMetrics } from '../src/observability/metrics.js';

describe('ProxyPool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetMetrics();
  });

  describe('createProxyPool', () => {
    it('should create a new proxy pool', () => {
      const pool = createProxyPool({
        proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
        strategy: 'random',
      });

      expect(pool).toBeDefined();
      const stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.healthy).toBe(2);
    });

    it('should use default config when not provided', () => {
      const pool = createProxyPool();
      expect(pool).toBeDefined();
      expect(pool.getStats().total).toBe(0);
    });
  });

  describe('addProxy', () => {
    it('should add a proxy to the pool', () => {
      const pool = createProxyPool();
      const proxy = pool.addProxy('http://test:8080');

      expect(proxy.url).toBe('http://test:8080');
      expect(proxy.health).toBe(1);
      expect(proxy.isHealthy).toBe(true);
    });
  });

  describe('removeProxy', () => {
    it('should remove a proxy from the pool', () => {
      const pool = createProxyPool();
      const proxy = pool.addProxy('http://test:8080');
      const removed = pool.removeProxy(proxy.id);

      expect(removed).toBe(true);
      expect(pool.getStats().total).toBe(0);
    });
  });

  describe('getProxy', () => {
    it('should return null when no proxies', () => {
      const pool = createProxyPool();
      expect(pool.getProxy()).toBeNull();
    });

    it('should return proxy using round-robin strategy', () => {
      const pool = createProxyPool({
        proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
        strategy: 'round-robin',
      });

      const p1 = pool.getProxy();
      const p2 = pool.getProxy();
      const p3 = pool.getProxy(); // Should wrap around

      expect(p1?.url).toBe('http://proxy1:8080');
      expect(p2?.url).toBe('http://proxy2:8080');
      expect(p3?.url).toBe('http://proxy1:8080');
    });

    it('should return proxy using random strategy', () => {
      const pool = createProxyPool({
        proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
        strategy: 'random',
      });

      const proxy = pool.getProxy();
      expect(['http://proxy1:8080', 'http://proxy2:8080']).toContain(proxy?.url);
    });

    it('should skip unhealthy proxies', () => {
      const pool = createProxyPool({
        proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
        minHealthThreshold: 0.7,
      });

      // Mark first proxy as unhealthy (11 failures needed when starting at health=1)
      const proxy1 = pool.listProxies()[0];
      for (let i = 0; i < 15; i++) {
        pool.reportResult(proxy1.id, false, 1000);
      }

      const proxy = pool.getProxy();
      expect(proxy?.url).toBe('http://proxy2:8080');
    });
  });

  describe('reportResult', () => {
    it('should update health on success', () => {
      const pool = createProxyPool({
        proxies: ['http://test:8080'],
      });

      const proxy = pool.listProxies()[0];
      pool.reportResult(proxy.id, true, 100);

      const updated = pool.listProxies()[0];
      expect(updated.successCount).toBe(1);
      expect(updated.health).toBe(1);
    });

    it('should decrease health on many failures', () => {
      const pool = createProxyPool({
        proxies: ['http://test:8080'],
        minHealthThreshold: 0.5,
      });

      const proxy = pool.listProxies()[0];
      // Need many failures to drop health below threshold
      for (let i = 0; i < 15; i++) {
        pool.reportResult(proxy.id, false, 5000);
      }

      const updated = pool.listProxies()[0];
      expect(updated.failCount).toBe(15);
      expect(updated.isHealthy).toBe(false);
    });

    it('tracks proxy metrics for selection, failures, and recovery', () => {
      const pool = createProxyPool({
        proxies: ['http://test:8080'],
        minHealthThreshold: 0.5,
      });

      const selected = pool.getProxy();
      expect(selected).toBeTruthy();

      const proxy = pool.listProxies()[0];
      for (let i = 0; i < 15; i++) {
        pool.reportResult(proxy.id, false, 1000);
      }
      for (let i = 0; i < 20; i++) {
        pool.reportResult(proxy.id, true, 50);
      }

      const metrics = getMetrics();
      expect(metrics.proxies.selected).toBe(1);
      expect(metrics.proxies.failures).toBe(15);
      expect(metrics.proxies.recovered).toBeGreaterThanOrEqual(1);
      expect(metrics.proxies.total).toBe(1);
      expect(metrics.proxies.healthy).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const pool = createProxyPool({
        proxies: ['http://proxy1:8080', 'http://proxy2:8080', 'http://proxy3:8080'],
        minHealthThreshold: 0.5,
      });

      const proxy1 = pool.listProxies()[0];
      for (let i = 0; i < 15; i++) {
        pool.reportResult(proxy1.id, false, 5000);
      }

      const stats = pool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.healthy).toBe(2);
      expect(stats.unhealthy).toBe(1);
    });
  });
});
