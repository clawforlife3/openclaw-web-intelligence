import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/engines/search/search.js', () => ({
  search: vi.fn(async ({ query }: { query: string }) => ({
    success: true,
    data: {
      query,
      provider: 'mock',
      results: [
        {
          url: 'https://example.com/a',
          title: 'A',
          snippet: 'A snippet',
          rank: 1,
          domain: 'example.com',
        },
        {
          url: 'https://example.com/a',
          title: 'A duplicate',
          snippet: 'duplicate',
          rank: 2,
          domain: 'example.com',
        },
        {
          url: 'https://another.com/b',
          title: 'B',
          snippet: 'B snippet',
          rank: 3,
          domain: 'another.com',
        },
      ],
    },
    meta: {},
  })),
}));

vi.mock('../src/engines/extract/httpExtractor.js', () => ({
  extract: vi.fn(async ({ urls }: { urls: string[] }) => ({
    success: true,
    data: {
      documents: [{
        url: urls[0],
        finalUrl: urls[0],
        title: urls[0].includes('another') ? 'B extracted' : 'A extracted',
        markdown: '# Extracted',
        text: 'Extracted content for research pipeline.',
        metadata: { statusCode: 200 },
        html: null,
        structured: {},
        links: [],
        confidence: 0.82,
        sourceQuality: 0.78,
        extractedAt: '2026-03-11T00:00:00.000Z',
      }],
    },
    meta: {},
  })),
}));

const { researchTopic } = await import('../src/research/gateway.js');
const { loadResearchTask } = await import('../src/research/store.js');

describe('researchTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plans and returns deduped research sources', async () => {
    const result = await researchTopic({
      topic: '台灣 CRM 市場',
      goal: 'summary',
      language: 'zh-TW',
      sourcePreferences: [],
      freshness: 'year',
      maxBudgetPages: 10,
      maxRuntimeMinutes: 20,
      outputFormat: 'report',
    });

    expect(result.success).toBe(true);
    expect(result.data.plan.queries.length).toBeGreaterThan(0);
    expect(result.data.sources).toHaveLength(2);
    expect(result.data.documents).toHaveLength(2);
    expect(result.data.stats.uniqueDomainCount).toBe(2);
    expect(result.data.stats.documentCount).toBe(2);
    expect(result.data.summary).toContain('台灣 CRM 市場');
    expect(result.data.findings.length).toBeGreaterThan(0);
    expect(result.data.evidence.length).toBeGreaterThan(0);
    expect(result.data.sources[0]?.evidenceScore).toBeGreaterThanOrEqual(result.data.sources[1]?.evidenceScore ?? 0);

    const task = loadResearchTask(result.data.taskId);
    expect(task?.status).toBe('completed');
    expect(task?.checkpoint?.documentCount).toBe(2);
  });
});
