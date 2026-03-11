import { describe, expect, it } from 'vitest';
import { buildResearchCorpus } from '../src/research/corpus.js';

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
});
