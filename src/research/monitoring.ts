import { monitor } from '../monitor/monitor.js';
import { search } from '../engines/search/search.js';
import {
  MonitorTopicRequestSchema,
  MonitorTopicResponseSchema,
  type MonitorTopicRequest,
  type MonitorTopicResponse,
} from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';
import { buildResearchPlan } from './planner.js';
import { getNextMonitoringRunAt } from './monitoringScheduler.js';
import { researchTopic } from './gateway.js';
import { createTaskId } from './taskIds.js';
import { buildMonitoringTrend } from './monitoringAnalysis.js';
import { buildMonitoringDigest } from './monitoringDigest.js';
import { deliverMonitoringEnvelope } from './delivery.js';
import {
  loadMonitorTopicTask,
  listMonitorTopicTasks,
  saveMonitorTopicTask,
  type StoredMonitorTopicTask,
} from './monitoringStore.js';

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function buildTopicTargets(topic: string, watchDomains: string[], queryTemplates: string[]): Promise<string[]> {
  const explicit = watchDomains.map((domain) => (domain.startsWith('http') ? domain : `https://${domain}`));
  if (explicit.length > 0) return explicit;

  const effectiveTemplates = queryTemplates.length > 0
    ? queryTemplates
    : buildResearchPlan({
      topic,
      goal: 'summary',
      timeRange: undefined,
      region: undefined,
      language: 'zh-TW',
      sourcePreferences: [],
      freshness: 'any',
      maxBudgetPages: 25,
      maxRuntimeMinutes: 30,
      outputFormat: 'summary',
    }).queries.slice(0, 3);

  const discoveredTargets: string[] = [];
  for (const template of effectiveTemplates.slice(0, 3)) {
    try {
      const result = await search({
        query: template,
        maxResults: 2,
      });
      discoveredTargets.push(...result.data.results.map((item) => item.url).filter(Boolean));
    } catch {
      // fall through to placeholder targets when search is unavailable
    }
  }

  const dedupedTargets = uniqueStrings(discoveredTargets).slice(0, 5);
  if (dedupedTargets.length > 0) {
    return dedupedTargets;
  }

  return effectiveTemplates
    .slice(0, 3)
    .map((template) => `https://search.invalid/?q=${encodeURIComponent(`${template} ${topic}`)}`);
}

async function refreshTopicResearch(task: StoredMonitorTopicTask) {
  const result = await researchTopic({
    topic: task.request.topic,
    goal: 'monitor',
    timeRange: undefined,
    region: undefined,
    language: 'zh-TW',
    sourcePreferences: [],
    freshness: 'week',
    maxBudgetPages: Math.max(10, Math.min(30, task.watchList.length * 5 || 15)),
    maxRuntimeMinutes: 30,
    outputFormat: 'report',
  });

  return {
    taskId: result.data.taskId,
    summary: result.data.report.executiveSummary,
    insights: result.data.report.keyInsights,
  };
}

