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
import { createSessionStore } from '../anti-bot/sessionStore.js';
import { createAdvancedLimiter } from '../ratelimit/advanced.js';
import { logError, logInfo, logWarn } from '../observability/logger.js';
import { setQueueMetrics } from '../observability/metrics.js';
import { generateTraceId } from '../types/utils.js';
import { initializeBrowserRuntimeConfigFromEnv } from '../fetch/browserRuntime.js';

interface WorkerOptions {
  redisUrl?: string;
  queueName?: string;
  workerId?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const options: WorkerOptions = {};
  let shuttingDown = false;
  const workerTraceId = generateTraceId();
  
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

  logInfo('worker.starting', 'Starting crawl worker', {
    traceId: workerTraceId,
    workerId: options.workerId,
    options,
  });

  const browserRuntime = initializeBrowserRuntimeConfigFromEnv();
  logInfo('worker.browser_runtime_ready', 'Browser runtime initialized', {
    traceId: workerTraceId,
    workerId: options.workerId,
    browserRuntime,
  });

  // Initialize components
  const proxyPool = createProxyPool({
    proxies: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [],
    strategy: 'round-robin',
  });
  logInfo('worker.proxy_pool_ready', 'Proxy pool initialized', {
    traceId: workerTraceId,
    proxyStats: proxyPool.getStats(),
  });

  const evasionManager = createEvasionManager({
    minDelayMs: parseInt(process.env.MIN_DELAY_MS || '3000'),
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '10000'),
  });
  logInfo('worker.evasion_ready', 'Evasion manager initialized', { traceId: workerTraceId });

  createSessionStore({
    baseDir: process.env.SESSION_STORE_DIR || '.openclaw-sessions',
    ttlMs: parseInt(process.env.SESSION_TTL_MS || `${30 * 60 * 1000}`, 10),
  });
  logInfo('worker.session_store_ready', 'Session store initialized', { traceId: workerTraceId });

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
  logInfo('worker.rate_limiter_ready', 'Rate limiter initialized', { traceId: workerTraceId });

  // Create Redis queue
  const queue = createRedisQueue({
    redisUrl: options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    queueName: options.queueName || 'crawl-jobs',
    workerId: options.workerId,
    heartbeatInterval: 30000,
    jobTtlSeconds: 3600,
  });

  logInfo('worker.queue_ready', 'Redis queue initialized', {
    traceId: workerTraceId,
    queueName: options.queueName || 'crawl-jobs',
  });
  await queue.register();
  queue.startHeartbeat();
  setQueueMetrics({ workerAlive: 1 });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logWarn('worker.shutdown', `Received ${signal}, shutting down worker gracefully`, {
      traceId: workerTraceId,
      workerId: options.workerId,
    });
    await queue.cleanup();
    setQueueMetrics({ workerAlive: 0, processing: 0 });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logInfo('worker.started', 'Worker started and waiting for jobs', {
    traceId: workerTraceId,
    workerId: options.workerId,
  });

  // Process loop
  while (!shuttingDown) {
    try {
      await queue.reclaimStaleJobs(parseInt(process.env.RECLAIM_STALE_MS || `${5 * 60 * 1000}`));
      const stats = await queue.getQueueStats();
      setQueueMetrics({
        depth: stats.queued,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        deadLetter: stats.deadLetter,
        workerAlive: 1,
      });
      const job = await queue.dequeue();

      if (!job) {
        continue;
      }

      logInfo('worker.job_started', 'Processing crawl job', {
        traceId: job.traceId || workerTraceId,
        jobId: job.jobId,
        workerId: job.workerId,
        urlCount: job.urls.length,
      });

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
        const afterCompleteStats = await queue.getQueueStats();
        setQueueMetrics({
          depth: afterCompleteStats.queued,
          processing: afterCompleteStats.processing,
          completed: afterCompleteStats.completed,
          failed: afterCompleteStats.failed,
          deadLetter: afterCompleteStats.deadLetter,
          workerAlive: 1,
        });
        logInfo('worker.job_completed', 'Job completed successfully', {
          traceId: job.traceId || workerTraceId,
          jobId: job.jobId,
          workerId: job.workerId,
          outcome: 'completed',
        });
      } catch (error) {
        // Fail job
        const errorMessage = error instanceof Error ? error.message : String(error);
        await queue.fail(job.jobId, errorMessage);
        const afterFailStats = await queue.getQueueStats();
        setQueueMetrics({
          depth: afterFailStats.queued,
          processing: afterFailStats.processing,
          completed: afterFailStats.completed,
          failed: afterFailStats.failed,
          deadLetter: afterFailStats.deadLetter,
          workerAlive: 1,
        });
        logError('worker.job_failed', 'Job failed', {
          traceId: job.traceId || workerTraceId,
          jobId: job.jobId,
          workerId: job.workerId,
          errorMessage,
          retryCount: job.retryCount,
          outcome: 'failed',
        });
      }
    } catch (error) {
      logError('worker.loop_error', 'Worker loop error', {
        traceId: workerTraceId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch((error) => {
  logError('worker.fatal', 'Fatal worker error', {
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
