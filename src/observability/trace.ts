import { generateTraceId } from '../types/utils.js';

export function ensureTraceId(traceId?: string): string {
  return traceId || generateTraceId();
}

export function getDomainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
