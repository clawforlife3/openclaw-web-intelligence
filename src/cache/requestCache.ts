import { getCache } from '../storage/cache.js';
import type { CacheOptions } from '../types/schemas.js';
import { makeRequestCacheKey } from './cacheKeys.js';

export class RequestCache<TValue> {
  private cache;

  constructor(private prefix: string, options: CacheOptions = { enabled: true, ttlSeconds: 3600 }) {
    this.cache = getCache(options);
  }

  get(request: Record<string, unknown>): TValue | null {
    return this.cache.get(makeRequestCacheKey(this.prefix, request)) as TValue | null;
  }

  set(request: Record<string, unknown>, value: TValue): void {
    this.cache.set(makeRequestCacheKey(this.prefix, request), value);
  }
}
