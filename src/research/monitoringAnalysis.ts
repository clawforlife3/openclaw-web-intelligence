import type { StoredMonitorTopicRun } from './monitoringStore.js';

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildMonitoringTrend(input: {
  previousRun?: StoredMonitorTopicRun;
  changedPages: string[];
  alerts: string[];
  topic: string;
}): {
  trendSummary: string;
  newSignals: string[];
  persistentSignals: string[];
  droppedSignals: string[];
} {
  const currentSignals = unique([...input.changedPages, ...input.alerts]);
  const previousSignals = unique([
    ...(input.previousRun?.changedPages ?? []),
    ...(input.previousRun?.alerts ?? []),
  ]);

  const currentSet = new Set(currentSignals);
  const previousSet = new Set(previousSignals);

  const newSignals = currentSignals.filter((signal) => !previousSet.has(signal));
  const persistentSignals = currentSignals.filter((signal) => previousSet.has(signal));
  const droppedSignals = previousSignals.filter((signal) => !currentSet.has(signal));

  const trendSummary = input.previousRun
    ? `Monitoring trend for "${input.topic}": ${newSignals.length} new signals, ${persistentSignals.length} persistent signals, ${droppedSignals.length} dropped signals.`
    : `Initial monitoring baseline created for "${input.topic}" with ${currentSignals.length} active signals.`;

  return {
    trendSummary,
    newSignals,
    persistentSignals,
    droppedSignals,
  };
}
