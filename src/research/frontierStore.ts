import { getCache } from '../storage/cache.js';

export interface StoredDiscoveryFrontier {
  taskId: string;
  topic: string;
  queries: string[];
  candidateUrls: string[];
  seedCount: number;
  expandedCount: number;
  createdAt: string;
  updatedAt: string;
}

const FRONTIER_INDEX_KEY = 'research:frontier:index';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeFrontierKey(taskId: string): string {
  return `research:frontier:${taskId}`;
}

export function saveDiscoveryFrontier(frontier: StoredDiscoveryFrontier): void {
  const store = getStore();
  store.set(makeFrontierKey(frontier.taskId), frontier);
  const index = (store.get(FRONTIER_INDEX_KEY) as string[] | null) ?? [];
  if (!index.includes(frontier.taskId)) {
    index.push(frontier.taskId);
    store.set(FRONTIER_INDEX_KEY, index);
  }
}

export function loadDiscoveryFrontier(taskId: string): StoredDiscoveryFrontier | null {
  return getStore().get(makeFrontierKey(taskId)) as StoredDiscoveryFrontier | null;
}

export function listDiscoveryFrontiers(): StoredDiscoveryFrontier[] {
  const store = getStore();
  const index = (store.get(FRONTIER_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((taskId) => loadDiscoveryFrontier(taskId))
    .filter((item): item is StoredDiscoveryFrontier => Boolean(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
