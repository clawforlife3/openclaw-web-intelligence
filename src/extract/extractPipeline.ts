import * as cheerio from 'cheerio';
import type { ExtractedDocument } from '../types/schemas.js';
import type { StaticFetchResult } from '../fetch/staticFetcher.js';

export interface ExtractPipelineOptions {
  includeHtml?: boolean;
  includeLinks?: boolean;
  includeStructured?: boolean;
}

export interface BrowserRetryDecision {
  shouldRetryWithBrowser: boolean;
  reason?: 'js_app_shell_detected'
    | 'noscript_shell_detected'
    | 'dom_shell_detected'
    | 'low_confidence'
    | 'low_text_high_script_ratio'
    | 'thin_static_content';
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function htmlToMarkdownLite(html: string): string {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  return `${title ? `# ${title}\n\n` : ''}${bodyText}`.trim();
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .length;
}

function calculateConfidence(html: string, text: string, linkCount: number): number {
  const hasTitle = /<title>[^<]+<\/title>/i.test(html);
  const hasMetaDesc = /<meta[^>]+name="description"[^>]*>/i.test(html);
  const hasMain = /<(main|article|section)[\s>]/i.test(html);
  const wordCount = countWords(text);
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const linkDensity = wordCount > 0 ? linkCount / wordCount : linkCount;

  let score = 0.35;
  if (hasTitle) score += 0.15;
  if (hasMetaDesc) score += 0.1;
  if (hasMain) score += 0.15;
  if (wordCount >= 80) score += 0.15;
  else if (wordCount >= 30) score += 0.08;
  if (linkCount > 0 && linkDensity < 0.2) score += 0.05;
  if (scriptCount >= 8 && wordCount < 40) score -= 0.15;
  if (scriptCount >= 3 && wordCount < 20) score -= 0.1;

  return Math.min(1, Math.max(0, score));
}

function calculateSourceQuality(status: number): number {
  if (status >= 200 && status < 300) return 0.95;
  if (status >= 300 && status < 400) return 0.8;
  if (status >= 400 && status < 500) return 0.5;
  return 0.3;
}

function hasJsAppMarkers(html: string): boolean {
  const hint = html.toLowerCase();
  return [
    'id="root"',
    "id='root'",
    'id="app"',
    "id='app'",
    'id="__next"',
    'data-reactroot',
    'data-react-checksum',
    'ng-version',
    'nuxt',
    '__nuxt',
    'data-server-rendered',
    'vite',
    'webpack',
    '__remix',
    '__sapper__',
  ].some((marker) => hint.includes(marker));
}

type StructuredData = Record<string, unknown>;

interface StructuredExtractor {
  kind: 'article' | 'docs' | 'product' | 'forum' | 'docusaurus' | 'mkdocs' | 'github-docs' | 'changelog';
  detect: ($: cheerio.CheerioAPI, url: URL, text: string) => boolean;
  extract: ($: cheerio.CheerioAPI, url: URL, text: string) => StructuredData;
}

function getMetaContent($: cheerio.CheerioAPI, selector: string): string | undefined {
  return $(selector).attr('content')?.trim() || undefined;
}

function getText($: cheerio.CheerioAPI, selector: string): string | undefined {
  const value = $(selector).first().text().replace(/\s+/g, ' ').trim();
  return value || undefined;
}

function getAttr($: cheerio.CheerioAPI, selector: string, attribute: string): string | undefined {
  return $(selector).first().attr(attribute)?.trim() || undefined;
}

function extractPrice(text: string): { amount?: number; currency?: string } {
  const match = text.match(/([$€£¥])\s?(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return {};

  const currencyMap: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
  };

  return {
    amount: Number(match[2].replace(',', '.')),
    currency: currencyMap[match[1]],
  };
}

function getJsonLdObjects($: cheerio.CheerioAPI): Array<Record<string, unknown>> {
  return $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .flatMap((raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) return parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
        if (typeof parsed === 'object' && parsed !== null) return [parsed as Record<string, unknown>];
        return [];
      } catch {
        return [];
      }
    });
}

function findJsonLdByType(jsonLdObjects: Array<Record<string, unknown>>, type: string): Record<string, unknown> | undefined {
  const lowerType = type.toLowerCase();
  return jsonLdObjects.find((item) => {
    const rawType = item['@type'];
    if (typeof rawType === 'string') return rawType.toLowerCase() === lowerType;
    if (Array.isArray(rawType)) return rawType.some((entry) => typeof entry === 'string' && entry.toLowerCase() === lowerType);
    return false;
  });
}

function getFirstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) return entry.trim();
      if (typeof entry === 'object' && entry !== null) {
        const nestedName = (entry as Record<string, unknown>).name;
        if (typeof nestedName === 'string' && nestedName.trim()) return nestedName.trim();
      }
    }
  }
  if (typeof value === 'object' && value !== null) {
    const nestedName = (value as Record<string, unknown>).name;
    if (typeof nestedName === 'string' && nestedName.trim()) return nestedName.trim();
  }
  return undefined;
}

const structuredExtractors: StructuredExtractor[] = [
  // Site-specific: Docusaurus
  {
    kind: 'docusaurus',
    detect: ($, url) => {
      const html = $.html().toLowerCase();
      return html.includes('docusaurus') 
        || html.includes('theme-doc-sidebar')
        || $('.theme-doc-sidebar').length > 0
        || $('.theme-doc-markdown').length > 0
        || $('[class*="docSidebar"]').length > 0;
    },
    extract: ($, url, text) => {
      const navItems = $('.theme-doc-sidebar nav.menu__link, .theme-doc-sidebar nav a').length;
      const codeBlocks = $('pre, code').length;
      const headings = $('main h1, main h2, main h3, main h4').slice(0, 20).map((_, el) => $(el).text().trim()).get();
      const lastUpdated = getText($, '[class*="lastUpdated"], .theme-last-updated, time');
      
      return {
        kind: 'docusaurus',
        framework: 'docusaurus',
        navItemCount: navItems,
        codeBlockCount: codeBlocks,
        headingTree: headings,
        hasAdmonitions: $('.admonition, .alert, [class*="admonition"]').length > 0,
        hasVersionPicker: $('[class*="version-picker"], .theme-version-picker').length > 0,
        hasSidebar: $('.theme-doc-sidebar, [class*="sidebar"]').length > 0,
        lastUpdated,
        pathType: url.pathname.includes('/docs/') ? 'docs' : url.pathname.includes('/blog/') ? 'blog' : 'other',
      };
    },
  },
  // Site-specific: MkDocs / Material
  {
    kind: 'mkdocs',
    detect: ($, url) => {
      const html = $.html().toLowerCase();
      return html.includes('mkdocs') 
        || html.includes('material')
        || $('.mkdocs').length > 0
        || $('[class*="md-sidebar"]').length > 0
        || $('.md-content').length > 0;
    },
    extract: ($, url, text) => {
      const navLinks = $('nav.md-nav a, .md-sidebar a').length;
      const tocLinks = $('.md-toc a, .toc a').length;
      const codeBlocks = $('pre.code', '.highlight').length;
      const headings = $('article h1, article h2, article h3').slice(0, 15).map((_, el) => $(el).text().trim()).get();
      
      return {
        kind: 'mkdocs',
        framework: 'mkdocs-material',
        navLinkCount: navLinks,
        tocLinkCount: tocLinks,
        codeBlockCount: codeBlocks,
        headingTree: headings,
        hasSourceRepo: $('[class*="repo"], [class*="source"]').length > 0,
        hasSearch: $('[class*="search"], .md-search').length > 0,
        pathType: url.pathname.includes('/reference/') ? 'reference' : url.pathname.includes('/guide/') ? 'guide' : 'other',
      };
    },
  },
  // Site-specific: GitHub-like docs
  {
    kind: 'github-docs',
    detect: ($, url) => {
      const html = $.html().toLowerCase();
      return (url.hostname.includes('github') || url.hostname.includes('gitlab'))
        && (url.pathname.includes('/docs/') || url.pathname.includes('/wiki/') || $('.markdown-body, .gh-docs').length > 0);
    },
    extract: ($, url, text) => {
      const headings = $('.markdown-body h1, .markdown-body h2, .markdown-body h3, .gh-docs h1, .gh-docs h2').slice(0, 15).map((_, el) => $(el).text().trim()).get();
      const codeBlocks = $('.markdown-body pre, .gh-docs pre').length;
      const links = $('.markdown-body a, .gh-docs a').length;
      
      return {
        kind: 'github-docs',
        framework: url.hostname.includes('github') ? 'github' : 'gitlab',
        headingTree: headings,
        codeBlockCount: codeBlocks,
        linkCount: links,
        hasToc: $('.markdown-body .toc, .gh-docs .toc, [class*="table-of-contents"]').length > 0,
        pathType: url.pathname.includes('/wiki/') ? 'wiki' : 'docs',
      };
    },
  },
  // Site-specific: Changelog
  {
    kind: 'changelog',
    detect: ($, url) => {
      const html = $.html().toLowerCase();
      const path = url.pathname.toLowerCase();
      return path.includes('changelog') 
        || path.includes('release-notes')
        || path.includes('releases')
        || html.includes('changelog')
        || $('.changelog, .release-notes, [class*="changelog"]').length > 0;
    },
    extract: ($) => {
      const versions = $('h2, h3, [class*="version"], [class*="release"]').slice(0, 20).map((_, el) => $(el).text().trim()).get();
      const entries = $('ul li, .changelog li, [class*="item"]').length;
      const hasBreaking = /breaking|breaking change|breaking change/i.test($.html());
      
      return {
        kind: 'changelog',
        framework: 'generic',
        versionCount: versions.length,
        versions,
        entryCount: entries,
        hasBreakingChanges: hasBreaking,
        hasDates: $('time, [class*="date"]').length > 0,
      };
    },
  },
  // Generic: Article
  {
    kind: 'article',
    detect: ($, url) => $('article').length > 0
      || getMetaContent($, 'meta[property="og:type"]') === 'article'
      || url.pathname.includes('/blog')
      || $('time').length > 0
      || Boolean(findJsonLdByType(getJsonLdObjects($), 'Article')),
    extract: ($) => {
      const jsonLd = findJsonLdByType(getJsonLdObjects($), 'Article');
      return {
        kind: 'article',
        headline: getMetaContent($, 'meta[property="og:title"]') || getText($, 'article h1') || getText($, 'h1') || getFirstString(jsonLd?.headline),
        author: getMetaContent($, 'meta[name="author"]') || getText($, '[rel="author"]') || getText($, '.author') || getFirstString(jsonLd?.author),
        publishedAt: $('time').first().attr('datetime') || getMetaContent($, 'meta[property="article:published_time"]') || getFirstString(jsonLd?.datePublished),
        updatedAt: getMetaContent($, 'meta[property="article:modified_time"]') || getFirstString(jsonLd?.dateModified),
        section: getMetaContent($, 'meta[property="article:section"]') || getFirstString(jsonLd?.articleSection),
        tagCount: $('meta[property="article:tag"]').length,
      };
    },
  },
  // Generic: Docs
  {
    kind: 'docs',
    detect: ($, url) => url.pathname.includes('/docs')
      || url.pathname.includes('/guide')
      || url.pathname.includes('/reference')
      || url.pathname.includes('/api')
      || ($('nav').length > 0 && $('main').length > 0)
      || $('[role="navigation"]').length > 0,
    extract: ($, url, text) => ({
      kind: 'docs',
      headingTree: $('h1, h2, h3')
        .slice(0, 16)
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter(Boolean),
      codeBlockCount: $('pre code, code').length,
      navLinkCount: $('nav a[href], [role="navigation"] a[href]').length,
      hasTableOfContents: $('.table-of-contents, .toc, [aria-label*="table of contents" i]').length > 0,
      sectionCount: $('main section, article section').length,
      wordCount: countWords(text),
      pathType: /\/(api|reference)(\/|$)/.test(url.pathname) ? 'reference' : 'guide',
    }),
  },
  // Generic: Product
  {
    kind: 'product',
    detect: ($) => $('[itemprop="price"]').length > 0
      || $('[property="product:price:amount"]').length > 0
      || /\b(add to cart|buy now)\b/i.test($.html()),
    extract: ($) => {
      const rawPrice = getText($, '[itemprop="price"]')
        || getMetaContent($, '[property="product:price:amount"]')
        || getText($, '.price, [data-price]');
      const parsed = extractPrice(rawPrice || '');

      return {
        kind: 'product',
        name: getText($, 'h1') || getMetaContent($, 'meta[property="og:title"]'),
        price: parsed.amount,
        currency: parsed.currency || getMetaContent($, '[property="product:price:currency"]'),
        availability: getText($, '[itemprop="availability"]') || getAttr($, 'link[itemprop="availability"]', 'href'),
      };
    },
  },
  // Generic: Forum
  {
    kind: 'forum',
    detect: ($, url) => url.pathname.includes('/forum')
      || url.pathname.includes('/thread')
      || $('.comment, .reply, [data-post-id]').length >= 2,
    extract: ($) => ({
      kind: 'forum',
      threadTitle: getText($, 'h1') || getText($, '.thread-title'),
      postCount: $('.comment, .reply, [data-post-id]').length,
      authorCount: new Set($('.comment .author, .reply .author, [data-post-id] [data-author]')
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim() || $(el).attr('data-author') || '')
        .get()
        .filter(Boolean)).size,
    }),
  },
];

