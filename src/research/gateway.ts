import { logInfo } from '../observability/logger.js';
import { incrementMetric } from '../observability/metrics.js';
import {
  type ResearchEvidence,
  type ResearchFinding,
  type ResearchDocument,
  ResearchTopicRequestSchema,
  ResearchTopicResponseSchema,
  type ResearchSource,
  type ResearchTopicRequest,
  type ResearchTopicResponse,
} from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';
import { collectCorpus } from './collector.js';
import { buildResearchCorpus, dedupeResearchDocuments } from './corpus.js';
import { buildResearchReport } from './analysis.js';
import { discoverResearchSources } from './discovery.js';
import { buildResearchPlan } from './planner.js';
import {
  buildConfidenceNotes,
  buildResearchEvidence,
  buildResearchFindings,
  buildResearchSummary,
} from './reporter.js';
import { listResearchTasks, loadResearchTask, saveResearchTask, updateResearchTask } from './store.js';

function countUniqueDomains(items: ResearchSource[]): number {
  return new Set(items.map((item) => item.domain)).size;
}

export async function researchTopic(input: ResearchTopicRequest): Promise<ResearchTopicResponse> {
  const started = Date.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const taskId = `research_${Date.now().toString(36)}`;
  const request = ResearchTopicRequestSchema.parse(input);
  const plan = buildResearchPlan(request);
  saveResearchTask({
    taskId,
    request,
    status: 'planning',
    plan,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkpoint: {
      stage: 'planning',
      completedUrls: [],
      pendingUrls: [],
      sourceCount: 0,
      documentCount: 0,
      updatedAt: new Date().toISOString(),
    },
  });

  logInfo('research.planned', 'Research topic planned', {
    traceId,
    requestId,
    taskId,
    topic: request.topic,
    goal: request.goal,
    queryCount: plan.queries.length,
  });

  updateResearchTask(taskId, {
    status: 'discovering',
    checkpoint: {
      stage: 'discovering',
      completedUrls: [],
      pendingUrls: [],
      sourceCount: 0,
      documentCount: 0,
      updatedAt: new Date().toISOString(),
    },
  });

  const discoveredSources = await discoverResearchSources(request, plan);
  const { rankedSources } = buildResearchCorpus(request, discoveredSources);
  const sources = rankedSources;
  updateResearchTask(taskId, {
    status: 'extracting',
    sources,
    checkpoint: {
      stage: 'extracting',
      completedUrls: [],
      pendingUrls: sources.map((source) => source.url),
      sourceCount: sources.length,
      documentCount: 0,
      updatedAt: new Date().toISOString(),
    },
  });
  const rawDocuments: ResearchDocument[] = await collectCorpus(request, sources);
  const dedupedDocumentResult = dedupeResearchDocuments(rawDocuments);
  const evidence: ResearchEvidence[] = buildResearchEvidence(sources);
  const analysis = buildResearchReport({
    request,
    documents: dedupedDocumentResult.documents,
    evidence,
  });
  const documents = analysis.clusteredDocuments;
  const findings: ResearchFinding[] = buildResearchFindings(request, sources, documents);
  const summary = buildResearchSummary(request, sources, documents);
  const confidenceNotes = buildConfidenceNotes(sources, documents);
  incrementMetric('searchRuns', 0);
  updateResearchTask(taskId, {
    status: 'completed',
    documents,
    summary,
    report: analysis.report,
    checkpoint: {
      stage: 'completed',
      completedUrls: documents.map((document) => document.url),
      pendingUrls: sources
        .map((source) => source.url)
        .filter((url) => !documents.some((document) => document.url === url)),
      sourceCount: sources.length,
      documentCount: documents.length,
      updatedAt: new Date().toISOString(),
    },
  });

  const response: ResearchTopicResponse = {
    success: true,
    data: {
      taskId,
      status: 'completed',
      topic: request.topic,
      goal: request.goal,
      plan,
      sources,
      documents,
      summary,
      findings,
      evidence,
      confidenceNotes,
      report: analysis.report,
      stats: {
        queryCount: plan.queries.length,
        sourceCount: sources.length,
        documentCount: documents.length,
        uniqueDomainCount: countUniqueDomains(sources),
        evidenceCount: evidence.length,
        clusterCount: analysis.report.clusters.length,
        duplicateRatio: dedupedDocumentResult.duplicateRatio,
        filteredDocumentCount: dedupedDocumentResult.filteredCount,
      },
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  };

  return ResearchTopicResponseSchema.parse(response);
}

export function getResearchTask(taskId: string) {
  return loadResearchTask(taskId);
}

export function getResearchTaskList() {
  return listResearchTasks();
}

export async function resumeResearchTask(taskId: string): Promise<ResearchTopicResponse | null> {
  const task = loadResearchTask(taskId);
  if (!task) return null;

  if (task.status === 'completed' && task.plan && task.sources && task.documents && task.summary) {
    const analysis = buildResearchReport({
      request: task.request,
      documents: task.documents,
      evidence: buildResearchEvidence(task.sources),
    });
    const duplicateRatio = task.documents.length === 0 ? 0 : 0;
    return ResearchTopicResponseSchema.parse({
      success: true,
      data: {
        taskId: task.taskId,
        status: 'completed',
        topic: task.request.topic,
        goal: task.request.goal,
        plan: task.plan,
        sources: task.sources,
        documents: task.documents,
        summary: task.summary,
        findings: buildResearchFindings(task.request, task.sources, task.documents),
        evidence: buildResearchEvidence(task.sources),
        confidenceNotes: buildConfidenceNotes(task.sources, task.documents),
        report: task.report ?? analysis.report,
        stats: {
          queryCount: task.plan.queries.length,
          sourceCount: task.sources.length,
          documentCount: task.documents.length,
          uniqueDomainCount: countUniqueDomains(task.sources),
          evidenceCount: Math.min(task.sources.length, 5),
          clusterCount: (task.report ?? analysis.report).clusters.length,
          duplicateRatio,
          filteredDocumentCount: 0,
        },
      },
      meta: {
        requestId: generateRequestId(),
        traceId: generateTraceId(),
        schemaVersion: 'v1',
      },
    });
  }

  return researchTopic(task.request);
}
