export interface DomainMetrics {
  success: number;
  blocked: number;
  retries: number;
  avgLatencyMs: number;
  browserFallbacks: number;
}

export interface QueueMetrics {
  depth: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  workerAlive: number;
}

export interface ProxyMetrics {
  total: number;
  healthy: number;
  unhealthy: number;
  selected: number;
  failures: number;
  recovered: number;
}

export interface MetricsSnapshot {
  monitorRuns: number;
  monitorChanges: number;
  alertsSent: number;
  crawlRuns: number;
  extractRuns: number;
  searchRuns: number;
  queue: QueueMetrics;
  proxies: ProxyMetrics;
  retryDistribution: Record<string, number>;
  domains: Record<string, DomainMetrics>;
  lastUpdated: string;
}

const metrics: MetricsSnapshot = {
  monitorRuns: 0,
  monitorChanges: 0,
  alertsSent: 0,
  crawlRuns: 0,
  extractRuns: 0,
  searchRuns: 0,
  queue: {
    depth: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
    workerAlive: 0,
  },
  proxies: {
    total: 0,
    healthy: 0,
    unhealthy: 0,
    selected: 0,
    failures: 0,
    recovered: 0,
  },
  retryDistribution: {},
  domains: {},
  lastUpdated: new Date().toISOString(),
};

function touch(): void {
  metrics.lastUpdated = new Date().toISOString();
}

function getOrCreateDomainMetrics(domain: string): DomainMetrics {
  metrics.domains[domain] ??= {
    success: 0,
    blocked: 0,
    retries: 0,
    avgLatencyMs: 0,
    browserFallbacks: 0,
  };

  return metrics.domains[domain];
}

export function incrementMetric(key: keyof MetricsSnapshot, delta = 1): void {
  // @ts-expect-error index
  metrics[key] += delta;
  touch();
}

export function recordDomainOutcome(input: {
  domain?: string;
  latencyMs?: number;
  blocked?: boolean;
  browserFallback?: boolean;
  retryReason?: string;
  success?: boolean;
}): void {
  if (!input.domain) {
    if (input.retryReason) {
      metrics.retryDistribution[input.retryReason] = (metrics.retryDistribution[input.retryReason] ?? 0) + 1;
      touch();
    }
    return;
  }

  const domainMetrics = getOrCreateDomainMetrics(input.domain);
  if (input.success) {
    domainMetrics.success += 1;
  }
  if (input.blocked) {
    domainMetrics.blocked += 1;
  }
  if (input.browserFallback) {
    domainMetrics.browserFallbacks += 1;
  }
  if (input.retryReason) {
    domainMetrics.retries += 1;
    metrics.retryDistribution[input.retryReason] = (metrics.retryDistribution[input.retryReason] ?? 0) + 1;
  }
  if (typeof input.latencyMs === 'number') {
    const samples = domainMetrics.success + domainMetrics.blocked;
    domainMetrics.avgLatencyMs = samples <= 1
      ? input.latencyMs
      : ((domainMetrics.avgLatencyMs * (samples - 1)) + input.latencyMs) / samples;
  }
  touch();
}

export function setQueueMetrics(snapshot: Partial<QueueMetrics>): void {
  metrics.queue = {
    ...metrics.queue,
    ...snapshot,
  };
  touch();
}

export function setProxyMetrics(snapshot: Partial<ProxyMetrics>): void {
  metrics.proxies = {
    ...metrics.proxies,
    ...snapshot,
  };
  touch();
}

export function incrementProxyMetric(key: 'selected' | 'failures' | 'recovered', delta = 1): void {
  metrics.proxies[key] += delta;
  touch();
}

export function getMetrics(): MetricsSnapshot {
  return { ...metrics };
}

export function resetMetrics(): void {
  metrics.monitorRuns = 0;
  metrics.monitorChanges = 0;
  metrics.alertsSent = 0;
  metrics.crawlRuns = 0;
  metrics.extractRuns = 0;
  metrics.searchRuns = 0;
  metrics.queue = {
    depth: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
    workerAlive: 0,
  };
  metrics.proxies = {
    total: 0,
    healthy: 0,
    unhealthy: 0,
    selected: 0,
    failures: 0,
    recovered: 0,
  };
  metrics.retryDistribution = {};
  metrics.domains = {};
  touch();
}
