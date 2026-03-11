import { ExtractError } from '../types/errors.js';
import { researchTopic } from '../research/gateway.js';

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

const topic = getArg('topic');

if (!topic) {
  console.error('Usage: npm run research -- --topic "台灣 CRM 市場" [--goal=summary|compare|track|monitor|explore_domain] [--region=台灣] [--time-range=近三年]');
  process.exit(1);
}

try {
  const result = await researchTopic({
    topic,
    goal: (getArg('goal') as 'summary' | 'compare' | 'track' | 'monitor' | 'explore_domain' | undefined) ?? 'summary',
    region: getArg('region'),
    timeRange: getArg('time-range'),
    language: getArg('language') ?? 'zh-TW',
    freshness: (getArg('freshness') as 'day' | 'week' | 'month' | 'year' | 'any' | undefined) ?? 'any',
    sourcePreferences: getArgList('source-preferences'),
    maxBudgetPages: parseInt(getArg('max-budget-pages') || '50', 10),
    maxRuntimeMinutes: parseInt(getArg('max-runtime-minutes') || '20', 10),
    outputFormat: (getArg('output-format') as 'summary' | 'report' | 'comparison' | undefined) ?? 'report',
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
