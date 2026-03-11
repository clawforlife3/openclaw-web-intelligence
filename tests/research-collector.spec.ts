import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/engines/extract/httpExtractor.js', () => ({
  extract: vi.fn(async ({ urls }: { urls: string[] }) => ({
    success: true,
    data: {
      documents: [{
        url: urls[0],
        finalUrl: urls[0],
        title: 'Extracted Doc',
        markdown: '# Extracted',
        text: 'Extracted content for research pipeline.',
        metadata: { statusCode: 200 },
        html: null,
        structured: {
          kind: 'article',
          author: 'Nova',
          publishedAt: '2026-03-11',
          section: 'Engineering',
          headingTree: ['Overview', 'Pricing'],
        },
        links: [],
        confidence: 0.8,
        sourceQuality: 0.75,
        extractedAt: '2026-03-11T00:00:00.000Z',
      }],
    },
    meta: {},
  })),
}));

const { collectCorpus } = await import('../src/research/collector.js');

describe('collectCorpus', () => {
  it('extracts normalized research documents from ranked sources', async () => {
    const docs = await collectCorpus({
      topic: '台灣 CRM 市場',
      goal: 'summary',
      language: 'zh-TW',
      sourcePreferences: [],
      freshness: 'year',
      maxBudgetPages: 20,
      maxRuntimeMinutes: 20,
      outputFormat: 'report',
    }, [{
      url: 'https://example.com/a',
      title: 'A',
      snippet: 'A snippet',
      domain: 'example.com',
      rank: 1,
      sourceQuery: '台灣 CRM 市場',
      relevanceScore: 0.8,
      qualityScore: 0.7,
      diversityBoost: 0.1,
      evidenceScore: 0.8,
    }]);

    expect(docs).toHaveLength(1);
    expect(docs[0]?.domain).toBe('example.com');
    expect(docs[0]?.qualityScore).toBe(0.75);
    expect(docs[0]?.normalizedStructured?.kind).toBe('article');
    expect(docs[0]?.normalizedStructured?.author).toBe('Nova');
    expect(docs[0]?.normalizedStructured?.keyPoints).toContain('Overview');
  });
});
