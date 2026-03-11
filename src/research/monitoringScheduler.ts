export function parseMonitoringSchedule(schedule: string): number {
  const trimmed = schedule.trim().toLowerCase();
  const match = trimmed.match(/^every\s+(\d+)\s*(s|sec|secs|seconds|m|min|mins|minutes|h|hr|hrs|hours|d|day|days)$/);
  if (!match) {
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

export function getNextMonitoringRunAt(schedule: string, from = new Date()): string {
  return new Date(from.getTime() + parseMonitoringSchedule(schedule)).toISOString();
}
