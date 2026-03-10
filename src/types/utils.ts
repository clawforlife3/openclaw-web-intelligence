import { randomBytes } from 'node:crypto';

export function generateRequestId(): string {
  return `req_${randomBytes(8).toString('hex')}`;
}

export function generateTraceId(): string {
  return `trace_${randomBytes(8).toString('hex')}`;
}

export function generateJobId(): string {
  return `job_${randomBytes(8).toString('hex')}`;
}

export function generateCacheKey(prefix: string, request: Record<string, unknown>): string {
  const normalized = JSON.stringify(request, Object.keys(request).sort());
  const hash = Buffer.from(normalized).toString('base64').slice(0, 32);
  return `${prefix}_${hash}`;
}
