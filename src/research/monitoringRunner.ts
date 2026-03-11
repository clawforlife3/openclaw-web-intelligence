import { rerunMonitorTopicTask } from './monitoring.js';
import { buildTopicMonitoringDigest } from './delivery.js';
import { listDueMonitorTopicTasks } from './monitoringStore.js';
import { acquireMonitoringCycleLease, releaseMonitoringCycleLease } from './runnerState.js';

export interface MonitoringRunnerResult {
  checkedAt: string;
  skipped: boolean;
  leaseHolderId?: string;
  dueCount: number;
  processedCount: number;
  succeeded: string[];
  failed: string[];
  topicDigests: Array<{
    topic: string;
    deliveryCount: number;
    severities: string[];
    latestSummary?: string;
    highlights: string[];
  }>;
}

export async function processDueMonitorTopicTasks(input?: {
  limit?: number;
  now?: Date;
  leaseTtlMs?: number;
}): Promise<MonitoringRunnerResult> {
  const now = input?.now ?? new Date();
  const lease = acquireMonitoringCycleLease({
    now,
    ttlMs: input?.leaseTtlMs,
  });
  if (!lease) {
    return {
      checkedAt: now.toISOString(),
      skipped: true,
      dueCount: 0,
      processedCount: 0,
      succeeded: [],
      failed: [],
      topicDigests: [],
    };
  }

  const dueTasks = listDueMonitorTopicTasks(now).slice(0, input?.limit ?? 20);
  const succeeded: string[] = [];
  const failed: string[] = [];

  try {
    for (const task of dueTasks) {
      try {
        const result = await rerunMonitorTopicTask(task.taskId);
        if (result) {
          succeeded.push(task.taskId);
        } else {
          failed.push(task.taskId);
        }
      } catch {
        failed.push(task.taskId);
      }
    }
  } finally {
    releaseMonitoringCycleLease(lease.holderId);
  }

  const uniqueTopics = Array.from(new Set(dueTasks.map((task) => task.topic)));
  const topicDigests = uniqueTopics.map((topic) => buildTopicMonitoringDigest(topic));

  return {
    checkedAt: now.toISOString(),
    skipped: false,
    leaseHolderId: lease.holderId,
    dueCount: dueTasks.length,
    processedCount: succeeded.length + failed.length,
    succeeded,
    failed,
    topicDigests,
  };
}
