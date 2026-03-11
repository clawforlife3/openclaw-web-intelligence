import { getCache } from '../storage/cache.js';

export type RegistryTaskType = 'research_topic' | 'crawl_domain' | 'monitor_topic';

export interface RegisteredTaskRef {
  taskId: string;
  taskType: RegistryTaskType;
  topic?: string;
  status: string;
  relatedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

const TASK_INDEX_KEY = 'research:registry:index';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeTaskKey(taskId: string): string {
  return `research:registry:${taskId}`;
}

export function saveRegisteredTask(task: RegisteredTaskRef): void {
  const store = getStore();
  store.set(makeTaskKey(task.taskId), task);
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  if (!index.includes(task.taskId)) {
    index.push(task.taskId);
    store.set(TASK_INDEX_KEY, index);
  }
}

export function loadRegisteredTask(taskId: string): RegisteredTaskRef | null {
  return getStore().get(makeTaskKey(taskId)) as RegisteredTaskRef | null;
}

export function listRegisteredTasks(): RegisteredTaskRef[] {
  const store = getStore();
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((taskId) => loadRegisteredTask(taskId))
    .filter((task): task is RegisteredTaskRef => Boolean(task))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertRegisteredTask(input: {
  taskId: string;
  taskType: RegistryTaskType;
  topic?: string;
  status: string;
  relatedTaskIds?: string[];
}): RegisteredTaskRef {
  const current = loadRegisteredTask(input.taskId);
  const now = new Date().toISOString();
  const next: RegisteredTaskRef = {
    taskId: input.taskId,
    taskType: input.taskType,
    topic: input.topic ?? current?.topic,
    status: input.status,
    relatedTaskIds: Array.from(new Set([...(current?.relatedTaskIds ?? []), ...(input.relatedTaskIds ?? [])])),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  saveRegisteredTask(next);
  return next;
}

export function getRelatedRegisteredTasks(taskId: string): RegisteredTaskRef[] {
  const task = loadRegisteredTask(taskId);
  if (!task) return [];
  return task.relatedTaskIds
    .map((relatedId) => loadRegisteredTask(relatedId))
    .filter((related): related is RegisteredTaskRef => Boolean(related));
}
