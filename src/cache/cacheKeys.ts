import { createHash } from 'node:crypto';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function makeRequestCacheKey(prefix: string, request: Record<string, unknown>): string {
  const normalized = stableStringify(request);
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  return `req:${prefix}:${hash}`;
}

export function makePageCacheKey(url: string): string {
  return `page:${url}`;
}
