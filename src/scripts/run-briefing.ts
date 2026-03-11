import { buildTaskBriefing, buildTopicBriefing } from '../research/briefing.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];

  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

const taskId = getArg('task-id');
const topic = getArg('topic');

if (taskId) {
  console.log(JSON.stringify(buildTaskBriefing(taskId), null, 2));
  process.exit(0);
}

if (topic) {
  console.log(JSON.stringify(buildTopicBriefing(topic), null, 2));
  process.exit(0);
}

console.error('Usage: npm run briefing -- --task-id=<id> | --topic="topic"');
process.exit(1);
