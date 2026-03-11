import { getCache } from '../storage/cache.js';
import type { CrawlResponse, MonitorSnapshot } from '../types/schemas.js';

export type StorageBackend = 'memory' | 'sqlite';

interface StorageConfig {
  backend: StorageBackend;
  sqlitePath?: string;
}

let currentConfig: StorageConfig = { backend: 'memory' };

export function setStorageConfig(config: StorageConfig): void {
  currentConfig = config;
}

export function getStorageConfig(): StorageConfig {
  return currentConfig;
}

// SQLite storage implementation (lazy-loaded)
let sqliteDb: unknown = null;

async function getSqliteDb(): Promise<unknown> {
  if (sqliteDb) return sqliteDb;
  
  // Dynamic import for better deps management
  const { default: Database } = await import('better-sqlite3');
  const path = currentConfig.sqlitePath ?? './data/web-intelligence.db';
  
  // Ensure directory exists
  const { mkdirSync } = await import('node:fs');
  mkdirSync(path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.', { recursive: true });
  
  sqliteDb = new Database(path);
  
  // Initialize schema
  const db = sqliteDb as { exec: (sql: string) => void; prepare: (sql: string) => { run: (params?: unknown[]) => { changes: number }; all: (params?: unknown[]) => unknown[] } };
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS crawl_jobs (
      id TEXT PRIMARY KEY,
      request TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS monitor_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_monitor_target ON monitor_snapshots(target);
  `);
  
  return sqliteDb;
}

// Fallback: memory implementation using existing cache
function getMemoryCache() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

// Crawl job persistence
export async function saveCrawlJob(id: string, data: unknown): Promise<void> {
  if (currentConfig.backend === 'sqlite') {
    const db = await getSqliteDb();
    const dbTyped = db as { prepare: (sql: string) => { run: (params: unknown[]) => { changes: number } } };
    dbTyped.prepare(`
      INSERT OR REPLACE INTO crawl_jobs (id, request, status, created_at)
      VALUES (?, ?, 'pending', ?)
    `).run([id, JSON.stringify(data), new Date().toISOString()]);
  } else {
    getMemoryCache().set(`crawl:job:${id}`, data);
  }
}

export async function loadCrawlJob(id: string): Promise<unknown | null> {
  if (currentConfig.backend === 'sqlite') {
    const db = await getSqliteDb();
    const dbTyped = db as { prepare: (sql: string) => { get: (params: unknown[]) => { request: string } | undefined } };
    const row = dbTyped.prepare('SELECT request FROM crawl_jobs WHERE id = ?').get([id]) as { request: string } | undefined;
    return row ? JSON.parse(row.request) : null;
  } else {
    return getMemoryCache().get(`crawl:job:${id}`) ?? null;
  }
}

// Monitor snapshot persistence
export async function saveMonitorSnapshot(target: string, snapshot: MonitorSnapshot): Promise<void> {
  if (currentConfig.backend === 'sqlite') {
    const db = await getSqliteDb();
    const dbTyped = db as { prepare: (sql: string) => { run: (params: unknown[]) => { changes: number } } };
    dbTyped.prepare(`
      INSERT INTO monitor_snapshots (target, snapshot, created_at)
      VALUES (?, ?, ?)
    `).run([target, JSON.stringify(snapshot), new Date().toISOString()]);
  } else {
    const key = `monitor:snapshot:${target}`;
    const existing = getMemoryCache().get(key) as MonitorSnapshot[] ?? [];
    existing.push(snapshot);
    // Keep last 100
    if (existing.length > 100) existing.shift();
    getMemoryCache().set(key, existing);
  }
}

export async function loadMonitorSnapshots(target: string, limit = 100): Promise<MonitorSnapshot[]> {
  if (currentConfig.backend === 'sqlite') {
    const db = await getSqliteDb();
    const dbTyped = db as { prepare: (sql: string) => { all: (params: unknown[]) => { snapshot: string }[] } };
    const rows = dbTyped.prepare(`
      SELECT snapshot FROM monitor_snapshots 
      WHERE target = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all([target, limit]) as { snapshot: string }[];
    return rows.map(r => JSON.parse(r.snapshot));
  } else {
    return (getMemoryCache().get(`monitor:snapshot:${target}`) as MonitorSnapshot[] ?? []).slice(-limit).reverse();
  }
}
