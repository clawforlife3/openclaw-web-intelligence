import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SearchProviderAdapter } from './types.js';

export class DdgsAdapter implements SearchProviderAdapter {
  async search(
    query: string,
    options: {
      limit?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      mode?: 'general' | 'news' | 'docs';
    } = {},
  ) {
    const { limit = 10, excludeDomains = [] } = options;

    const tmpFile = join(tmpdir(), `ddgs-${Date.now()}.json`);
    
    try {
      // Use CLI via execSync
      execSync(
        `ddgs text -q "${query.replace(/"/g, '\\"')}" -m ${limit} -o ${tmpFile}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // Read results from file
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(tmpFile, 'utf8');
      const results = JSON.parse(content);

      // Filter excluded domains
      const filtered = results
        .filter((r: { href?: string }) => {
          if (!r.href) return false;
          const hostname = new URL(r.href).hostname.replace(/^www\./, '');
          return !excludeDomains.some((d) => hostname.includes(d.replace(/^www\./, '')));
        })
        .map((r: { title?: string; href?: string; body?: string }) => ({
          url: r.href || '',
          title: r.title || '',
          snippet: r.body || '',
        }));

      return {
        results: filtered.slice(0, limit),
        provider: 'ddgs',
      };
    } finally {
      // Cleanup temp file
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
