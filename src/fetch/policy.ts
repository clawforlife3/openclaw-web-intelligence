import { getProxyPool, type Proxy } from '../proxy/pool.js';
import { getSessionStore } from '../anti-bot/sessionStore.js';

export interface UnifiedFetchPolicyInput {
  url: string;
  timeoutMs: number;
  retryMax: number;
  userAgent: string;
  proxyUrl?: string;
  strategy: 'static' | 'browser';
}

export interface UnifiedFetchPolicy {
  timeoutMs: number;
  retryMax: number;
  userAgent: string;
  proxyUrl?: string;
  proxy?: Proxy | null;
  cookieHeader?: string;
  strategy: 'static' | 'browser';
}

export function buildFetchPolicy(input: UnifiedFetchPolicyInput): UnifiedFetchPolicy {
  let proxy: Proxy | null = null;
  let proxyUrl = input.proxyUrl;
  if (!proxyUrl) {
    const pool = getProxyPool();
    if (pool) {
      proxy = pool.getProxy();
      proxyUrl = proxy?.url;
    }
  }

  const store = getSessionStore();
  return {
    timeoutMs: input.timeoutMs,
    retryMax: input.retryMax,
    userAgent: input.userAgent,
    proxyUrl,
    proxy,
    cookieHeader: store?.getCookieHeader(input.url),
    strategy: input.strategy,
  };
}

export function getOutcome(success: boolean, strategy: 'static' | 'browser', retried = false): 'success_static' | 'success_browser' | 'success_retry' | 'failed_static' | 'failed_browser' {
  if (success) {
    if (retried) return 'success_retry';
    return strategy === 'browser' ? 'success_browser' : 'success_static';
  }
  return strategy === 'browser' ? 'failed_browser' : 'failed_static';
}