async function runMonitorTopicTask(task: StoredMonitorTopicTask): Promise<MonitorTopicResponse> {
  const started = Date.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const targets = await buildTopicTargets(task.request.topic, task.request.watchDomains, task.request.queryTemplates);

  const changedPages: string[] = [];
  const alerts: string[] = [];
  let status: 'created' | 'checked' = 'created';

  for (const target of targets) {
    if (!target.startsWith('http')) continue;
    try {
      const result = await monitor({
        targetType: 'page',
        target,
        schedule: task.request.schedule,
        diffPolicy: { mode: task.request.diffMode },
        execution: { operation: 'extract' },
      });
      status = result.data.status === 'checked' ? 'checked' : status;
      if (result.data.changed) {
        changedPages.push(target);
        alerts.push(...(result.data.change?.summary ?? []));
      }
    } catch {
      // Best-effort baseline. Failed targets remain outside changedPages.
    }
  }

  const newFindings = changedPages.length > 0
    ? [`${changedPages.length} monitored pages changed for topic "${task.request.topic}".`]
    : [`No changed pages detected yet for topic "${task.request.topic}".`];
  const updatedSummary = changedPages.length > 0
    ? `Detected changes for topic "${task.request.topic}" across ${changedPages.length} monitored pages.`
    : `Monitoring baseline created for topic "${task.request.topic}".`;
  const runCount = task.runCount + 1;
  const lastRunAt = new Date().toISOString();
  const previousRun = task.runHistory.at(-1);
  const shouldRefreshResearch = task.runCount === 0 || changedPages.length > 0 || !task.latestResearchTaskId;
  const researchUpdate = shouldRefreshResearch
    ? await refreshTopicResearch({
      ...task,
      watchList: targets,
    })
    : null;
  const trend = buildMonitoringTrend({
    previousRun,
    changedPages,
    alerts,
    topic: task.request.topic,
  });
  const digest = buildMonitoringDigest({
    topic: task.request.topic,
    runCount,
    newSignals: trend.newSignals,
    persistentSignals: trend.persistentSignals,
    droppedSignals: trend.droppedSignals,
    changedPages,
  });
  const relatedResearchTaskId = researchUpdate?.taskId ?? task.latestResearchTaskId;
  const reportSummary = researchUpdate?.summary ?? task.reportSummary;
  const reportInsights = researchUpdate?.insights ?? task.reportInsights;
  const nextRun = {
    runCount,
    status,
    changedPages,
    alerts,
    relatedResearchTaskId,
    reportSummary,
    reportInsights,
    trendSummary: trend.trendSummary,
    newSignals: trend.newSignals,
    persistentSignals: trend.persistentSignals,
    droppedSignals: trend.droppedSignals,
    alertSeverity: digest.alertSeverity,
    alertTitle: digest.alertTitle,
    digestSummary: digest.digestSummary,
    digestBullets: digest.digestBullets,
    runAt: lastRunAt,
  };

  deliverMonitoringEnvelope({
    taskId: task.taskId,
    topic: task.request.topic,
    severity: digest.alertSeverity,
    title: digest.alertTitle,
    summary: digest.digestSummary,
    bullets: digest.digestBullets,
    relatedResearchTaskId,
    deliveredAt: lastRunAt,
  });

  saveMonitorTopicTask({
    ...task,
    status,
    topic: task.request.topic,
    watchList: targets,
    newFindings,
    changedPages,
    alerts,
    updatedSummary,
    runCount,
    researchTaskIds: researchUpdate
      ? [...task.researchTaskIds, researchUpdate.taskId]
      : task.researchTaskIds,
    latestResearchTaskId: relatedResearchTaskId,
    reportSummary,
    reportInsights,
    trendSummary: trend.trendSummary,
    newSignals: trend.newSignals,
    persistentSignals: trend.persistentSignals,
    droppedSignals: trend.droppedSignals,
    alertSeverity: digest.alertSeverity,
    alertTitle: digest.alertTitle,
    digestSummary: digest.digestSummary,
    digestBullets: digest.digestBullets,
    runHistory: [...task.runHistory, nextRun].slice(-10),
    lastRunAt,
    nextRunAt: getNextMonitoringRunAt(task.request.schedule, new Date(lastRunAt)),
    updatedAt: lastRunAt,
  });

  return MonitorTopicResponseSchema.parse({
    success: true,
    data: {
      taskId: task.taskId,
      status,
      runCount,
      topic: task.request.topic,
      watchList: targets,
      newFindings,
      changedPages,
      alerts,
      updatedSummary,
      relatedResearchTaskId,
      reportSummary,
      reportInsights,
      trendSummary: trend.trendSummary,
      newSignals: trend.newSignals,
      persistentSignals: trend.persistentSignals,
      droppedSignals: trend.droppedSignals,
      alertSeverity: digest.alertSeverity,
      alertTitle: digest.alertTitle,
      digestSummary: digest.digestSummary,
      digestBullets: digest.digestBullets,
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  });
}

export async function monitorTopic(input: MonitorTopicRequest): Promise<MonitorTopicResponse> {
  const request = MonitorTopicRequestSchema.parse(input);
  const now = new Date().toISOString();
  const task: StoredMonitorTopicTask = {
    taskId: createTaskId('monitor_topic'),
    request,
    status: 'created',
    topic: request.topic,
    watchList: [],
    newFindings: [],
    changedPages: [],
    alerts: [],
    updatedSummary: `Monitoring baseline created for topic "${request.topic}".`,
    runCount: 0,
    researchTaskIds: [],
    runHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  saveMonitorTopicTask(task);
  return runMonitorTopicTask(task);
}

export function getMonitorTopicTask(taskId: string) {
  return loadMonitorTopicTask(taskId);
}

export function getMonitorTopicTaskList() {
  return listMonitorTopicTasks();
}

export async function rerunMonitorTopicTask(taskId: string): Promise<MonitorTopicResponse | null> {
  const task = loadMonitorTopicTask(taskId);
  if (!task) return null;
  return runMonitorTopicTask(task);
}
