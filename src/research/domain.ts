import { map } from '../engines/crawl/crawler.js';
import { CrawlDomainRequestSchema, CrawlDomainResponseSchema, type CrawlDomainRequest, type CrawlDomainResponse } from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';
import { createTaskId } from './taskIds.js';

function normalizeDomain(input: string): string {
  return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function categorizeUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes('/docs') || path.includes('/guide') || path.includes('/reference')) return 'docs';
  if (path.includes('/pricing') || path.includes('/plan')) return 'pricing';
  if (path.includes('/blog') || path.includes('/news') || path.includes('/article')) return 'blog';
  if (path.includes('/feature') || path.includes('/product') || path.includes('/solution')) return 'product';
  return 'general';
}

export async function crawlDomain(input: CrawlDomainRequest): Promise<CrawlDomainResponse> {
  const request = CrawlDomainRequestSchema.parse(input);
  const started = Date.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const domain = normalizeDomain(request.domain);
  const targetUrl = domain.startsWith('http') ? domain : `https://${domain}`;

  const result = await map({
    url: targetUrl,
    maxDepth: request.depth,
    limit: request.maxPages,
    discoverFromSitemap: true,
    robotsMode: 'balanced',
  });

  const mappedUrls = result.data.urls.map((item) => ({
    url: item.url,
    depth: item.depth,
    category: categorizeUrl(item.url),
  }));

  const byCategory = new Map<string, string[]>();
  for (const item of mappedUrls) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item.url]);
  }

  const recommendedExtractionTargets = mappedUrls
    .filter((item) => ['docs', 'pricing', 'product', 'blog'].includes(item.category))
    .slice(0, 20)
    .map((item) => item.url);

  return CrawlDomainResponseSchema.parse({
    success: true,
    data: {
      taskId: createTaskId('crawl_domain'),
      status: 'completed',
      domain,
      goal: request.goal,
      mappedUrls,
      categorizedUrls: Array.from(byCategory.entries()).map(([category, urls]) => ({ category, urls })),
      recommendedExtractionTargets,
      stats: {
        mappedCount: mappedUrls.length,
        recommendedCount: recommendedExtractionTargets.length,
      },
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  });
}
