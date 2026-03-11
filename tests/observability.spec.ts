import { describe, expect, it, beforeEach } from 'vitest';
import {
  getMetrics,
  incrementMetric,
  recordDomainOutcome,
  resetMetrics,
  setProxyMetrics,
  setQueueMetrics,
} from '../src/observability/metrics.js';
import { healthCheck } from '../src/observability/health.js';
import { resetBrowserRuntimeConfig, setBrowserRuntimeConfig } from '../src/fetch/browserRuntime.js';

describe('observability metrics', () => {
  beforeEach(() => {
    resetMetrics();
    resetBrowserRuntimeConfig();
  });

  it('records per-domain success, latency, and retry distribution', () => {
    recordDomainOutcome({
      domain: 'example.com',
      success: true,
      latencyMs: 120,
      retryReason: 'low_confidence',
      browserFallback: true,
    });

    const metrics = getMetrics();
    expect(metrics.domains['example.com']).toMatchObject({
      success: 1,
      retries: 1,
      browserFallbacks: 1,
    });
    expect(metrics.domains['example.com']?.avgLatencyMs).toBe(120);
    expect(metrics.retryDistribution.low_confidence).toBe(1);
  });

  it('exposes queue and proxy summary in health response', () => {
    incrementMetric('extractRuns');
    setQueueMetrics({ depth: 3, processing: 1, workerAlive: 2 });
    setProxyMetrics({ total: 4, healthy: 3, unhealthy: 1 });
    setBrowserRuntimeConfig({
      mode: 'remote-cdp',
      cdpUrl: 'http://127.0.0.1:9222',
      attachOnly: true,
      profileName: 'windows-default',
    });

    const response = healthCheck();
    expect(response.metrics.extractRuns).toBe(1);
    expect(response.browserRuntime).toEqual({
      mode: 'remote-cdp',
      attachOnly: true,
      profileName: 'windows-default',
      cdpConfigured: true,
    });
    expect(response.summary).toEqual({
      workerAlive: 2,
      proxyHealthy: 3,
      proxyTotal: 4,
    });
  });
});
