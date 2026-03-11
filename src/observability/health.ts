import { getMetrics } from '../observability/metrics.js';
import { listJobs } from '../queue/jobQueue.js';
import { getBrowserRuntimeConfig } from '../fetch/browserRuntime.js';

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  metrics: ReturnType<typeof getMetrics>;
  browserRuntime: {
    mode: 'launch' | 'remote-cdp';
    attachOnly: boolean;
    profileName?: string;
    cdpConfigured: boolean;
  };
  queue: {
    totalJobs: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  summary: {
    workerAlive: number;
    proxyHealthy: number;
    proxyTotal: number;
  };
}

export function healthCheck(): HealthResponse {
  const metrics = getMetrics();
  const jobs = listJobs();
  const browserRuntime = getBrowserRuntimeConfig();

  const queue = {
    totalJobs: jobs.length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  const status: 'healthy' | 'degraded' = queue.failed > queue.totalJobs * 0.5 ? 'degraded' : 'healthy';

  return {
    status,
    timestamp: new Date().toISOString(),
    metrics,
    browserRuntime: {
      mode: browserRuntime.mode,
      attachOnly: browserRuntime.attachOnly,
      profileName: browserRuntime.profileName,
      cdpConfigured: Boolean(browserRuntime.cdpUrl),
    },
    queue,
    summary: {
      workerAlive: metrics.queue.workerAlive,
      proxyHealthy: metrics.proxies.healthy,
      proxyTotal: metrics.proxies.total,
    },
  };
}
