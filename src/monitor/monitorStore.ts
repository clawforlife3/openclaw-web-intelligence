import { getCache } from '../storage/cache.js';
import type { MonitorRequest, MonitorSnapshot } from '../types/schemas.js';

export interface StoredMonitorJob {
  monitorJobId: string;
  request: MonitorRequest;
  snapshot?: MonitorSnapshot;
  history?: MonitorSnapshot[];
  lastCheckedAt?: string;
  createdAt?: string;
}

const JOB_INDEX_KEY = 'monitor:jobs';

function getCacheStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeMonitorKey(target: string): string {
  return `monitor:${target}`;
}

export function loadMonitorJob(target: string): StoredMonitorJob | null {
  const cache = getCacheStore();
  const key = makeMonitorKey(target);
  return cache.get(key) as StoredMonitorJob | null;
}

export function saveMonitorJob(target: string, job: StoredMonitorJob): void {
  const cache = getCacheStore();
  const key = makeMonitorKey(target);
  cache.set(key, job);

  const index = (cache.get(JOB_INDEX_KEY) as string[] | null) ?? [];
  if (!index.includes(target)) {
    index.push(target);
    cache.set(JOB_INDEX_KEY, index);
  }
}

export function listMonitorJobs(): StoredMonitorJob[] {
  const cache = getCacheStore();
  const index = (cache.get(JOB_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((target) => loadMonitorJob(target))
    .filter((job): job is StoredMonitorJob => !!job);
}

export function deleteMonitorJob(target: string): void {
  const cache = getCacheStore();
  const key = makeMonitorKey(target);
  cache.delete(key);

  const index = (cache.get(JOB_INDEX_KEY) as string[] | null) ?? [];
  cache.set(JOB_INDEX_KEY, index.filter((t) => t !== target));
}

export function appendHistory(job: StoredMonitorJob, snapshot: MonitorSnapshot, maxHistory = 10): StoredMonitorJob {
  const history = job.history ?? [];
  history.push(snapshot);
  if (history.length > maxHistory) {
    history.shift();
  }
  return {
    ...job,
    history,
  };
}
