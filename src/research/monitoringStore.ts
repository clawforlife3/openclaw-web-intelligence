import { getCache } from '../storage/cache.js';
import { upsertRegisteredTask } from './taskRegistry.js';
import type { MonitorTopicRequest } from '../types/schemas.js';

export interface StoredMonitorTopicRun {
  runCount: number;
  status: 'created' | 'checked';
  changedPages: string[];
  alerts: string[];
  relatedResearchTaskId?: string;
  reportSummary?: string;
  reportInsights?: string[];
  trendSummary?: string;
  newSignals?: string[];
  persistentSignals?: string[];
  droppedSignals?: string[];
  alertSeverity?: 'info' | 'watch' | 'critical';
  alertTitle?: string;
  digestSummary?: string;
  digestBullets?: string[];
  runAt: string;
}

export interface StoredMonitorTopicTask {
  taskId: string;
  request: MonitorTopicRequest;
  status: 'created' | 'checked';
  topic: string;
  watchList: string[];
  newFindings: string[];
  changedPages: string[];
  alerts: string[];
  updatedSummary: string;
  runCount: number;
  researchTaskIds: string[];
  latestResearchTaskId?: string;
  reportSummary?: string;
  reportInsights?: string[];
  trendSummary?: string;
  newSignals?: string[];
  persistentSignals?: string[];
  droppedSignals?: string[];
  alertSeverity?: 'info' | 'watch' | 'critical';
  alertTitle?: string;
  digestSummary?: string;
  digestBullets?: string[];
  runHistory: StoredMonitorTopicRun[];
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TASK_INDEX_KEY = 'research:monitor:index';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeTaskKey(taskId: string): string {
  return `research:monitor:${taskId}`;
}

export function saveMonitorTopicTask(task: StoredMonitorTopicTask): void {
  const store = getStore();
  store.set(makeTaskKey(task.taskId), task);
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  if (!index.includes(task.taskId)) {
    index.push(task.taskId);
    store.set(TASK_INDEX_KEY, index);
  }
  upsertRegisteredTask({
    taskId: task.taskId,
    taskType: 'monitor_topic',
    topic: task.topic,
    status: task.status,
    relatedTaskIds: task.researchTaskIds,
  });
  for (const relatedTaskId of task.researchTaskIds) {
    upsertRegisteredTask({
      taskId: relatedTaskId,
      taskType: 'research_topic',
      topic: task.topic,
      status: 'completed',
      relatedTaskIds: [task.taskId],
    });
  }
}

export function loadMonitorTopicTask(taskId: string): StoredMonitorTopicTask | null {
  return getStore().get(makeTaskKey(taskId)) as StoredMonitorTopicTask | null;
}

export function listMonitorTopicTasks(): StoredMonitorTopicTask[] {
  const store = getStore();
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((taskId) => loadMonitorTopicTask(taskId))
    .filter((task): task is StoredMonitorTopicTask => Boolean(task));
}

export function updateMonitorTopicTask(
  taskId: string,
  updates: Partial<StoredMonitorTopicTask>,
): StoredMonitorTopicTask | null {
  const current = loadMonitorTopicTask(taskId);
  if (!current) return null;
  const next: StoredMonitorTopicTask = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveMonitorTopicTask(next);
  return next;
}
