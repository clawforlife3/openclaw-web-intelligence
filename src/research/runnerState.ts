import { getCache } from '../storage/cache.js';

export interface MonitoringCycleLease {
  holderId: string;
  acquiredAt: string;
  expiresAt: string;
}

const LEASE_KEY = 'research:monitoring:cycle:lease';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

export function acquireMonitoringCycleLease(input?: {
  holderId?: string;
  now?: Date;
  ttlMs?: number;
}): MonitoringCycleLease | null {
  const now = input?.now ?? new Date();
  const current = getMonitoringCycleLease();
  if (current && new Date(current.expiresAt) > now) {
    return null;
  }

  const lease: MonitoringCycleLease = {
    holderId: input?.holderId ?? `cycle_${Date.now().toString(36)}`,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input?.ttlMs ?? 5 * 60 * 1000)).toISOString(),
  };
  getStore().set(LEASE_KEY, lease);
  return lease;
}

export function getMonitoringCycleLease(): MonitoringCycleLease | null {
  return getStore().get(LEASE_KEY) as MonitoringCycleLease | null;
}

export function releaseMonitoringCycleLease(holderId: string): void {
  const lease = getMonitoringCycleLease();
  if (!lease || lease.holderId !== holderId) return;
  getStore().delete(LEASE_KEY);
}
