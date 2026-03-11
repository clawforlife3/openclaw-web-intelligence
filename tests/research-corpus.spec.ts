import { describe, expect, it } from 'vitest';
import { buildResearchCorpus, dedupeResearchDocuments } from '../src/research/corpus.js';

describe('buildResearchCorpus', () => {
  it('scores sources with relevance, quality, and diversity', () => {
    const result = buildResearchCorpus({
      topic: '台灣 CRM 市場',
      goal: 'summary',
      language: 'zh-TW',
      sourcePreferences: [],
      freshness: 'year',
      maxBudgetPages: 20,
      maxRuntimeMinutes: 20,
      outputFormat: 'report',
    }, [
      {
        url: 'https://official.example.com/pricing',
        title: '台灣 CRM 官網 定價',
        snippet: '官方方案與價格',
        domain: 'official.example.com',
        rank: 1,
        sourceQuery: '台灣 CRM 市場 官網',
      },
      {
        url: 'https://forum.example.com/thread',
        title: 'CRM 討論',
        snippet: '使用心得',
        domain: 'forum.example.com',
        rank: 2,
        sourceQuery: '台灣 CRM 市場 討論',
      },
    ]);

    expect(result.rankedSources).toHaveLength(2);
    expect(result.rankedSources[0]?.evidenceScore).toBeGreaterThan(0);
    expect(result.rankedSources[0]?.relevanceScore).toBeGreaterThan(0);
  });

  it('dedupes near-identical documents', () => {
    const result = dedupeResearchDocuments([
      {
        url: 'https://example.com/a',
        finalUrl: 'https://example.com/a',
        domain: 'example.com',
        title: 'A',
        text: 'same text body',
        markdown: 'same text body',
        snippet: 'same',
        qualityScore: 0.7,
        confidence: 0.7,
        extractedAt: '2026-03-11T00:00:00.000Z',
        sourceQuery: 'a',
      },
      {
        url: 'https://example.com/b',
        finalUrl: 'https://example.com/b',
        domain: 'example.com',
        title: 'A',
        text: 'same text body',
        markdown: 'same text body',
        snippet: 'same',
        qualityScore: 0.7,
        confidence: 0.7,
        extractedAt: '2026-03-11T00:00:00.000Z',
        sourceQuery: 'a',
      },
    ]);

    expect(result.documents).toHaveLength(1);
    expect(result.duplicateRatio).toBeGreaterThan(0);
    expect(result.filteredCount).toBe(0);
  });

  it('filters thin content before ranking the corpus', () => {
    const result = dedupeResearchDocuments([
      {
        url: 'https://example.com/thin',
        finalUrl: 'https://example.com/thin',
        domain: 'example.com',
        title: 'Thin',
        text: 'too short',
        markdown: 'too short',
        snippet: 'short',
        qualityScore: 0.7,
        confidence: 0.7,
        extractedAt: '2026-03-11T00:00:00.000Z',
        sourceQuery: 'a',
      },
      {
        url: 'https://example.com/full',
        finalUrl: 'https://example.com/full',
        domain: 'example.com',
        title: 'Full',
        text: 'This is a more complete research document body with enough content to survive thin-content filtering and support document analysis.',
        markdown: 'This is a more complete research document body with enough content to survive thin-content filtering and support document analysis.',
        snippet: 'full',
        qualityScore: 0.8,
        confidence: 0.75,
        extractedAt: '2026-03-11T00:00:00.000Z',
        sourceQuery: 'b',
      },
    ]);

    expect(result.documents).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });
});
