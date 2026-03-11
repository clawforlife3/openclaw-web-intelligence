interface TokenBucket {
  tokens: number;
  lastRefill: number;
  pending: number;
}

export interface DomainLimit {
  requestsPerSecond: number;
  burst: number;
  cooldownMs: number;
}

export interface RateLimitConfig {
  domains?: Record<string, DomainLimit>;
  global?: {
    maxConcurrent: number;
    requestsPerSecond: number;
  };
  backoff?: {
    initialMs: number;
    maxMs: number;
    multiplier: number;
  };
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  domains: {},
  global: {
    maxConcurrent: 10,
    requestsPerSecond: 5,
  },
  backoff: {
    initialMs: 1000,
    maxMs: 60000,
    multiplier: 2,
  },
};

interface WaitEntry {
  resolve: (value?: unknown) => void;
  domain: string;
  addedAt: number;
}

class AdvancedRateLimiter {
  private limits: Map<string, DomainLimit> = new Map();
  private buckets: Map<string, TokenBucket> = new Map();
  private globalBucket: TokenBucket;
  private waitQueue: WaitEntry[] = [];
  private config: Required<RateLimitConfig>;
  private globalConcurrency = 0;
  private cooldownUntil: Map<string, number> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    for (const [domain, limit] of Object.entries(this.config.domains)) {
      this.limits.set(domain, limit);
      this.buckets.set(domain, {
        tokens: limit.burst,
        lastRefill: Date.now(),
        pending: 0,
      });
    }

    this.globalBucket = {
      tokens: this.config.global.requestsPerSecond,
      lastRefill: Date.now(),
      pending: 0,
    };
  }

  private refill(domain: string): void {
    const bucket = this.buckets.get(domain);
    if (!bucket) return;

    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const limit = this.limits.get(domain);
    if (!limit) return;

    const tokensToAdd = (elapsed / 1000) * limit.requestsPerSecond;
    bucket.tokens = Math.min(limit.burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private refillGlobal(): void {
    const now = Date.now();
    const elapsed = now - this.globalBucket.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.config.global.requestsPerSecond;
    this.globalBucket.tokens = Math.min(
      this.config.global.maxConcurrent,
      this.globalBucket.tokens + tokensToAdd
    );
    this.globalBucket.lastRefill = now;
  }

  async acquire(domain: string): Promise<void> {
    // Check cooldown
    const cooldownUntil = this.cooldownUntil.get(domain);
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const waitTime = cooldownUntil - Date.now();
      throw new Error(`COOLDOWN: ${waitTime}ms remaining for ${domain}`);
    }

    // Initialize domain if not exists
    if (!this.limits.has(domain)) {
      const defaultLimit: DomainLimit = {
        requestsPerSecond: 2,
        burst: 5,
        cooldownMs: 30000,
      };
      this.limits.set(domain, defaultLimit);
      this.buckets.set(domain, {
        tokens: defaultLimit.burst,
        lastRefill: Date.now(),
        pending: 0,
      });
    }

    this.refill(domain);
    this.refillGlobal();

    const bucket = this.buckets.get(domain)!;
    const limit = this.limits.get(domain)!;

    // Wait for token
    while (bucket.tokens < 1 || this.globalBucket.tokens < 1 || this.globalConcurrency >= this.config.global.maxConcurrent) {
      await new Promise((resolve) => {
        this.waitQueue.push({ resolve, domain, addedAt: Date.now() });
      });

      this.refill(domain);
      this.refillGlobal();
    }

    bucket.tokens -= 1;
    this.globalBucket.tokens -= 1;
    this.globalConcurrency += 1;
  }

  release(domain: string, tokens = 1): void {
    this.globalConcurrency = Math.max(0, this.globalConcurrency - 1);
    
    const bucket = this.buckets.get(domain);
    if (bucket) {
      bucket.tokens = Math.min(
        this.limits.get(domain)?.burst || 5,
        bucket.tokens + tokens
      );
    }

    // Process waiting queue
    this.processQueue();
  }

  private processQueue(): void {
    const now = Date.now();
    this.waitQueue = this.waitQueue.filter((entry) => {
      const bucket = this.buckets.get(entry.domain);
      this.refill(entry.domain);
      this.refillGlobal();

      if (bucket && bucket.tokens >= 1 && this.globalBucket.tokens >= 1 && this.globalConcurrency < this.config.global.maxConcurrent) {
        entry.resolve();
        return false;
      }
      // Remove stale entries
      if (entry.addedAt < now - 10000) {
        entry.resolve();
        return false;
      }
      return true;
    });
  }

  async backoff(domain: string): Promise<void> {
    const limit = this.limits.get(domain);
    if (!limit) return;

    const cooldownMs = limit.cooldownMs || this.config.backoff.initialMs;
    this.cooldownUntil.set(domain, Date.now() + cooldownMs);

    // Clear tokens
    const bucket = this.buckets.get(domain);
    if (bucket) {
      bucket.tokens = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  reset(domain?: string): void {
    if (domain) {
      this.limits.delete(domain);
      this.buckets.delete(domain);
      this.cooldownUntil.delete(domain);
    } else {
      this.limits.clear();
      this.buckets.clear();
      this.cooldownUntil.clear();
      this.globalConcurrency = 0;
      this.globalBucket = {
        tokens: this.config.global.requestsPerSecond,
        lastRefill: Date.now(),
        pending: 0,
      };
    }
  }

  getRemaining(domain: string): number {
    const bucket = this.buckets.get(domain);
    if (!bucket) return -1;
    return Math.floor(bucket.tokens);
  }

  getStats(): {
    domains: { domain: string; remaining: number; inCooldown: boolean }[];
    global: { concurrency: number; remainingTokens: number };
  } {
    const domainStats: { domain: string; remaining: number; inCooldown: boolean }[] = [];
    
    for (const [domain, bucket] of this.buckets.entries()) {
      const cooldownUntil = this.cooldownUntil.get(domain);
      domainStats.push({
        domain,
        remaining: Math.floor(bucket.tokens),
        inCooldown: cooldownUntil ? Date.now() < cooldownUntil : false,
      });
    }

    return {
      domains: domainStats,
      global: {
        concurrency: this.globalConcurrency,
        remainingTokens: Math.floor(this.globalBucket.tokens),
      },
    };
  }
}

let limiter: AdvancedRateLimiter | null = null;

export function createAdvancedLimiter(config: RateLimitConfig = {}): AdvancedRateLimiter {
  limiter = new AdvancedRateLimiter(config);
  return limiter;
}

export function getAdvancedLimiter(): AdvancedRateLimiter | null {
  return limiter;
}

export function setAdvancedLimiter(newLimiter: AdvancedRateLimiter): void {
  limiter = newLimiter;
}
