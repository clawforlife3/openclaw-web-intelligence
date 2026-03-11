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
});
