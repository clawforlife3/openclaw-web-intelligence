import { describe, expect, it } from 'vitest';
import { createRedisQueue } from '../src/queue/redisQueue.js';

const redisUrl = process.env.REDIS_TEST_URL;
const integration = redisUrl ? describe : describe.skip;

function queueName(): string {
  return `redis-it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

integration('RedisQueue multi-worker integration', () => {
  it('ensures two workers do not process the same job', async () => {
    const name = queueName();
    const q1 = createRedisQueue({ redisUrl, queueName: name, workerId: 'worker-a', heartbeatInterval: 500, jobTtlSeconds: 60 });
    const q2 = createRedisQueue({ redisUrl, queueName: name, workerId: 'worker-b', heartbeatInterval: 500, jobTtlSeconds: 60 });

    await q1.enqueue({ jobId: 'job-1', urls: ['https://example.com'], config: {} });
    const [a, b] = await Promise.all([q1.dequeue(), q2.dequeue()]);

    expect([a?.jobId, b?.jobId].filter(Boolean)).toEqual(['job-1']);

    await q1.cleanup();
    await q2.cleanup();
  });
});
