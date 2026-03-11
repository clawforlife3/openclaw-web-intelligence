import { crawlDomain } from '../research/domain.js';

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

const domain = getArg('domain');

if (!domain) {
  console.error('Usage: npm run crawl-domain -- --domain example.com [--goal=domain research] [--patterns=docs,pricing] [--depth=2] [--max-pages=50]');
  process.exit(1);
}

const result = await crawlDomain({
  domain,
  goal: getArg('goal') || 'domain research',
  patterns: getArgList('patterns'),
  depth: parseInt(getArg('depth') || '2', 10),
  maxPages: parseInt(getArg('max-pages') || '50', 10),
});

console.log(JSON.stringify(result, null, 2));
