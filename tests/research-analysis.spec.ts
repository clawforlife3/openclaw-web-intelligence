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
          title: 'CRM Pricing Free Trial',
          text: 'CRM pricing plan comparison for Taiwan with free trial and official announcement.',
          markdown: 'CRM pricing plan comparison for Taiwan with free trial and official announcement.',
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
          title: 'CRM Docs Paid Plans',
          text: 'Documentation and guide for CRM setup, paid subscription only and some negative complaint signals.',
          markdown: 'Documentation and guide for CRM setup, paid subscription only and some negative complaint signals.',
          snippet: 'docs',
          qualityScore: 0.78,
          confidence: 0.74,
          extractedAt: '2026-03-11T00:00:00.000Z',
          sourceQuery: 'CRM docs',
          evidenceScore: 0.76,
        },
        {
          url: 'https://third.com/review',
          finalUrl: 'https://third.com/review',
          domain: 'third.com',
          title: 'CRM Best Review',
          text: 'Best recommended CRM with positive sentiment and official release coverage.',
          markdown: 'Best recommended CRM with positive sentiment and official release coverage.',
          snippet: 'review',
          qualityScore: 0.77,
          confidence: 0.73,
          extractedAt: '2026-03-11T00:00:00.000Z',
          sourceQuery: 'CRM review',
          evidenceScore: 0.74,
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
    expect(result.report.agreements.length).toBeGreaterThan(0);
    expect(result.report.contradictions.length).toBeGreaterThan(0);
    expect(result.clusteredDocuments[0]?.clusterId).toBeTruthy();
  });
});
