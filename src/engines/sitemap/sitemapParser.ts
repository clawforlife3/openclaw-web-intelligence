import * as cheerio from 'cheerio';
import { ExtractError } from '../../types/errors.js';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface Sitemap {
  type: 'sitemap' | 'index';
  urls: SitemapUrl[];
  sources: string[];
}

interface SitemapParseResult {
  urls: SitemapUrl[];
  isIndex: boolean;
}

const DEFAULT_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap-index.xml',
  '/sitemap-news.xml',
  '/sitemap_products.xml',
  '/sitemap.xml.gz',
];

export function buildSitemapUrls(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  return DEFAULT_SITEMAP_PATHS.map((path) => `${url.origin}${path}`);
}

export async function fetchSitemap(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'OpenClaw-Web-Intelligence/0.1',
        accept: 'application/xml, text/xml, application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 404) {
        throw new ExtractError('SITEMAP_NOT_FOUND', `Sitemap not found at ${url}`, false, { url, status: response.status });
      }
      throw new ExtractError('SITEMAP_FETCH_ERROR', `Failed to fetch sitemap: ${response.status}`, response.status >= 500, { url, status: response.status });
    }

    return await response.text();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ExtractError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ExtractError('SITEMAP_TIMEOUT', `Timeout fetching sitemap from ${url}`, true, { url, timeoutMs });
    }
    throw new ExtractError('SITEMAP_FETCH_ERROR', `Failed to fetch sitemap: ${(err as Error).message}`, true, { url, cause: (err as Error).message });
  }
}

function parseXmlUrls(xml: string, baseUrl: string): SitemapParseResult {
  const $ = cheerio.load(xml, { xmlMode: true });
  const isIndex = $('sitemapindex').length > 0 || $('sitemapindex > sitemap').length > 0;

  const urls: SitemapUrl[] = [];

  if (isIndex) {
    $('sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) {
        urls.push({ loc });
      }
    });
  } else {
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) {
        const urlEntry: SitemapUrl = { loc };
        const lastmod = $(el).siblings('lastmod').first().text().trim();
        if (lastmod) urlEntry.lastmod = lastmod;
        const changefreq = $(el).siblings('changefreq').first().text().trim();
        if (changefreq) urlEntry.changefreq = changefreq;
        const priority = $(el).siblings('priority').first().text().trim();
        if (priority) urlEntry.priority = parseFloat(priority);
        urls.push(urlEntry);
      }
    });
  }

  return { urls, isIndex };
}

function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const normalized = new URL(rawUrl, baseUrl).toString();
    return normalized;
  } catch {
    return null;
  }
}

export async function discoverSitemap(baseUrl: string, timeoutMs = 10000): Promise<Sitemap | null> {
  const candidates = buildSitemapUrls(baseUrl);
  const sources: string[] = [];
  const allUrls: SitemapUrl[] = [];

  for (const candidate of candidates) {
    try {
      const xml = await fetchSitemap(candidate, timeoutMs);
      sources.push(candidate);
      const parsed = parseXmlUrls(xml, candidate);

      if (parsed.isIndex) {
        for (const urlEntry of parsed.urls) {
          try {
            const subXml = await fetchSitemap(urlEntry.loc, timeoutMs);
            sources.push(urlEntry.loc);
            const subParsed = parseXmlUrls(subXml, urlEntry.loc);
            allUrls.push(...subParsed.urls);
          } catch {
            // Skip failed sub-sitemaps
          }
        }
      } else {
        allUrls.push(...parsed.urls);
      }

      // If we found a valid sitemap, return early
      if (allUrls.length > 0) {
        return {
          type: 'sitemap',
          urls: allUrls,
          sources,
        };
      }
    } catch (err) {
      if (err instanceof ExtractError && err.code === 'SITEMAP_NOT_FOUND') {
        continue;
      }
      // For other errors, try next candidate
    }
  }

  return null;
}

export function filterSitemapUrls(
  urls: SitemapUrl[],
  seedHost: string,
  includeDomains: string[],
  denyDomains: string[],
  excludePatterns: string[] = [],
): string[] {
  const normalizedSeed = seedHost.replace(/^www\./, '').toLowerCase();

  const normalizedDeny = denyDomains.map((d) => d.replace(/^www\./, '').toLowerCase());

  const filtered = urls
    .map((u) => u.loc)
    .filter((rawUrl) => {
      const normalized = normalizeUrl(rawUrl, `https://${seedHost}`);
      if (!normalized) return false;

      let hostname: string;
      try {
        hostname = new URL(normalized).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return false;
      }

      // Scope check
      if (!hostname.endsWith(`.${normalizedSeed}`) && hostname !== normalizedSeed) {
        return false;
      }

      // Deny check
      if (normalizedDeny.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
        return false;
      }

      // Allow check
      if (includeDomains.length > 0) {
        const normalizedAllow = includeDomains.map((a) => a.replace(/^www\./, '').toLowerCase());
        if (!normalizedAllow.some((a) => hostname === a || hostname.endsWith(`.${a}`))) {
          return false;
        }
      }

      // Exclude patterns
      if (excludePatterns.some((p) => normalized.includes(p))) {
        return false;
      }

      return true;
    });

  // Dedupe
  return [...new Set(filtered)];
}
