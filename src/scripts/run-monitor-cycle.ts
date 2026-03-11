import { processDueMonitorTopicTasks } from '../research/monitoringRunner.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];

  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

const limit = Number.parseInt(getArg('limit') ?? '20', 10);
const result = await processDueMonitorTopicTasks({
  limit: Number.isFinite(limit) ? limit : 20,
});

console.log(JSON.stringify(result, null, 2));