function extractStructuredData($: cheerio.CheerioAPI, url: string, text: string): StructuredData {
  const parsedUrl = new URL(url);

  for (const extractor of structuredExtractors) {
    if (!extractor.detect($, parsedUrl, text)) continue;
    return extractor.extract($, parsedUrl, text);
  }

  return {};
}

export function evaluateBrowserRetry(fetchResult: StaticFetchResult, document: ExtractedDocument): BrowserRetryDecision {
  const html = fetchResult.html.toLowerCase();
  const scriptCount = (html.match(/<script\b/g) || []).length;
  const textLength = document.text.trim().length;
  const wordCount = countWords(document.text);
  const markdownLength = document.markdown.trim().length;
  const hasMainLike = /<(main|article|section)[\s>]/i.test(fetchResult.html);
  const hasNoScriptBody = /<noscript[\s>][\s\S]*?<\/noscript>/i.test(fetchResult.html);
  const bodyTagCount = (html.match(/<(p|li|h1|h2|h3|article|section)\b/g) || []).length;

  if (hasJsAppMarkers(fetchResult.html) && textLength < 200) {
    return { shouldRetryWithBrowser: true, reason: 'js_app_shell_detected' };
  }

  if (document.confidence < 0.45) {
    return { shouldRetryWithBrowser: true, reason: 'low_confidence' };
  }

  if (textLength < 120 && scriptCount >= 3) {
    return { shouldRetryWithBrowser: true, reason: 'low_text_high_script_ratio' };
  }

  if (hasNoScriptBody && wordCount < 40) {
    return { shouldRetryWithBrowser: true, reason: 'noscript_shell_detected' };
  }

  if (!hasMainLike && markdownLength < 160 && scriptCount >= 2) {
    return { shouldRetryWithBrowser: true, reason: 'thin_static_content' };
  }

  if (bodyTagCount <= 3 && scriptCount >= 5 && wordCount < 30) {
    return { shouldRetryWithBrowser: true, reason: 'dom_shell_detected' };
  }

  return { shouldRetryWithBrowser: false };
}

