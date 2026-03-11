import { getCache } from '../storage/cache.js';
import { crawl } from '../engines/crawl/crawler.js';
import { CrawlRequestSchema, type CrawlResponse } from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';

export interface JobRecord {
  jobId: string;
  request: unknown;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: CrawlResponse;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const JOB_INDEX_KEY = 'queue:jobs';

function makeJobKey(jobId: string): string {
  return `queue:job:${jobId}`;
}

export function enqueueJob(request: unknown): JobRecord {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: JobRecord = {
    jobId,
    request,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };

  const cache = getCache({ enabled: true, ttlSeconds: 0 });
  cache.set(makeJobKey(jobId), record);

  const index = (cache.get(JOB_INDEX_KEY) as string[] | null) ?? [];
  index.push(jobId);
  cache.set(JOB_INDEX_KEY, index);

  return record;
}

export function getJob(jobId: string): JobRecord | null {
  const cache = getCache({ enabled: true, ttlSeconds: 0 });
  return cache.get(makeJobKey(jobId)) as JobRecord | null;
}

export function listJobs(): JobRecord[] {
  const cache = getCache({ enabled: true, ttlSeconds: 0 });
  const index = (cache.get(JOB_INDEX_KEY) as string[] | null) ?? [];
  return index.map((id) => getJob(id)).filter((j): j is JobRecord => !!j);
}

export function updateJob(jobId: string, updates: Partial<JobRecord>): void {
  const job = getJob(jobId);
  if (!job) return;
  const updated = { ...job, ...updates };
  const cache = getCache({ enabled: true, ttlSeconds: 0 });
  cache.set(makeJobKey(jobId), updated);
}

export async function processJob(jobId: string): Promise<JobRecord> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  updateJob(jobId, { status: 'running', startedAt: new Date().toISOString() });

  try {
    const parsed = CrawlRequestSchema.parse(job.request);
    const result = await crawl(parsed);
    updateJob(jobId, {
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
    });
    return getJob(jobId)!;
  } catch (err) {
    updateJob(jobId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
    return getJob(jobId)!;
  }
}
