import { ExtractError } from '../types/errors.js';
import { search } from '../engines/search/search.js';

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
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const query = getArg('query');

if (!query) {
  console.error('Usage: npm run search -- --query "web scraping" [--max-results=10] [--exclude-domains=example.com]');
  process.exit(1);
}

try {
  const result = await search({
    query,
    maxResults: parseInt(getArg('max-results') || getArg('limit') || '10', 10),
    excludeDomains: getArgList('exclude-domains'),
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
