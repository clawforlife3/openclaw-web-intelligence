import { monitor } from '../monitor/monitor.js';
import { ExtractError } from '../types/errors.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];

  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

const url = getArg('url');
const operation = (getArg('operation') as 'extract' | 'crawl' | undefined) ?? 'extract';
const schedule = getArg('schedule') ?? 'every 1h';

if (!url) {
  console.error('Usage: npm run monitor -- --url https://example.com [--operation=extract|crawl] [--schedule="every 1h"]');
  process.exit(1);
}

try {
  const result = await monitor({
    targetType: operation === 'crawl' ? 'list' : 'page',
    target: url,
    schedule,
    execution: { operation },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  if (err instanceof ExtractError) {
    console.error(JSON.stringify({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        details: err.details,
      },
    }, null, 2));
    process.exit(2);
  }

  console.error(JSON.stringify({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: (err as Error).message,
      retryable: false,
    },
  }, null, 2));
  process.exit(3);
}
