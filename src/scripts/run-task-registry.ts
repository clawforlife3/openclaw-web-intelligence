import { getRelatedRegisteredTasks, listRegisteredTasks, loadRegisteredTask } from '../research/taskRegistry.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];

  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

const taskId = getArg('task-id');
if (!taskId) {
  console.log(JSON.stringify(listRegisteredTasks(), null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  task: loadRegisteredTask(taskId),
  related: getRelatedRegisteredTasks(taskId),
}, null, 2));
