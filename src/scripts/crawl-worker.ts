#!/usr/bin/env node

/**
 * Crawl Worker Script
 * 
 * Usage:
 *   node scripts/crawl-worker.js --redis-url redis://localhost:6379 --queue crawl-jobs
 * 
 * Environment variables:
 *   REDIS_URL - Redis connection URL
 *   WORKER_ID - Optional worker identifier
 */

import { createRedisQueue } from '../queue/redisQueue.js';
import { crawl } from '../engines/crawl/crawler.js';
import { createProxyPool } from '../proxy/pool.js';
import { createEvasionManager } from '../anti-bot/evasion.js';
import { createAdvancedLimiter } from '../ratelimit/advanced.js';

interface WorkerOptions {
  redisUrl?: string;
  queueName?: string;
  workerId?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const options: WorkerOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--redis-url' && args[i + 1]) {
      options.redisUrl = args[i + 1];
      i++;
    } else if (args[i] === '--queue' && args[i + 1]) {
      options.queueName = args[i + 1];
      i++;
    } else if (args[i] === '--worker-id' && args[i + 1]) {
      options.workerId = args[i + 1];
      i++;
    }
  }

  console.log('Starting Crawl Worker...');
  console.log('Options:', options);

  // Initialize components
  const proxyPool = createProxyPool({
    proxies: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [],
    strategy: 'round-robin',
  });
  console.log('Proxy pool initialized:', proxyPool.getStats());

  const evasionManager = createEvasionManager({
    minDelayMs: parseInt(process.env.MIN_DELAY_MS || '3000'),
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '10000'),
  });
  console.log('Evasion manager initialized');

  const rateLimiter = createAdvancedLimiter({
    domains: {
      '*': {
        requestsPerSecond: parseInt(process.env.RPS || '2'),
        burst: parseInt(process.env.BURST || '5'),
        cooldownMs: parseInt(process.env.COOLDOWN_MS || '30000'),
      },
    },
    global: {
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '5'),
      requestsPerSecond: parseInt(process.env.GLOBAL_RPS || '10'),
    },
  });
  console.log('Rate limiter initialized');

  // Create Redis queue
  const queue = createRedisQueue({
    redisUrl: options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    queueName: options.queueName || 'crawl-jobs',
    workerId: options.workerId,
    heartbeatInterval: 30000,
    jobTtlSeconds: 3600,
  });

  console.log('Redis queue initialized');
  await queue.register();
  queue.startHeartbeat();

  console.log('Worker started, waiting for jobs...');

  // Process loop
  while (true) {
    try {
      const job = await queue.dequeue();
      
      if (!job) {
        continue;
      }

      console.log(`Processing job: ${job.jobId}`);
      console.log('URLs:', job.urls.length);
      console.log('Config:', job.config);

      try {
        // Execute crawl
        const result = await crawl({
          seedUrl: job.urls[0],
          maxDepth: (job.config.maxDepth as number) || 2,
          limit: (job.config.limit as number) || 50,
          ...job.config,
        });

        // Complete job
        await queue.complete(job.jobId, result);
        console.log(`Job ${job.jobId} completed successfully`);
      } catch (error) {
        // Fail job
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Job ${job.jobId} failed:`, errorMessage);
        await queue.fail(job.jobId, errorMessage);
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