export function extractDocument(fetchResult: StaticFetchResult, options: ExtractPipelineOptions = {}): ExtractedDocument {
  const $ = cheerio.load(fetchResult.html);
  const text = htmlToText(fetchResult.html);
  const markdown = htmlToMarkdownLite(fetchResult.html);

  const links = options.includeLinks
    ? $('a[href]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter((v): v is string => !!v)
        .map((href) => {
          try {
            return new URL(href, fetchResult.finalUrl).toString();
          } catch {
            return null;
          }
        })
        .filter((v): v is string => !!v)
    : [];

  const title = $('title').first().text().trim() || undefined;
  const canonicalRaw = $('link[rel="canonical"]').attr('href');
  let canonical: string | undefined;
  if (canonicalRaw) {
    try {
      canonical = new URL(canonicalRaw, fetchResult.finalUrl).toString();
    } catch {
      canonical = undefined;
    }
  }

  const structured = options.includeStructured
    ? extractStructuredData($, fetchResult.finalUrl, text)
    : {};

  return {
    url: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    title,
    markdown,
    text,
    html: options.includeHtml ? fetchResult.html : null,
    links,
    metadata: {
      title,
      description: $('meta[name="description"]').attr('content') || undefined,
      canonical,
      language: $('html').attr('lang') || undefined,
      statusCode: fetchResult.statusCode,
      contentType: fetchResult.contentType,
    },
    structured,
    confidence: calculateConfidence(fetchResult.html, text, links.length),
    sourceQuality: calculateSourceQuality(fetchResult.statusCode),
    untrusted: true,
    extractedAt: fetchResult.fetchedAt,
  };
}
