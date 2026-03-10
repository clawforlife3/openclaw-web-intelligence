import * as cheerio from 'cheerio';
import { z } from 'zod';
import { generateRequestId, generateTraceId, generateJobId } from '../../types/utils.js';
import { MapRequestSchema, CrawlRequestSchema, type MapResponse, type CrawlResponse } from '../../types/schemas.js';

interface QueueItem {
  url: string;
  depth: number;
  parent?: string;
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\./, '');
}

function isUrlInScope(
  url: string,
  seedHost: string,
  allowDomains: string[],
  denyDomains: string[],
): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }

  const normalizedSeed = normalizeDomain(seedHost);
  const normalizedHost = normalizeDomain(hostname);

  // Must be same domain as seed (or subdomain)
  if (!normalizedHost.endsWith(`.${normalizedSeed}`) && normalizedHost !== normalizedSeed) {
    return false;
  }

  const denied = denyDomains.map(normalizeDomain).some(
    (d) => normalizedHost === d || normalizedHost.endsWith(`.${d}`),
  );
  if (denied) return false;

  if (allowDomains.length === 0) return true;
  return allowDomains.map(normalizeDomain).some(
    (a) => normalizedHost === a || normalizedHost.endsWith(`.${a}`),
  );
}

async function fetchLinks(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'OpenClaw-Web-Intelligence/0.1' },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    return $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((v): v is string => !!v)
      .map((href) => {
        try {
          return new URL(href, res.url).toString();
        } catch {
          return null;
        }
      })
      .filter((v): v is string => !!v);
  } catch {
    return [];
  }
}

export async function map(request: z.input<typeof MapRequestSchema>): Promise<MapResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const startTime = Date.now();

  // Parse with API spec fields (with backward compat aliases)
  const seedUrl = (request as { url?: string }).url || (request as { seedUrl?: string }).seedUrl || '';
  const limit = request.limit || (request as { maxPages?: number }).maxPages || 20;
  const maxDepth = request.maxDepth || 2;
  const includeDomains = request.includeDomains || [];
  const denyDomains = (request as { denyDomains?: string[] }).denyDomains || [];

  const seedHost = new URL(seedUrl).hostname;
  const visited = new Set<string>();
  const urls: MapResponse['data']['urls'] = [];
  const queue: QueueItem[] = [{ url: seedUrl, depth: 0 }];
  let excluded = 0;

  while (queue.length > 0 && urls.length < limit) {
    const current = queue.shift()!;

    if (visited.has(current.url)) continue;
    visited.add(current.url);

    const links = await fetchLinks(current.url);

    urls.push({
      url: current.url,
      depth: current.depth,
      discoveredFrom: current.parent,
    });

    if (current.depth < maxDepth && urls.length < limit) {
      const nextDepth = current.depth + 1;
      for (const link of links) {
        if (!visited.has(link)) {
          if (isUrlInScope(link, seedHost, includeDomains, denyDomains)) {
            if (urls.length + queue.length < limit) {
              queue.push({ url: link, depth: nextDepth, parent: current.url });
            }
          } else {
            excluded += 1;
          }
        }
      }
    }
  }

  const output: MapResponse = {
    success: true,
    data: {
      seedUrl,
      urls,
      summary: {
        visited: visited.size,
        discovered: urls.length,
        excluded,
        stoppedReason: urls.length >= limit ? 'limit_reached' : 'scope_exhausted',
      },
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - startTime,
      schemaVersion: 'v1',
    },
  };

  return output;
}

export async function crawl(request: z.input<typeof CrawlRequestSchema>): Promise<CrawlResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const jobId = generateJobId();
  const startedAt = new Date().toISOString();

  // Parse with API spec fields (with backward compat aliases)
  const seedUrl = (request as { url?: string }).url || (request as { seedUrl?: string }).seedUrl || '';
  const limit = request.limit || (request as { maxPages?: number }).maxPages || 50;
  const maxDepth = request.maxDepth || 2;
  const includeDomains = request.includeDomains || [];
  const excludePaths = request.excludePaths || [];
  const denyDomains = (request as { denyDomains?: string[] }).denyDomains || [];

  const seedHost = new URL(seedUrl).hostname;
  const visited = new Set<string>();
  const documents: CrawlResponse['data']['documents'] = [];
  const failedUrls: string[] = [];
  const queue: QueueItem[] = [{ url: seedUrl, depth: 0 }];
  let skipped = 0;

  while (queue.length > 0 && documents.length < limit) {
    const current = queue.shift()!;

    if (visited.has(current.url)) continue;
    visited.add(current.url);

    // Check exclude paths
    const urlPath = new URL(current.url).pathname;
    if (excludePaths.some((p) => urlPath.includes(p))) {
      skipped += 1;
      continue;
    }

    try {
      const res = await fetch(current.url, {
        redirect: 'follow',
        headers: { 'user-agent': 'OpenClaw-Web-Intelligence/0.1' },
      });
      const html = await res.text();
      const $ = cheerio.load(html);

      const links = $('a[href]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter((v): v is string => !!v)
        .map((href) => {
          try {
            return new URL(href, res.url).toString();
          } catch {
            return null;
          }
        })
        .filter((v): v is string => !!v);

      const title = $('title').first().text().trim() || undefined;
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      // Simple confidence scoring
      const confidence = Math.min(1, 0.5 + (title ? 0.15 : 0) + (text.length > 100 ? 0.15 : 0) + (links.length > 0 ? 0.2 : 0));
      const sourceQuality = res.status >= 200 && res.status < 300 ? 0.95 : 0.5;

      documents.push({
        url: current.url,
        finalUrl: res.url,
        title,
        markdown: text,
        text,
        html: null,
        links,
        metadata: {
          title,
          statusCode: res.status,
        },
        structured: {},
        confidence,
        sourceQuality,
        untrusted: true,
        extractedAt: new Date().toISOString(),
      });

      if (current.depth < maxDepth && documents.length < limit) {
        const nextDepth = current.depth + 1;
        for (const link of links) {
          if (!visited.has(link)) {
            if (isUrlInScope(link, seedHost, includeDomains, denyDomains)) {
              if (documents.length + queue.length < limit) {
                queue.push({ url: link, depth: nextDepth, parent: current.url });
              }
            }
          }
        }
      }
    } catch {
      failedUrls.push(current.url);
    }
  }

  const output: CrawlResponse = {
    success: true,
    data: {
      jobId,
      seedUrl,
      documents,
      summary: {
        visited: visited.size,
        extracted: documents.length,
        skipped,
        errors: failedUrls.length,
        stoppedReason: documents.length >= limit ? 'limit_reached' : 'scope_exhausted',
      },
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - new Date(startedAt).getTime(),
      schemaVersion: 'v1',
    },
  };

  return output;
}
