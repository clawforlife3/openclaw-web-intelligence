import { createHash, randomBytes } from 'node:crypto';
import { extract } from '../engines/extract/httpExtractor.js';
import { crawl } from '../engines/crawl/crawler.js';
import {
  MonitorRequestSchema,
  MonitorResponseSchema,
  type MonitorRequest,
  type MonitorResponse,
  type MonitorSnapshot,
  type ExtractedDocument,
} from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';
import { loadMonitorJob, saveMonitorJob, appendHistory, type StoredMonitorJob } from './monitorStore.js';
import { notifyIfNeeded } from './alerting.js';
import { incrementMetric } from '../observability/metrics.js';

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}


function summarizeDocument(document: ExtractedDocument): MonitorSnapshot {
  return {
    title: document.title,
    textHash: hashValue(document.text),
    structuredHash: hashValue(document.structured ?? {}),
    extractedAt: document.extractedAt,
  };
}

function summarizeDocuments(documents: ExtractedDocument[]): MonitorSnapshot {
  return {
    title: documents[0]?.title,
    textHash: hashValue(documents.map((doc) => doc.text)),
    structuredHash: hashValue(documents.map((doc) => doc.structured ?? {})),
    urlCount: documents.length,
    extractedAt: documents[0]?.extractedAt ?? new Date().toISOString(),
  };
}

function diffSnapshots(previous: MonitorSnapshot | undefined, next: MonitorSnapshot) {
  if (!previous) {
    return {
      changed: true,
      fields: ['initial_snapshot'],
      summary: ['Initial snapshot created.'],
    };
  }

  const fields: string[] = [];
  const summary: string[] = [];

  if (previous.title !== next.title) {
    fields.push('title');
    summary.push(`Title changed: ${previous.title ?? '(empty)'} -> ${next.title ?? '(empty)'}`);
  }
  if (previous.textHash !== next.textHash) {
    fields.push('text');
    summary.push('Main text content changed.');
  }
  if (previous.structuredHash !== next.structuredHash) {
    fields.push('structured');
    summary.push('Structured extraction output changed.');
  }
  if (previous.urlCount !== next.urlCount) {
    fields.push('urlCount');
    summary.push(`URL count changed: ${previous.urlCount ?? 0} -> ${next.urlCount ?? 0}`);
  }

  return {
    changed: fields.length > 0,
    fields,
    summary: fields.length > 0 ? summary : ['No meaningful change detected.'],
  };
}

async function runExecution(request: MonitorRequest): Promise<MonitorSnapshot> {
  if (request.execution.operation === 'crawl') {
    const result = await crawl({
      seedUrl: request.target,
      cacheTtlSeconds: 0,
      ...(request.execution.options ?? {}),
    });
    return summarizeDocuments(result.data.documents);
  }

  const result = await extract({
    urls: [request.target],
    includeStructured: true,
    cacheTtlSeconds: 0,
    ...(request.execution.options ?? {}),
  });
  return summarizeDocument(result.data.documents[0]);
}

export async function monitor(input: unknown): Promise<MonitorResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const started = Date.now();
  const request = MonitorRequestSchema.parse(input);

  const previous = loadMonitorJob(request.target);
  const snapshot = await runExecution(request);
  const change = diffSnapshots(previous?.snapshot, snapshot);
  incrementMetric('monitorRuns');
  if (change.changed) {
    incrementMetric('monitorChanges');
  }

  let stored: StoredMonitorJob = {
    monitorJobId: previous?.monitorJobId ?? `mon_${randomBytes(6).toString('hex')}`,
    request,
    snapshot,
    lastCheckedAt: new Date().toISOString(),
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    history: previous?.history ?? [],
  };

  stored = appendHistory(stored, snapshot);
  saveMonitorJob(request.target, stored);

  const response: MonitorResponse = {
    success: true,
    data: {
      monitorJobId: stored.monitorJobId,
      status: previous ? 'checked' : 'created',
      changed: change.changed,
      change,
      snapshot,
    },
    meta: {
      requestId,
      traceId,
      cached: false,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  };

  // Alerting (console by default)
  await notifyIfNeeded(request, {
    monitorJobId: stored.monitorJobId,
    target: request.target,
    changed: change.changed,
    change,
    snapshot,
    checkedAt: new Date().toISOString(),
  });

  MonitorResponseSchema.parse(response);
  return response;
}
