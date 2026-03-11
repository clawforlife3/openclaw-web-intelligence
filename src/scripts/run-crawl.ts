import { ExtractError } from '../types/errors.js';
import { crawl } from '../engines/crawl/crawler.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];
  
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  
  return undefined;
}

const url = getArg('url');
const includeStructured = getArg('include-structured') === 'true';
const robotsMode = (getArg('robots-mode') as 'strict' | 'balanced' | 'off' | undefined) ?? 'balanced';
const discoverFromSitemap = getArg('discover-from-sitemap') === 'true';

if (!url) {
  console.error('Usage: npm run crawl -- --url https://example.com [--max-depth=2] [--limit=10] [--robots-mode=strict|balanced|off] [--include-structured=true] [--discover-from-sitemap=true]');
  process.exit(1);
}

try {
  const result = await crawl({
    seedUrl: url,
    maxDepth: parseInt(getArg('max-depth') || '2', 10),
    limit: parseInt(getArg('limit') || getArg('max-pages') || '10', 10),
    robotsMode,
    includeStructured,
    discoverFromSitemap,
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
