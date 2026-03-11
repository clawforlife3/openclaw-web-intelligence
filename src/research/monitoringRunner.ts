import { rerunMonitorTopicTask } from './monitoring.js';
import { listDueMonitorTopicTasks } from './monitoringStore.js';

export interface MonitoringRunnerResult {
  checkedAt: string;
  dueCount: number;
  processedCount: number;
  succeeded: string[];
  failed: string[];
}

export async function processDueMonitorTopicTasks(input?: {
  limit?: number;
  now?: Date;
}): Promise<MonitoringRunnerResult> {
  const now = input?.now ?? new Date();
  const dueTasks = listDueMonitorTopicTasks(now).slice(0, input?.limit ?? 20);
  const succeeded: string[] = [];
  const failed: string[] = [];

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

  return {
    checkedAt: now.toISOString(),
    dueCount: dueTasks.length,
    processedCount: succeeded.length + failed.length,
    succeeded,
    failed,
  };
}
