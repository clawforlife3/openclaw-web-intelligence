import { buildTopicMonitoringDigest, listMonitoringDeliveries } from './delivery.js';
import { loadMonitorTopicTask } from './monitoringStore.js';
import { loadResearchTask } from './store.js';
import { getRelatedRegisteredTasks, loadRegisteredTask, listRegisteredTasks, type RegisteredTaskRef } from './taskRegistry.js';

export interface TaskBriefing {
  taskId: string;
  taskType: string;
  topic?: string;
  status: string;
  summary: string;
  highlights: string[];
  relatedTasks: RegisteredTaskRef[];
}

function buildResearchTaskBriefing(taskId: string): TaskBriefing | null {
  const task = loadResearchTask(taskId);
  const ref = loadRegisteredTask(taskId);
  if (!task || !ref) return null;

  return {
    taskId,
    taskType: ref.taskType,
    topic: task.request.topic,
    status: task.status,
    summary: task.report?.executiveSummary ?? task.summary ?? `Research task ${taskId} is ${task.status}.`,
    highlights: [
      ...(task.report?.keyInsights ?? []).slice(0, 4),
      ...(task.report?.contradictions ?? []).slice(0, 2),
    ].slice(0, 6),
    relatedTasks: getRelatedRegisteredTasks(taskId),
  };
}

function buildMonitorTaskBriefing(taskId: string): TaskBriefing | null {
  const task = loadMonitorTopicTask(taskId);
  const ref = loadRegisteredTask(taskId);
  if (!task || !ref) return null;

  return {
    taskId,
    taskType: ref.taskType,
    topic: task.topic,
    status: task.status,
    summary: task.digestSummary ?? task.updatedSummary,
    highlights: [
      ...(task.digestBullets ?? []),
      ...(task.reportInsights ?? []).slice(0, 3),
    ].slice(0, 6),
    relatedTasks: getRelatedRegisteredTasks(taskId),
  };
}

export function buildTaskBriefing(taskId: string): TaskBriefing | null {
  const ref = loadRegisteredTask(taskId);
  if (!ref) return null;
  if (ref.taskType === 'research_topic') return buildResearchTaskBriefing(taskId);
  if (ref.taskType === 'monitor_topic') return buildMonitorTaskBriefing(taskId);
  return null;
}

export function buildTopicBriefing(topic: string): {
  topic: string;
  latestTasks: RegisteredTaskRef[];
  monitoringDigest: ReturnType<typeof buildTopicMonitoringDigest>;
  latestDeliveryTitles: string[];
} {
  const latestTasks = listRegisteredTasks()
    .filter((task) => task.topic === topic)
    .slice(0, 6);

  const latestDeliveryTitles = listMonitoringDeliveries()
    .filter((delivery) => delivery.topic === topic)
    .slice(0, 5)
    .map((delivery) => delivery.title);

  return {
    topic,
    latestTasks,
    monitoringDigest: buildTopicMonitoringDigest(topic),
    latestDeliveryTitles,
  };
}
