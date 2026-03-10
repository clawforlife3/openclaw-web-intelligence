import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CacheOptions, type CacheEntry, type CacheStats } from '../types/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = __dirname.replace('/src/storage', '/.cache');

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
  return `${CACHE_DIR}/${safeKey}.json`;
}

export class Cache {
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };

  constructor(private options: CacheOptions = { enabled: true, ttlSeconds: 3600 }) {}

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) return false;
    return new Date(entry.expiresAt) < new Date();
  }

  get(key: string): unknown | null {
    if (!this.options.enabled) return null;

    const path = getCachePath(key);
    if (!existsSync(path)) {
      this.stats.misses += 1;
      return null;
    }

    try {
      const content = readFileSync(path, 'utf8');
      const entry: CacheEntry = JSON.parse(content);

      if (this.isExpired(entry)) {
        this.stats.misses += 1;
        return null;
      }

      this.stats.hits += 1;
      return entry.value;
    } catch {
      this.stats.misses += 1;
      return null;
    }
  }

  set(key: string, value: unknown): void {
    if (!this.options.enabled) return;

    ensureCacheDir();
    const path = getCachePath(key);

    const entry: CacheEntry = {
      key,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: this.options.ttlSeconds > 0
        ? new Date(Date.now() + this.options.ttlSeconds * 1000).toISOString()
        : undefined,
    };

    writeFileSync(path, JSON.stringify(entry, null, 2), 'utf8');
  }

  delete(key: string): void {
    const path = getCachePath(key);
    if (existsSync(path)) {
      import('node:fs').then((fs) => fs.unlinkSync(path));
    }
  }

  clear(): void {
    ensureCacheDir();
    const { readdirSync, unlinkSync } = require('node:fs');
    try {
      const files = readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          unlinkSync(`${CACHE_DIR}/${file}`);
        }
      }
    } catch {
      // ignore
    }
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }
}

// Global cache instance
let globalCache: Cache | null = null;

export function getCache(options?: CacheOptions): Cache {
  if (!globalCache) {
    globalCache = new Cache(options);
  }
  return globalCache;
}

// Utility: generate cache key from request
export function makeCacheKey(prefix: string, request: Record<string, unknown>): string {
  const normalized = JSON.stringify(request, Object.keys(request).sort());
  const hash = Buffer.from(normalized).toString('base64').slice(0, 32);
  return `${prefix}_${hash}`;
}
