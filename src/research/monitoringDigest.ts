export function buildMonitoringDigest(input: {
  topic: string;
  runCount: number;
  newSignals: string[];
  persistentSignals: string[];
  droppedSignals: string[];
  changedPages: string[];
}): {
  alertSeverity: 'info' | 'watch' | 'critical';
  alertTitle: string;
  digestSummary: string;
  digestBullets: string[];
} {
  const { topic, runCount, newSignals, persistentSignals, droppedSignals, changedPages } = input;

  const alertSeverity = newSignals.length >= 3 || changedPages.length >= 3
    ? 'critical'
    : newSignals.length > 0 || droppedSignals.length > 0
      ? 'watch'
      : 'info';

  const alertTitle = alertSeverity === 'critical'
    ? `Critical monitoring update for ${topic}`
    : alertSeverity === 'watch'
      ? `Monitoring changes detected for ${topic}`
      : `Monitoring digest for ${topic}`;

  const digestSummary = runCount === 1
    ? `Initial digest for "${topic}": ${newSignals.length} active signals detected in the first monitoring pass.`
    : `Run ${runCount} digest for "${topic}": ${newSignals.length} new, ${persistentSignals.length} persistent, ${droppedSignals.length} dropped signals.`;

  const digestBullets = [
    `${newSignals.length} new signals`,
    `${persistentSignals.length} persistent signals`,
    `${droppedSignals.length} dropped signals`,
  ];

  if (newSignals[0]) {
    digestBullets.push(`Top new signal: ${newSignals[0]}`);
  }
  if (persistentSignals[0]) {
    digestBullets.push(`Top persistent signal: ${persistentSignals[0]}`);
  }

  return {
    alertSeverity,
    alertTitle,
    digestSummary,
    digestBullets,
  };
}
