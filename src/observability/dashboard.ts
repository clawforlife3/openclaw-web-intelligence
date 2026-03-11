import { getMetrics } from './metrics.js';
import { getBrowserRuntimeConfig } from '../fetch/browserRuntime.js';

export interface DashboardSnapshot {
  queue: ReturnType<typeof getMetrics>['queue'];
  proxies: ReturnType<typeof getMetrics>['proxies'];
  browserRuntime: {
    mode: 'launch' | 'remote-cdp';
    attachOnly: boolean;
    cdpConfigured: boolean;
  };
  topDomains: Array<{ domain: string; success: number; blocked: number; avgLatencyMs: number; browserFallbacks: number }>;
  retryDistribution: Record<string, number>;
}

export function getDashboardSnapshot(limit = 5): DashboardSnapshot {
  const metrics = getMetrics();
  const browserRuntime = getBrowserRuntimeConfig();
  const topDomains = Object.entries(metrics.domains)
    .sort((a, b) => (b[1].success + b[1].blocked) - (a[1].success + a[1].blocked))
    .slice(0, limit)
    .map(([domain, stats]) => ({
      domain,
      success: stats.success,
      blocked: stats.blocked,
      avgLatencyMs: Math.round(stats.avgLatencyMs),
      browserFallbacks: stats.browserFallbacks,
    }));

  return {
    queue: metrics.queue,
    proxies: metrics.proxies,
    browserRuntime: {
      mode: browserRuntime.mode,
      attachOnly: browserRuntime.attachOnly,
      cdpConfigured: Boolean(browserRuntime.cdpUrl),
    },
    topDomains,
    retryDistribution: metrics.retryDistribution,
  };
}
