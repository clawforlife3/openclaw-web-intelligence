import { getMonitorTopicTask, getMonitorTopicTaskList, monitorTopic, rerunMonitorTopicTask } from '../research/monitoring.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];

  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

function getArgList(flag: string): string[] {
  const raw = getArg(flag);
  if (!raw) return [];
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function getBoolArg(flag: string): boolean {
  const raw = getArg(flag);
  return raw === 'true' || raw === '1';
}

if (getBoolArg('list')) {
  console.log(JSON.stringify(getMonitorTopicTaskList(), null, 2));
  process.exit(0);
}

const taskId = getArg('task-id');
if (taskId && getBoolArg('rerun')) {
  const result = await rerunMonitorTopicTask(taskId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result ? 0 : 1);
}

if (taskId) {
  console.log(JSON.stringify(getMonitorTopicTask(taskId), null, 2));
  process.exit(0);
}

const topic = getArg('topic');
if (!topic) {
  console.error('Usage: npm run monitor-topic -- --topic "品牌負評" [--watch-domains=example.com,forum.com] [--query-templates=評價,討論] [--schedule="every 1d"] [--list=true] [--task-id=<id> --rerun=true]');
  process.exit(1);
}

const result = await monitorTopic({
  topic,
  watchDomains: getArgList('watch-domains'),
  queryTemplates: getArgList('query-templates'),
  schedule: getArg('schedule') || 'every 1d',
  diffMode: (getArg('diff-mode') as 'hash' | 'field' | 'full' | undefined) ?? 'field',
});

console.log(JSON.stringify(result, null, 2));
