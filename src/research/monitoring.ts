import { monitor } from '../monitor/monitor.js';
import {
  MonitorTopicRequestSchema,
  MonitorTopicResponseSchema,
  type MonitorTopicRequest,
  type MonitorTopicResponse,
} from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';
import { buildResearchPlan } from './planner.js';
import { getNextMonitoringRunAt } from './monitoringScheduler.js';
import {
  loadMonitorTopicTask,
  listMonitorTopicTasks,
  saveMonitorTopicTask,
  type StoredMonitorTopicTask,
} from './monitoringStore.js';

function buildTopicTargets(topic: string, watchDomains: string[], queryTemplates: string[]): string[] {
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

  return effectiveTemplates
    .slice(0, 3)
    .map((template) => `https://search.invalid/?q=${encodeURIComponent(`${template} ${topic}`)}`);
}

async function runMonitorTopicTask(task: StoredMonitorTopicTask): Promise<MonitorTopicResponse> {
  const started = Date.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const targets = buildTopicTargets(task.request.topic, task.request.watchDomains, task.request.queryTemplates);

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
    taskId: `monitor_topic_${Date.now().toString(36)}`,
    request,
    status: 'created',
    topic: request.topic,
    watchList: [],
    newFindings: [],
    changedPages: [],
    alerts: [],
    updatedSummary: `Monitoring baseline created for topic "${request.topic}".`,
    runCount: 0,
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
