import { Redis } from 'ioredis';

export interface CrawlJob {
  jobId: string;
  urls: string[];
  config: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  workerId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface DistributedQueueConfig {
  redisUrl: string;
  queueName: string;
  workerId: string;
  heartbeatInterval: number;
  jobTtlSeconds: number;
}

const DEFAULT_CONFIG: Required<DistributedQueueConfig> = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  queueName: 'crawl-jobs',
  workerId: `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  heartbeatInterval: 30000,
  jobTtlSeconds: 3600,
};

export class RedisQueue {
  private redis: Redis;
  private config: Required<DistributedQueueConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<DistributedQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redis = new Redis(this.config.redisUrl);
  }

  async enqueue(job: Omit<CrawlJob, 'status' | 'createdAt'>): Promise<string> {
    const fullJob: CrawlJob = {
      ...job,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    await this.redis.lpush(
      `queue:${this.config.queueName}`,
      JSON.stringify(fullJob)
    );

    return fullJob.jobId;
  }

  async dequeue(): Promise<CrawlJob | null> {
    const sourceQueue = `queue:${this.config.queueName}`;
    const processingQueue = `processing:${this.config.queueName}:${this.config.workerId}`;

    // Pop raw job payload from source queue
    const raw = await this.redis.brpop(sourceQueue, 5);
    if (!raw) return null;

    const [, jobJson] = raw;
    const job: CrawlJob = JSON.parse(jobJson);
    job.status = 'processing';
    job.workerId = this.config.workerId;
    job.startedAt = new Date().toISOString();

    // Store normalized job details and track only jobId in processing queue
    await this.redis.setex(
      `job:${job.jobId}`,
      this.config.jobTtlSeconds,
      JSON.stringify(job)
    );
    await this.redis.lpush(processingQueue, job.jobId);

    return job;
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    const jobKey = `job:${jobId}`;
    const jobJson = await this.redis.get(jobKey);
    
    if (!jobJson) return;

    const job: CrawlJob = JSON.parse(jobJson);
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.result = result;

    // Move to completed queue
    await this.redis.lpush(
      `completed:${this.config.queueName}`,
      JSON.stringify(job)
    );

    // Remove from processing
    await this.redis.lrem(
      `processing:${this.config.queueName}:${this.config.workerId}`,
      0,
      JSON.stringify({ jobId })
    );

    // Clean up job key
    await this.redis.del(jobKey);
  }

  async fail(jobId: string, error: string): Promise<void> {
    const jobKey = `job:${jobId}`;
    const jobJson = await this.redis.get(jobKey);
    
    if (!jobJson) return;

    const job: CrawlJob = JSON.parse(jobJson);
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error;

    // Move to failed queue
    await this.redis.lpush(
      `failed:${this.config.queueName}`,
      JSON.stringify(job)
    );

    // Remove from processing
    await this.redis.lrem(
      `processing:${this.config.queueName}:${this.config.workerId}`,
      0,
      JSON.stringify({ jobId })
    );

    // Clean up job key
    await this.redis.del(jobKey);
  }

  async getJob(jobId: string): Promise<CrawlJob | null> {
    const jobJson = await this.redis.get(`job:${jobId}`);
    return jobJson ? JSON.parse(jobJson) : null;
  }

  async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [queued, completed, failed] = await Promise.all([
      this.redis.llen(`queue:${this.config.queueName}`),
      this.redis.llen(`completed:${this.config.queueName}`),
      this.redis.llen(`failed:${this.config.queueName}`),
    ]);

    // Count processing jobs across all workers
    const keys = await this.redis.keys(`processing:${this.config.queueName}:*`);
    let processing = 0;
    for (const k of keys) {
      processing += await this.redis.llen(k);
    }

    return { queued, processing, completed, failed };
  }

  async register(): Promise<void> {
    // Register worker
    await this.redis.sadd(
      `workers:${this.config.queueName}`,
      this.config.workerId
    );
    await this.redis.expire(
      `workers:${this.config.queueName}`,
      this.config.heartbeatInterval * 2 / 1000
    );
  }

  async heartbeat(): Promise<void> {
    await this.register();
    
    // Update worker last seen
    await this.redis.set(
      `worker:lastseen:${this.config.workerId}`,
      Date.now().toString()
    );
  }

  startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    
    this.heartbeat();
    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      this.config.heartbeatInterval
    );
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async getWorkers(): Promise<string[]> {
    return this.redis.smembers(`workers:${this.config.queueName}`);
  }

  async cleanup(): Promise<void> {
    this.stopHeartbeat();
    
    // Remove worker from registry
    await this.redis.srem(
      `workers:${this.config.queueName}`,
      this.config.workerId
    );

    // Close Redis connection
    await this.redis.quit();
  }
}

let queue: RedisQueue | null = null;

export function createRedisQueue(config?: Partial<DistributedQueueConfig>): RedisQueue {
  queue = new RedisQueue(config);
  return queue;
}

export function getRedisQueue(): RedisQueue | null {
  return queue;
}

export function setRedisQueue(newQueue: RedisQueue): void {
  queue = newQueue;
}
