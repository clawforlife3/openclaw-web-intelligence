import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRedisQueue, type RedisQueue } from '../src/queue/redisQueue.js';

const REDIS_URL = process.env.REDIS_URL;
const integration = REDIS_URL ? describe : describe.skip;

function uniqueQueueName(prefix = 'test-crawl-jobs'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function clearQueueState(queue: RedisQueue, queueName: string): Promise<void> {
  // Best-effort cleanup for test-created keys.
  const redis = (queue as unknown as { redis: { keys: (pattern: string) => Promise<string[]>; del: (...keys: string[]) => Promise<number> } }).redis;
  const keys = await redis.keys(`*${queueName}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

describe('RedisQueue configuration', () => {
  it('allows custom config values', () => {
    const config = {
      queueName: 'test-queue',
      workerId: 'test-worker',
      redisUrl: 'redis://localhost:6379',
    };

    expect(config.queueName).toBe('test-queue');
    expect(config.workerId).toBe('test-worker');
  });
});

integration('RedisQueue integration', () => {
  let queueName: string;
  let queue: RedisQueue;

  beforeEach(() => {
    queueName = uniqueQueueName();
    queue = createRedisQueue({
      redisUrl: REDIS_URL,
      queueName,
      workerId: `worker-${Math.random().toString(36).slice(2, 8)}`,
      heartbeatInterval: 1000,
      jobTtlSeconds: 60,
    });
  });

  afterEach(async () => {
    await clearQueueState(queue, queueName);
    await queue.cleanup();
  });

  it('runs enqueue -> dequeue -> complete lifecycle', async () => {
    const jobId = await queue.enqueue({
      jobId: 'job-1',
      urls: ['https://example.com'],
      config: { maxDepth: 1, limit: 10 },
    });

    expect(jobId).toBe('job-1');

    const dequeued = await queue.dequeue();
    expect(dequeued?.jobId).toBe('job-1');
    expect(dequeued?.status).toBe('processing');
    expect(dequeued?.workerId).toBeTruthy();

    let stats = await queue.getQueueStats();
    expect(stats.queued).toBe(0);
    expect(stats.processing).toBe(1);

    await queue.complete('job-1', { ok: true });

    stats = await queue.getQueueStats();
    expect(stats.processing).toBe(0);
    expect(stats.completed).toBe(1);

    const job = await queue.getJob('job-1');
    expect(job).toBeNull();
  });

  it('runs enqueue -> dequeue -> fail lifecycle', async () => {
    await queue.enqueue({
      jobId: 'job-2',
      urls: ['https://example.com/fail'],
      config: { maxDepth: 1 },
    });

    const dequeued = await queue.dequeue();
    expect(dequeued?.jobId).toBe('job-2');

    await queue.fail('job-2', 'boom');

    const stats = await queue.getQueueStats();
    expect(stats.processing).toBe(0);
    expect(stats.failed).toBe(1);
  });

  it('registers and lists workers via heartbeat', async () => {
    await queue.register();
    const workers = await queue.getWorkers();
    expect(workers.length).toBeGreaterThan(0);
  });

  it('reclaims stale processing jobs back to queue', async () => {
    await queue.enqueue({
      jobId: 'job-3',
      urls: ['https://example.com/stale'],
      config: { limit: 1 },
    });

    const dequeued = await queue.dequeue();
    expect(dequeued?.jobId).toBe('job-3');

    // Force stale startedAt in persisted job
    const redis = (queue as unknown as { redis: { setex: (key: string, ttl: number, value: string) => Promise<unknown> } }).redis;
    const staleJob = {
      ...dequeued!,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    await redis.setex('job:job-3', 60, JSON.stringify(staleJob));

    const reclaimed = await queue.reclaimStaleJobs(1000);
    expect(reclaimed).toContain('job-3');

    const stats = await queue.getQueueStats();
    expect(stats.processing).toBe(0);
    expect(stats.queued).toBe(1);
  });
});
