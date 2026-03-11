import { z } from 'zod';

// ============================================
// Common Types (API Spec Section 2)
// ============================================

export const CommonMetaSchema = z.object({
  requestId: z.string(),
  traceId: z.string().optional(),
  cached: z.boolean().optional(),
  tookMs: z.number().int().optional(),
  schemaVersion: z.string().optional().default('v1'),
});

export const CacheMetaSchema = z.object({
  hit: z.boolean(),
  ttlSeconds: z.number().int().optional(),
  key: z.string().optional(),
});

// ============================================
// Extract (API Spec Section 4)
// ============================================

export const ExtractRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  formats: z.enum(['markdown', 'text', 'html']).array().optional().default(['markdown', 'text']),
  includeHtml: z.boolean().optional().default(false),
  includeLinks: z.boolean().optional().default(true),
  includeStructured: z.boolean().optional().default(false),
  renderMode: z.enum(['auto', 'static', 'browser']).optional().default('auto'),
  safetyMode: z.enum(['strict', 'balanced', 'off']).optional().default('balanced'),
  cacheTtlSeconds: z.number().int().min(0).optional().default(3600),
  timeoutMs: z.number().int().positive().max(120_000).optional().default(15_000),
  retryMax: z.number().int().min(0).max(3).optional().default(1),
  userAgent: z.string().min(3).optional().default('OpenClaw-Web-Intelligence/0.1'),
  allowDomains: z.array(z.string().min(1)).optional().default([]),
  denyDomains: z.array(z.string().min(1)).optional().default([]),
});

export const DocumentMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  publishedAt: z.string().optional(),
  language: z.string().optional(),
  statusCode: z.number().int(),
  contentType: z.string().optional(),
});

export const RetryReasonSchema = z.enum([
  'js_app_shell_detected',
  'noscript_shell_detected',
  'dom_shell_detected',
  'low_confidence',
  'low_text_high_script_ratio',
  'thin_static_content',
  'http_error_retry',
  'timeout_retry',
]);

export const FetchOutcomeSchema = z.enum([
  'success_static',
  'success_browser',
  'success_retry',
  'failed_static',
  'failed_browser',
  'blocked_robots',
  'blocked_policy',
  'error',
]);

export const FetchDecisionMetaSchema = z.object({
  strategy: z.enum(['static', 'browser']),
  initialStrategy: z.enum(['static', 'browser']).optional(),
  autoRetried: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  reason: z.string().optional(),
  retryReason: RetryReasonSchema.optional(),
  outcome: FetchOutcomeSchema.optional(),
  retryCount: z.number().int().optional().default(0),
  wasShellDetection: z.boolean().optional().default(false),
});

export const ExtractedDocumentSchema = z.object({
  url: z.string().url(),
  finalUrl: z.string().url(),
  title: z.string().optional(),
  markdown: z.string(),
  text: z.string(),
  html: z.string().nullable(),
  metadata: DocumentMetadataSchema,
  structured: z.record(z.unknown()).optional().default({}),
  links: z.array(z.string().url()),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  sourceQuality: z.number().min(0).max(1).optional().default(0.8),
  untrusted: z.boolean().optional().default(true),
  cache: CacheMetaSchema.optional(),
  fetch: FetchDecisionMetaSchema.optional(),
  extractedAt: z.string(),
});

export const ExtractResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    documents: z.array(ExtractedDocumentSchema),
  }),
  meta: CommonMetaSchema.optional(),
});

// ============================================
// Search (API Spec Section 3)
// ============================================

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  includeDomains: z.array(z.string().min(1)).optional().default([]),
  excludeDomains: z.array(z.string().min(1)).optional().default([]),
  topic: z.enum(['general', 'news', 'docs']).optional().default('general'),
  maxResults: z.number().int().min(1).max(20).optional().default(10),
  freshness: z.enum(['day', 'week', 'month', 'year', 'any']).optional().default('any'),
  includeExtract: z.boolean().optional().default(false),
  cacheTtlSeconds: z.number().int().min(0).optional().default(600),
});

