/**
 * Lightweight per-domain rate limiting for research crawler.
 * Provides basic concurrency and interval controls to prevent overwhelming target sites.
 */

interface RateLimitConfig {
  maxConcurrent: number;   // Max concurrent requests per host
  minIntervalMs: number;  // Min interval between requests
}

interface DomainState {
  lastRequestTime: number;
  activeRequests: number;
  queue: Array<() => void>;
}

interface RateLimitStore {
  [domain: string]: DomainState;
}

// Default configuration
const defaultConfig: RateLimitConfig = {
  maxConcurrent: 3,
  minIntervalMs: 1000, // 1 second between requests
};

const store: RateLimitStore = {};

// Custom configs per domain
const customConfigs: Map<string, RateLimitConfig> = new Map();

function normalizeDomain(urlOrHost: string): string {
  try {
    const url = new URL(urlOrHost);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlOrHost.replace(/^www\./, '').toLowerCase();
  }
}

function getConfig(host: string): RateLimitConfig {
  return customConfigs.get(host) || defaultConfig;
}

export function setRateLimitConfig(host: string, config: Partial<RateLimitConfig>): void {
  const normalized = normalizeDomain(host);
  const current = getConfig(normalized);
  customConfigs.set(normalized, { ...current, ...config });
}

export function clearRateLimitConfig(host?: string): void {
  if (host) {
    customConfigs.delete(normalizeDomain(host));
  } else {
    customConfigs.clear();
  }
}

export function getRateLimitStats(): { domain: string; activeRequests: number; queueLength: number }[] {
  return Object.entries(store).map(([domain, state]) => ({
    domain,
    activeRequests: state.activeRequests,
    queueLength: state.queue.length,
  }));
}

function getOrCreateState(host: string): DomainState {
  const normalized = normalizeDomain(host);
  if (!store[normalized]) {
    store[normalized] = {
      lastRequestTime: 0,
      activeRequests: 0,
      queue: [],
    };
  }
  return store[normalized];
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquireRateLimitToken(url: string): Promise<() => void> {
  const host = normalizeDomain(url);
  const config = getConfig(host);
  const state = getOrCreateState(host);

  return new Promise((resolve) => {
    const tryAcquire = () => {
      const now = Date.now();
      const timeSinceLastRequest = now - state.lastRequestTime;
      const canStartNew = state.activeRequests < config.maxConcurrent && timeSinceLastRequest >= config.minIntervalMs;

      if (canStartNew) {
        state.activeRequests++;
        state.lastRequestTime = now;
        resolve(() => {
          state.activeRequests--;
          // Process queue
          const next = state.queue.shift();
          if (next) {
            next();
          }
        });
      } else {
        // Wait and retry
        const waitTime = Math.max(
          config.minIntervalMs - timeSinceLastRequest,
          0
        );
        setTimeout(tryAcquire, Math.min(waitTime, 100)); // Check every 100ms
      }
    };

    if (state.activeRequests < config.maxConcurrent) {
      tryAcquire();
    } else {
      // Queue the request
      state.queue.push(tryAcquire);
    }
  });
}

export function isRateLimited(host: string): boolean {
  const state = store[normalizeDomain(host)];
  if (!state) return false;
  return state.activeRequests >= getConfig(host).maxConcurrent || state.queue.length > 0;
}
