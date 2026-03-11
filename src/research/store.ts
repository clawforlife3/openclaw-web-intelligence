import { getCache } from '../storage/cache.js';
import type {
  ResearchDocument,
  ResearchPlan,
  ResearchSource,
  ResearchTaskCheckpoint,
  ResearchTaskStatus,
  ResearchTopicRequest,
} from '../types/schemas.js';

export interface StoredResearchTask {
  taskId: string;
  request: ResearchTopicRequest;
  status: ResearchTaskStatus;
  plan?: ResearchPlan;
  sources?: ResearchSource[];
  documents?: ResearchDocument[];
  checkpoint?: ResearchTaskCheckpoint;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

const TASK_INDEX_KEY = 'research:tasks:index';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeTaskKey(taskId: string): string {
  return `research:task:${taskId}`;
}

export function saveResearchTask(task: StoredResearchTask): void {
  const store = getStore();
  store.set(makeTaskKey(task.taskId), task);
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  if (!index.includes(task.taskId)) {
    index.push(task.taskId);
    store.set(TASK_INDEX_KEY, index);
  }
}

export function loadResearchTask(taskId: string): StoredResearchTask | null {
  return getStore().get(makeTaskKey(taskId)) as StoredResearchTask | null;
}

export function listResearchTasks(): StoredResearchTask[] {
  const store = getStore();
  const index = (store.get(TASK_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((taskId) => loadResearchTask(taskId))
    .filter((task): task is StoredResearchTask => Boolean(task));
}

export function updateResearchTask(taskId: string, updates: Partial<StoredResearchTask>): StoredResearchTask | null {
  const current = loadResearchTask(taskId);
  if (!current) return null;
  const next: StoredResearchTask = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveResearchTask(next);
  return next;
}
