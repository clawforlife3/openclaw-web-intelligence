interface MetricsSnapshot {
  monitorRuns: number;
  monitorChanges: number;
  alertsSent: number;
  crawlRuns: number;
  extractRuns: number;
  lastUpdated: string;
}

const metrics: MetricsSnapshot = {
  monitorRuns: 0,
  monitorChanges: 0,
  alertsSent: 0,
  crawlRuns: 0,
  extractRuns: 0,
  lastUpdated: new Date().toISOString(),
};

export function incrementMetric(key: keyof MetricsSnapshot, delta = 1): void {
  // @ts-expect-error index
  metrics[key] += delta;
  metrics.lastUpdated = new Date().toISOString();
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
  metrics.lastUpdated = new Date().toISOString();
}
