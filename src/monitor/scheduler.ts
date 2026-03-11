import { monitor } from './monitor.js';
import { listMonitorJobs } from './monitorStore.js';

export interface SchedulerHandle {
  stop: () => void;
}

function parseEverySchedule(schedule: string): number {
  const trimmed = schedule.trim().toLowerCase();
  const match = trimmed.match(/^every\s+(\d+)\s*(s|sec|secs|seconds|m|min|mins|minutes|h|hr|hrs|hours|d|day|days)$/);
  if (!match) {
    // default 1h
    return 60 * 60 * 1000;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMap: Record<string, number> = {
    s: 1000,
    sec: 1000,
    secs: 1000,
    seconds: 1000,
    m: 60 * 1000,
    min: 60 * 1000,
    mins: 60 * 1000,
    minutes: 60 * 1000,
    h: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    hrs: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };
  return value * (unitMap[unit] ?? 60 * 60 * 1000);
}

export function startMonitorScheduler(): SchedulerHandle {
  const timers: NodeJS.Timeout[] = [];
  const jobs = listMonitorJobs();

  for (const job of jobs) {
    const intervalMs = parseEverySchedule(job.request.schedule);
    const timer = setInterval(async () => {
      try {
        await monitor(job.request);
      } catch {
        // ignore errors; monitoring should not crash scheduler
      }
    }, intervalMs);
    timers.push(timer);
  }

  return {
    stop: () => timers.forEach((t) => clearInterval(t)),
  };
}
