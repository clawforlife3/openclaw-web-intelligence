import { getCache } from '../storage/cache.js';
import type { CacheOptions } from '../types/schemas.js';
import type { StaticFetchResult } from '../fetch/staticFetcher.js';
import { makePageCacheKey } from './cacheKeys.js';

export interface PageValidators {
  etag?: string;
  lastModified?: string;
}

export interface PageCacheRecord {
  fetchResult: StaticFetchResult;
  validators: PageValidators;
  updatedAt: string;
}

function extractValidators(fetchResult: StaticFetchResult): PageValidators {
  return {
    etag: fetchResult.headers.etag,
    lastModified: fetchResult.headers['last-modified'],
  };
}

export class PageCache {
  private cache;

  constructor(options: CacheOptions = { enabled: true, ttlSeconds: 3600 }) {
    this.cache = getCache(options);
  }

  get(url: string): PageCacheRecord | null {
    return this.cache.get(makePageCacheKey(url)) as PageCacheRecord | null;
  }

  set(url: string, fetchResult: StaticFetchResult): void {
    const record: PageCacheRecord = {
      fetchResult,
      validators: extractValidators(fetchResult),
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(makePageCacheKey(url), record);
  }
}
