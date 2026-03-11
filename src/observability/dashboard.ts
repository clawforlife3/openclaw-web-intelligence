import { getMetrics } from './metrics.js';

export interface DashboardSnapshot {
  queue: ReturnType<typeof getMetrics>['queue'];
  proxies: ReturnType<typeof getMetrics>['proxies'];
  topDomains: Array<{ domain: string; success: number; blocked: number; avgLatencyMs: number; browserFallbacks: number }>;
  retryDistribution: Record<string, number>;
}

export function getDashboardSnapshot(limit = 5): DashboardSnapshot {
  const metrics = getMetrics();
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
    topDomains,
    retryDistribution: metrics.retryDistribution,
  };
}
