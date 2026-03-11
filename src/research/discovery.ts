import { map } from '../engines/crawl/crawler.js';
import { search } from '../engines/search/search.js';
import type { ResearchPlan, ResearchSource, ResearchTopicRequest } from '../types/schemas.js';

function dedupeSources(items: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  const results: ResearchSource[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    results.push(item);
  }
  return results;
}

function buildSyntheticTitle(url: string): string {
  const { hostname, pathname } = new URL(url);
  const path = pathname.replace(/[-_/]+/g, ' ').trim();
  return path ? `${hostname} ${path}` : hostname;
}

function scoreExpansionCandidate(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return ['docs', 'guide', 'reference', 'pricing', 'plan', 'blog', 'news', 'feature', 'product', 'solution']
    .some((token) => path.includes(token));
}

async function expandPromisingDomains(
  request: ResearchTopicRequest,
  seedSources: ResearchSource[],
): Promise<ResearchSource[]> {
  const domains = Array.from(new Set(seedSources.map((source) => source.domain))).slice(0, 2);
  const expanded: ResearchSource[] = [];

  for (const domain of domains) {
    try {
      const result = await map({
        url: `https://${domain}`,
        maxDepth: 1,
        limit: Math.min(12, Math.max(6, Math.floor(request.maxBudgetPages / 4))),
        discoverFromSitemap: true,
        robotsMode: 'balanced',
      });

      for (const item of result.data.urls) {
        if (!scoreExpansionCandidate(item.url)) continue;
        expanded.push({
          url: item.url,
          title: buildSyntheticTitle(item.url),
          snippet: `Expanded from domain ${domain} via sitemap/crawl discovery.`,
          domain: new URL(item.url).hostname,
          rank: expanded.length + 1,
          sourceQuery: `domain expansion:${domain}`,
        });
      }
    } catch {
      // Domain expansion is opportunistic. Search results remain the baseline.
    }
  }

  return expanded;
}

export async function discoverResearchSources(
  request: ResearchTopicRequest,
  plan: ResearchPlan,
): Promise<ResearchSource[]> {
  const sourceResults: ResearchSource[] = [];
  const perQueryLimit = Math.max(3, Math.min(10, Math.ceil(request.maxBudgetPages / Math.max(plan.queries.length, 1))));

  for (const query of plan.queries) {
    const result = await search({
      query,
      maxResults: perQueryLimit,
      freshness: request.freshness,
    });

    for (const item of result.data.results) {
      if (!item.url || !item.title) continue;
      sourceResults.push({
        url: item.url,
        title: item.title,
        snippet: item.snippet || '',
        domain: item.domain || new URL(item.url).hostname,
        rank: item.rank || sourceResults.length + 1,
        sourceQuery: query,
      });
    }
  }

  const dedupedSeeds = dedupeSources(sourceResults).slice(0, request.maxBudgetPages);
  const expanded = await expandPromisingDomains(request, dedupedSeeds);
  return dedupeSources([...dedupedSeeds, ...expanded]).slice(0, request.maxBudgetPages);
}
