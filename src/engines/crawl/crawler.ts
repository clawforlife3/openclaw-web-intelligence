import { z } from 'zod';
import { PageCache } from '../../cache/pageCache.js';
import { browserFetch } from '../../fetch/browserFetcher.js';
import { fetchWithRouter } from '../../fetch/fetchWithRouter.js';
import { extractDocument, evaluateBrowserRetry } from '../../extract/extractPipeline.js';
import { generateRequestId, generateTraceId, generateJobId } from '../../types/utils.js';
import { MapRequestSchema, CrawlRequestSchema, type MapResponse, type CrawlResponse } from '../../types/schemas.js';
import { ExtractError } from '../../types/errors.js';
import { evaluateRobotsPolicy, type RobotsMode, type RobotsEvaluation } from './robotsPolicy.js';

interface QueueItem {
  url: string;
  depth: number;
  parent?: string;
}

interface DebugState {
  robots: {
    decisions: Array<RobotsEvaluation & { url: string; phase: 'seed' | 'enqueue' }>;
    blockedCount: number;
    unavailableCount: number;
  };
}

function createDebugState(): DebugState {
  return {
    robots: {
      decisions: [],
      blockedCount: 0,
      unavailableCount: 0,
    },
  };
}

function trackRobotsDecision(debug: DebugState, url: string, phase: 'seed' | 'enqueue', decision: RobotsEvaluation): void {
  debug.robots.decisions.push({ url, phase, ...decision });
  if (!decision.allowed) debug.robots.blockedCount += 1;
  if (decision.reason === 'unavailable') debug.robots.unavailableCount += 1;
}

async function evaluateTrackedRobotsPolicy(url: string, mode: RobotsMode, debug: DebugState, phase: 'seed' | 'enqueue'): Promise<RobotsEvaluation> {
  const decision = await evaluateRobotsPolicy(url, mode);
  trackRobotsDecision(debug, url, phase, decision);
  return decision;
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\./, '');
}

function isUrlInScope(url: string, seedHost: string, allowDomains: string[], denyDomains: string[]): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }

  const normalizedSeed = normalizeDomain(seedHost);
  const normalizedHost = normalizeDomain(hostname);

  if (!normalizedHost.endsWith(`.${normalizedSeed}`) && normalizedHost !== normalizedSeed) return false;

  const denied = denyDomains.map(normalizeDomain).some((d) => normalizedHost === d || normalizedHost.endsWith(`.${d}`));
  if (denied) return false;

  if (allowDomains.length === 0) return true;
  return allowDomains.map(normalizeDomain).some((a) => normalizedHost === a || normalizedHost.endsWith(`.${a}`));
}

async function fetchPage(url: string, cache: PageCache) {
  const cached = cache.get(url);
  if (cached) {
    return {
      result: cached.fetchResult,
      cacheHit: true,
      initialStrategy: (cached.fetchResult.via ?? 'static') as 'static' | 'browser',
      finalStrategy: (cached.fetchResult.via ?? 'static') as 'static' | 'browser',
      fallbackUsed: false,
      routeReason: 'Cached page result reused.',
      autoRetried: false,
      retryReason: undefined as string | undefined,
    };
  }

  const routed = await fetchWithRouter({
    mode: 'crawl',
    url,
    renderMode: 'auto',
    timeoutMs: 15_000,
    retryMax: 1,
    userAgent: 'OpenClaw-Web-Intelligence/0.1',
  });

  let result = routed.fetchResult;
  let finalStrategy: 'static' | 'browser' = result.via === 'browser' ? 'browser' : 'static';
  let autoRetried = false;
  let retryReason: string | undefined;

  if (finalStrategy === 'static') {
    const staticDocument = extractDocument(result, { includeLinks: true, includeHtml: false, includeStructured: false });
    const retryDecision = evaluateBrowserRetry(result, staticDocument);
    if (retryDecision.shouldRetryWithBrowser) {
      retryReason = retryDecision.reason;
      try {
        const browserResult = await browserFetch({
          url,
          timeoutMs: 15_000,
          retryMax: 1,
          userAgent: 'OpenClaw-Web-Intelligence/0.1',
          waitUntil: 'domcontentloaded',
        });
        result = browserResult;
        finalStrategy = 'browser';
        autoRetried = true;
      } catch (err) {
        if (!(err instanceof ExtractError && err.code === 'BROWSER_UNAVAILABLE')) {
          throw err;
        }
      }
    }
  }

  cache.set(url, result);
  return {
    result,
    cacheHit: false,
    initialStrategy: routed.decision.strategy,
    finalStrategy,
    fallbackUsed: routed.fallbackUsed,
    routeReason: routed.decision.reason,
    autoRetried,
    retryReason,
  };
}

async function fetchLinks(url: string, cache: PageCache): Promise<string[]> {
  try {
    const { result } = await fetchPage(url, cache);
    return extractDocument(result, { includeLinks: true, includeStructured: false }).links;
  } catch {
    return [];
  }
}