export const SearchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  rank: z.number().int().optional(),
  sourceQuality: z.number().min(0).max(1).optional(),
  publishedAt: z.string().optional(),
  domain: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    query: z.string(),
    results: z.array(SearchResultSchema),
    provider: z.string(),
  }),
  meta: CommonMetaSchema.optional(),
});

// ============================================
// Sitemap (Extension for Research Crawler)
// ============================================

export const SitemapUrlSchema = z.object({
  loc: z.string().url(),
  lastmod: z.string().optional(),
  changefreq: z.string().optional(),
  priority: z.number().optional(),
});

export const SitemapSchema = z.object({
  type: z.enum(['sitemap', 'index']),
  urls: z.array(SitemapUrlSchema),
  sources: z.array(z.string().url()),
});

export const SitemapDiscoveryResultSchema = z.object({
  discovered: z.boolean(),
  urls: z.array(z.string().url()),
  sources: z.array(z.string().url()),
  method: z.enum(['sitemap', 'bfs', 'both']),
});

// ============================================
// Map (API Spec Section 5)
// ============================================

export const MapRequestSchema = z.object({
  url: z.string().url(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxBreadth: z.number().int().min(1).max(100).optional().default(20),
  limit: z.number().int().min(1).max(200).optional().default(100),
  includeDomains: z.array(z.string().min(1)).optional().default([]),
  excludePaths: z.array(z.string()).optional().default([]),
  robotsMode: z.enum(['strict', 'balanced', 'off']).optional().default('balanced'),
  cacheTtlSeconds: z.number().int().min(0).optional().default(1800),
  discoverFromSitemap: z.boolean().optional().default(false),
});

export const MapResultSchema = z.object({
  url: z.string().url(),
  depth: z.number().int(),
  discoveredFrom: z.string().url().optional(),
  discoveredBy: z.enum(['sitemap', 'bfs']).optional(),
});

export const MapSummarySchema = z.object({
  visited: z.number().int(),
  discovered: z.number().int(),
  excluded: z.number().int(),
  stoppedReason: z.enum(['limit_reached', 'depth_limit', 'scope_exhausted', 'error']),
});

export const RobotsDecisionSchema = z.object({
  url: z.string().url(),
  allowed: z.boolean(),
  reason: z.enum(['allowed', 'disallowed', 'unavailable', 'off']),
  robotsUrl: z.string().url().optional(),
  phase: z.enum(['seed', 'enqueue']).optional(),
});

export const CrawlDebugSchema = z.object({
  robots: z.object({
    decisions: z.array(RobotsDecisionSchema),
    blockedCount: z.number().int(),
    unavailableCount: z.number().int(),
  }).optional(),
});

export const MapResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    seedUrl: z.string(),
    urls: z.array(MapResultSchema),
    summary: MapSummarySchema,
    debug: CrawlDebugSchema.optional(),
  }),
  meta: CommonMetaSchema.optional(),
});

// ============================================
// Crawl (API Spec Section 6)
// ============================================

export const CrawlRequestSchema = z.object({
  seedUrl: z.string().url(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxBreadth: z.number().int().min(1).max(100).optional().default(20),
  limit: z.number().int().min(1).max(200).optional().default(50),
  includeDomains: z.array(z.string().min(1)).optional().default([]),
  excludePaths: z.array(z.string()).optional().default([]),
  formats: z.enum(['markdown', 'text', 'html']).array().optional().default(['markdown', 'text']),
  includeLinks: z.boolean().optional().default(true),
  includeStructured: z.boolean().optional().default(false),
  robotsMode: z.enum(['strict', 'balanced', 'off']).optional().default('balanced'),
  cacheTtlSeconds: z.number().int().min(0).optional().default(1800),
  discoverFromSitemap: z.boolean().optional().default(false),
});

export const CrawlSummarySchema = z.object({
  visited: z.number().int(),
  extracted: z.number().int(),
  skipped: z.number().int(),
  errors: z.number().int(),
  stoppedReason: z.enum(['limit_reached', 'depth_limit', 'scope_exhausted', 'error']),
});

export const CrawlResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    jobId: z.string().optional(),
    seedUrl: z.string(),
    documents: z.array(ExtractedDocumentSchema),
    summary: CrawlSummarySchema,
    debug: CrawlDebugSchema.optional(),
  }),
  meta: CommonMetaSchema.optional(),
});

