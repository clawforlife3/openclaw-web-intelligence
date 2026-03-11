import { describe, expect, it } from 'vitest';
import { buildResearchReport } from '../src/research/analysis.js';

describe('buildResearchReport', () => {
  it('builds clusters and comparison rows for compare goals', () => {
    const result = buildResearchReport({
      request: {
        topic: '台灣 CRM 市場',
        goal: 'compare',
        language: 'zh-TW',
        sourcePreferences: [],
        freshness: 'year',
        maxBudgetPages: 20,
        maxRuntimeMinutes: 20,
        outputFormat: 'comparison',
      },
      documents: [
        {
          url: 'https://example.com/pricing',
          finalUrl: 'https://example.com/pricing',
          domain: 'example.com',
          title: 'CRM Pricing',
          text: 'CRM pricing plan comparison for Taiwan',
          markdown: 'CRM pricing plan comparison for Taiwan',
          snippet: 'pricing',
          qualityScore: 0.8,
          confidence: 0.75,
          extractedAt: '2026-03-11T00:00:00.000Z',
          sourceQuery: 'CRM pricing',
          evidenceScore: 0.8,
        },
        {
          url: 'https://another.com/docs',
          finalUrl: 'https://another.com/docs',
          domain: 'another.com',
          title: 'CRM Docs',
          text: 'Documentation and guide for CRM setup',
          markdown: 'Documentation and guide for CRM setup',
          snippet: 'docs',
          qualityScore: 0.78,
          confidence: 0.74,
          extractedAt: '2026-03-11T00:00:00.000Z',
          sourceQuery: 'CRM docs',
          evidenceScore: 0.76,
        },
      ],
      evidence: [{
        url: 'https://example.com/pricing',
        domain: 'example.com',
        title: 'CRM Pricing',
        snippet: 'pricing',
        evidenceScore: 0.8,
      }],
    });

    expect(result.report.clusters.length).toBeGreaterThan(0);
    expect(result.report.comparisons.length).toBeGreaterThan(0);
    expect(result.report.coverageSummary).toContain('documents');
    expect(result.report.trendSignals.length).toBeGreaterThan(0);
    expect(result.clusteredDocuments[0]?.clusterId).toBeTruthy();
  });
});
