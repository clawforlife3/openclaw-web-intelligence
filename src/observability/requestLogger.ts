import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'extract-requests.jsonl');

type LogStatus = 'ok' | 'error';

export async function logExtractRequest(entry: {
  requestId: string;
  traceId?: string;
  urlCount: number;
  operation?: 'extract' | 'search' | 'crawl' | 'monitor';
  domain?: string;
  workerId?: string;
  jobId?: string;
  retryReason?: string;
  outcome?: string;
  status: LogStatus;
  tookMs: number;
  errorCode?: string;
  errorMessage?: string;
}) {
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(
    LOG_FILE,
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
    'utf8',
  );
}