export async function map(request: z.input<typeof MapRequestSchema>): Promise<MapResponse> {
  const input = MapRequestSchema.parse(request);
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const startTime = Date.now();
  const pageCache = new PageCache({ enabled: input.cacheTtlSeconds !== 0, ttlSeconds: input.cacheTtlSeconds });
  const debug = createDebugState();

  const seedUrl = input.url;
  const limit = input.limit;
  const maxDepth = input.maxDepth;
  const includeDomains = input.includeDomains;
  const denyDomains = (request as { denyDomains?: string[] }).denyDomains || [];

  const seedHost = new URL(seedUrl).hostname;
  const visited = new Set<string>();
  const urls: MapResponse['data']['urls'] = [];
  const queue: QueueItem[] = [{ url: seedUrl, depth: 0 }];
  let excluded = 0;

  const seedRobots = await evaluateTrackedRobotsPolicy(seedUrl, input.robotsMode, debug, 'seed');
  if (!seedRobots.allowed) {
    throw new ExtractError('ROBOTS_POLICY_DENIED', `Blocked by robots.txt policy: ${seedUrl}`, false, {
      url: seedUrl,
      mode: input.robotsMode,
      reason: seedRobots.reason,
      robotsUrl: seedRobots.robotsUrl,
    });
  }

  while (queue.length > 0 && urls.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    const links = await fetchLinks(current.url, pageCache);
    urls.push({ url: current.url, depth: current.depth, discoveredFrom: current.parent });

    if (current.depth < maxDepth && urls.length < limit) {
      const nextDepth = current.depth + 1;
      for (const link of links) {
        if (!visited.has(link)) {
          if (isUrlInScope(link, seedHost, includeDomains, denyDomains)) {
            const robotsDecision = await evaluateTrackedRobotsPolicy(link, input.robotsMode, debug, 'enqueue');
            if (!robotsDecision.allowed) {
              excluded += 1;
              continue;
            }
            if (urls.length + queue.length < limit) queue.push({ url: link, depth: nextDepth, parent: current.url });
          } else {
            excluded += 1;
          }
        }
      }
    }
  }

  return {
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
      debug,
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - startTime,
      schemaVersion: 'v1',
    },
  };
}

export async function crawl(request: z.input<typeof CrawlRequestSchema>): Promise<CrawlResponse> {
  const input = CrawlRequestSchema.parse(request);
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const jobId = generateJobId();
  const started = Date.now();
  const pageCache = new PageCache({ enabled: input.cacheTtlSeconds !== 0, ttlSeconds: input.cacheTtlSeconds });
  const debug = createDebugState();

  const seedUrl = input.seedUrl;
  const limit = input.limit;
  const maxDepth = input.maxDepth;
  const includeDomains = input.includeDomains;
  const excludePaths = input.excludePaths;
  const denyDomains = (request as { denyDomains?: string[] }).denyDomains || [];

  const seedHost = new URL(seedUrl).hostname;
  const visited = new Set<string>();
  const documents: CrawlResponse['data']['documents'] = [];
  const failedUrls: string[] = [];
  const queue: QueueItem[] = [{ url: seedUrl, depth: 0 }];
  let skipped = 0;

  const seedRobots = await evaluateTrackedRobotsPolicy(seedUrl, input.robotsMode, debug, 'seed');
  if (!seedRobots.allowed) {
    throw new ExtractError('ROBOTS_POLICY_DENIED', `Blocked by robots.txt policy: ${seedUrl}`, false, {
      url: seedUrl,
      mode: input.robotsMode,
      reason: seedRobots.reason,
      robotsUrl: seedRobots.robotsUrl,
    });
  }

  while (queue.length > 0 && documents.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    const urlPath = new URL(current.url).pathname;
    if (excludePaths.some((p) => urlPath.includes(p))) {
      skipped += 1;
      continue;
    }

    try {
      const page = await fetchPage(current.url, pageCache);
      const document = extractDocument(page.result, {
        includeLinks: input.includeLinks,
        includeHtml: false,
        includeStructured: input.includeStructured,
      });
      document.cache = { hit: page.cacheHit, ttlSeconds: request.cacheTtlSeconds };
      document.fetch = {
        strategy: page.finalStrategy,
        initialStrategy: page.initialStrategy,
        autoRetried: page.autoRetried,
        fallbackUsed: page.fallbackUsed,
        reason: page.routeReason,
        retryReason: page.retryReason,
      };
      documents.push(document);

      if (current.depth < maxDepth && documents.length < limit) {
        const nextDepth = current.depth + 1;
        for (const link of document.links) {
          if (!visited.has(link) && isUrlInScope(link, seedHost, includeDomains, denyDomains)) {
            const robotsDecision = await evaluateTrackedRobotsPolicy(link, input.robotsMode, debug, 'enqueue');
            if (!robotsDecision.allowed) {
              skipped += 1;
              continue;
            }
            if (documents.length + queue.length < limit) queue.push({ url: link, depth: nextDepth, parent: current.url });
          }
        }
      }
    } catch {
      failedUrls.push(current.url);
    }
  }

  return {
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
      debug,
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  };
}
