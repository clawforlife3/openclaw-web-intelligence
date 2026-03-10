import { getCache, makeCacheKey } from '../storage/cache.js';
import { extract } from '../engines/extract/httpExtractor.js';
import { search } from '../engines/search/search.js';

function getArg(flag: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`--${flag}=`));
  if (eqIdx !== -1) return process.argv[eqIdx].split('=')[1];
  
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  
  return undefined;
}

function getArgBool(flag: string): boolean {
  const val = getArg(flag);
  return val === 'true' || val === '1' || val === 'yes';
}

async function main() {
  const command = process.argv[2];
  const cache = getCache({ enabled: true, ttlSeconds: 300 });
  
  if (command === 'stats') {
    console.log(JSON.stringify(cache.getStats(), null, 2));
    return;
  }
  
  if (command === 'clear') {
    cache.clear();
    console.log(JSON.stringify({ success: true, message: 'Cache cleared' }, null, 2));
    return;
  }

  // Extract with cache
  if (command === 'extract') {
    const url = getArg('url');
    if (!url) {
      console.error('Usage: npm run cache -- extract --url <url> [--no-cache]');
      process.exit(1);
    }
    
    const useCache = !getArgBool('no-cache');
    const cacheKey = makeCacheKey('extract', { urls: [url] });
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(JSON.stringify({ 
          success: true, 
          data: cached, 
          cached: true 
        }, null, 2));
        return;
      }
    }
    
    const result = await extract({ urls: [url] });
    
    if (useCache) {
      cache.set(cacheKey, result);
    }
    
    console.log(JSON.stringify({ 
      success: true, 
      data: result, 
      cached: false 
    }, null, 2));
    return;
  }

  // Search with cache
  if (command === 'search') {
    const query = getArg('query');
    if (!query) {
      console.error('Usage: npm run cache -- search --query <query> [--no-cache]');
      process.exit(1);
    }
    
    const useCache = !getArgBool('no-cache');
    const cacheKey = makeCacheKey('search', { query, maxResults: 10 });
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(JSON.stringify({ 
          success: true, 
          data: cached, 
          cached: true 
        }, null, 2));
        return;
      }
    }
    
    const result = await search({ query, maxResults: 10 });
    
    if (useCache) {
      cache.set(cacheKey, result);
    }
    
    console.log(JSON.stringify({ 
      success: true, 
      data: result, 
      cached: false 
    }, null, 2));
    return;
  }

  console.log(`
OpenClaw Web Intelligence Cache CLI

Commands:
  npm run cache -- stats              Show cache statistics
  npm run cache -- clear              Clear all cache
  npm run cache -- extract --url <url> Extract with cache
  npm run cache -- search --query <q>  Search with cache
  npm run cache -- extract --url <url> --no-cache  Extract without cache

Options:
  --no-cache                          Disable cache for this request
`);
}

main().catch(console.error);