// ============================================
// Monitor (API Spec Section 7) - Post-MVP
// ============================================

export const MonitorRequestSchema = z.object({
  targetType: z.enum(['page', 'list']),
  target: z.string().url(),
  schedule: z.string(),
  diffPolicy: z.object({
    mode: z.enum(['hash', 'field', 'full']).optional().default('field'),
    fields: z.array(z.string()).optional(),
  }).optional().default({ mode: 'field' }),
  notifyPolicy: z.object({
    cooldownMinutes: z.number().int().optional().default(180),
    onlyOnChange: z.boolean().optional().default(true),
  }).optional().default({ cooldownMinutes: 180, onlyOnChange: true }),
  execution: z.object({
    operation: z.enum(['extract', 'crawl']).optional().default('extract'),
    options: z.record(z.unknown()).optional(),
  }).optional().default({ operation: 'extract' }),
});

export const MonitorSnapshotSchema = z.object({
  title: z.string().optional(),
  textHash: z.string(),
  structuredHash: z.string(),
  urlCount: z.number().int().optional(),
  extractedAt: z.string(),
});

export const MonitorChangeSchema = z.object({
  changed: z.boolean(),
  fields: z.array(z.string()),
  summary: z.array(z.string()),
});

export const MonitorResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    monitorJobId: z.string(),
    status: z.enum(['created', 'updated', 'deleted', 'checked']),
    changed: z.boolean().optional(),
    change: MonitorChangeSchema.optional(),
    snapshot: MonitorSnapshotSchema.optional(),
  }),
  meta: CommonMetaSchema.optional(),
});

// ============================================
// Cache (API Spec Section 10)
// ============================================

export const CacheOptionsSchema = z.object({
  ttlSeconds: z.number().int().min(0).optional().default(3600),
  enabled: z.boolean().optional().default(true),
});

export const CacheEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
});

export const CacheStatsSchema = z.object({
  hits: z.number().int(),
  misses: z.number().int(),
  size: z.number().int(),
});

// ============================================
// Error Response (API Spec Section 2.2)
// ============================================

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null().optional(),
  meta: CommonMetaSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional().default(false),
    details: z.record(z.unknown()).optional(),
  }),
});

// ============================================
// Type Exports
// ============================================

export type CommonMeta = z.infer<typeof CommonMetaSchema>;
export type CacheMeta = z.infer<typeof CacheMetaSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;
export type RetryReason = z.infer<typeof RetryReasonSchema>;
export type FetchOutcome = z.infer<typeof FetchOutcomeSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type MapRequest = z.infer<typeof MapRequestSchema>;
export type MapResponse = z.infer<typeof MapResponseSchema>;
export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;
export type CrawlResponse = z.infer<typeof CrawlResponseSchema>;
export type MonitorRequest = z.infer<typeof MonitorRequestSchema>;
export type MonitorSnapshot = z.infer<typeof MonitorSnapshotSchema>;
export type MonitorChange = z.infer<typeof MonitorChangeSchema>;
export type MonitorResponse = z.infer<typeof MonitorResponseSchema>;
export type SitemapUrl = z.infer<typeof SitemapUrlSchema>;
export type Sitemap = z.infer<typeof SitemapSchema>;
export type SitemapDiscoveryResult = z.infer<typeof SitemapDiscoveryResultSchema>;
export type CacheOptions = z.infer<typeof CacheOptionsSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export type CacheStats = z.infer<typeof CacheStatsSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
