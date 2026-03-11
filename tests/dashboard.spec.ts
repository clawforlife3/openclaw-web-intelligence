import { beforeEach, describe, expect, it } from 'vitest';
import { getDashboardSnapshot } from '../src/observability/dashboard.js';
import { recordDomainOutcome, resetMetrics, setProxyMetrics, setQueueMetrics } from '../src/observability/metrics.js';

describe('dashboard snapshot', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('summarizes queue, proxies, and top domains', () => {
    setQueueMetrics({ depth: 5, processing: 2 });
    setProxyMetrics({ total: 2, healthy: 1, unhealthy: 1 });
    recordDomainOutcome({ domain: 'a.com', success: true, latencyMs: 100 });
    recordDomainOutcome({ domain: 'b.com', blocked: true, latencyMs: 250, browserFallback: true });

    const snapshot = getDashboardSnapshot();
    expect(snapshot.queue.depth).toBe(5);
    expect(snapshot.proxies.total).toBe(2);
    expect(snapshot.topDomains).toHaveLength(2);
  });
});
