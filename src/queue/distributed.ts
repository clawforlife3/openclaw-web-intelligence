import { createHash } from 'node:crypto';

export interface WorkerConfig {
  workerId: string;
  totalWorkers: number;
}

const DEFAULT_WORKER: WorkerConfig = {
  workerId: 'default',
  totalWorkers: 1,
};

let currentWorker: WorkerConfig = DEFAULT_WORKER;

export function setWorker(config: WorkerConfig): void {
  currentWorker = config;
}

export function getWorker(): WorkerConfig {
  return currentWorker;
}

/**
 * Shard a URL to a specific worker based on hash
 */
export function shardUrl(url: string, totalWorkers: number): number {
  const hash = createHash('md5').update(url).digest('hex');
  return parseInt(hash.slice(0, 8), 16) % totalWorkers;
}

/**
 * Check if this worker should process a given URL
 */
export function shouldProcessUrl(url: string): boolean {
  if (currentWorker.totalWorkers === 1) return true;
  const shard = shardUrl(url, currentWorker.totalWorkers);
  return shard === parseInt(currentWorker.workerId.replace('worker_', ''), 10) % currentWorker.totalWorkers;
}

/**
 * Partition URLs across workers
 */
export function partitionUrls(urls: string[], totalWorkers: number): string[][] {
  const buckets: string[][] = Array.from({ length: totalWorkers }, () => []);
  for (const url of urls) {
    const shard = shardUrl(url, totalWorkers);
    buckets[shard].push(url);
  }
  return buckets;
}
