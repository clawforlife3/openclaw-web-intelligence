import { ExtractError } from '../types/errors.js';
import { extract } from '../engines/extract/httpExtractor.js';

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

const urlArg = getArg('url');

if (!urlArg) {
  console.error('Usage: npm run extract -- --url https://example.com [--allow-domains=example.com] [--deny-domains=bad.com]');
  process.exit(1);
}

try {
  const result = await extract({
    urls: [urlArg],
    allowDomains: getArgList('allow-domains'),
    denyDomains: getArgList('deny-domains'),
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
