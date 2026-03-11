import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/engines/crawl/crawler.js', () => ({
  map: vi.fn(async () => ({
    success: true,
    data: {
      seedUrl: 'https://example.com',
      urls: [
        { url: 'https://example.com/docs/getting-started', depth: 1 },
        { url: 'https://example.com/pricing', depth: 1 },
        { url: 'https://example.com/blog/post', depth: 1 },
      ],
      summary: { visited: 3, discovered: 3, excluded: 0, stoppedReason: 'scope_exhausted' },
    },
    meta: {},
  })),
}));

const { crawlDomain } = await import('../src/research/domain.js');

describe('crawlDomain', () => {
  it('maps and categorizes urls for a domain research task', async () => {
    const result = await crawlDomain({
      domain: 'example.com',
      goal: 'analyze docs',
      patterns: ['docs'],
      depth: 2,
      maxPages: 20,
    });

    expect(result.data.mappedUrls).toHaveLength(3);
    expect(result.data.categorizedUrls.some((group) => group.category === 'docs')).toBe(true);
    expect(result.data.recommendedExtractionTargets.length).toBeGreaterThan(0);
  });
});
