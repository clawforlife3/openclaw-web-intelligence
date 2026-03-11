import { describe, it, expect, beforeEach } from 'vitest';
import { createAdvancedLimiter, getAdvancedLimiter } from '../src/ratelimit/advanced.js';

describe('AdvancedRateLimiter', () => {
  beforeEach(() => {
    const limiter = getAdvancedLimiter();
    if (limiter) {
      limiter.reset();
    }
  });

  describe('createAdvancedLimiter', () => {
    it('should create a limiter with custom config', () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'example.com': {
            requestsPerSecond: 10,
            burst: 20,
            cooldownMs: 5000,
          },
        },
        global: {
          maxConcurrent: 5,
          requestsPerSecond: 3,
        },
      });

      expect(limiter).toBeDefined();
    });

    it('should use default config when not provided', () => {
      const limiter = createAdvancedLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should allow requests within limit', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 5,
            burst: 5,
            cooldownMs: 1000,
          },
        },
      });

      // Should not throw
      await limiter.acquire('test.com');
      limiter.release('test.com');
    });

    it('should track remaining tokens', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 2,
            burst: 2,
            cooldownMs: 1000,
          },
        },
      });

      await limiter.acquire('test.com');
      const remaining = limiter.getRemaining('test.com');
      expect(remaining).toBe(1);
      limiter.release('test.com');
    });

    it('respects global concurrency under parallel load', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'a.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
          'b.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
          'c.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
        },
        global: {
          maxConcurrent: 2,
          requestsPerSecond: 20,
        },
      });

      await limiter.acquire('a.com');
      await limiter.acquire('b.com');
      expect(limiter.getStats().global.concurrency).toBe(2);

      let thirdAcquired = false;
      const third = limiter.acquire('c.com').then(() => {
        thirdAcquired = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(thirdAcquired).toBe(false);

      limiter.release('a.com');
      await third;
      expect(thirdAcquired).toBe(true);
      expect(limiter.getStats().global.concurrency).toBe(2);

      limiter.release('b.com');
      limiter.release('c.com');
      expect(limiter.getStats().global.concurrency).toBe(0);
    });

    it('wakes queued domains fairly in FIFO order', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'a.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
          'b.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
          'c.com': { requestsPerSecond: 20, burst: 20, cooldownMs: 1000 },
        },
        global: {
          maxConcurrent: 1,
          requestsPerSecond: 20,
        },
      });

      await limiter.acquire('a.com');
      const order: string[] = [];

      const waitB = limiter.acquire('b.com').then(() => { order.push('b'); });
      const waitC = limiter.acquire('c.com').then(() => { order.push('c'); });

      await new Promise((resolve) => setTimeout(resolve, 30));
      limiter.release('a.com');
      await waitB;
      limiter.release('b.com');
      await waitC;
      limiter.release('c.com');

      expect(order).toEqual(['b', 'c']);
    });
  });

  describe('backoff', () => {
    it('should set cooldown for domain', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 2,
            burst: 2,
            cooldownMs: 5000,
          },
        },
      });

      await limiter.acquire('test.com');
      limiter.release('test.com');
      await limiter.backoff('test.com');
      
      // After backoff, tokens should be cleared
      const remaining = limiter.getRemaining('test.com');
      expect(remaining).toBe(0);
    });

    it('blocks acquire while domain is in cooldown', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 2,
            burst: 2,
            cooldownMs: 5000,
          },
        },
      });

      await limiter.backoff('test.com');
      await expect(limiter.acquire('test.com')).rejects.toThrow(/COOLDOWN/);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 5,
            burst: 10,
            cooldownMs: 5000,
          },
        },
      });

      await limiter.acquire('test.com');

      const stats = limiter.getStats();
      expect(stats.domains).toHaveLength(1);
      expect(stats.domains[0].domain).toBe('test.com');
      expect(stats.global.concurrency).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset domain state', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 2,
            burst: 2,
            cooldownMs: 1000,
          },
        },
      });

      await limiter.acquire('test.com');
      limiter.reset('test.com');

      const remaining = limiter.getRemaining('test.com');
      expect(remaining).toBe(-1); // Domain removed
    });

    it('should reset all when no domain specified', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'test.com': {
            requestsPerSecond: 2,
            burst: 2,
            cooldownMs: 1000,
          },
        },
      });

      await limiter.acquire('test.com');
      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.domains).toHaveLength(0);
      expect(stats.global.concurrency).toBe(0);
    });
  });

  describe('stability', () => {
    it('does not drift concurrency across repeated acquire/release cycles', async () => {
      const limiter = createAdvancedLimiter({
        domains: {
          'stable.com': {
            requestsPerSecond: 50,
            burst: 50,
            cooldownMs: 1000,
          },
        },
        global: {
          maxConcurrent: 3,
          requestsPerSecond: 50,
        },
      });

      for (let i = 0; i < 25; i += 1) {
        await limiter.acquire('stable.com');
        limiter.release('stable.com');
      }

      const stats = limiter.getStats();
      expect(stats.global.concurrency).toBe(0);
      expect(stats.global.remainingTokens).toBeGreaterThanOrEqual(0);
    });
  });
});
