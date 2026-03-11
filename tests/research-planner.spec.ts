import { describe, expect, it } from 'vitest';
import { buildResearchPlan } from '../src/research/planner.js';

describe('buildResearchPlan', () => {
  it('builds a plan with generated queries and source types', () => {
    const plan = buildResearchPlan({
      topic: '台灣 CRM 市場',
      goal: 'compare',
      region: '台灣',
      timeRange: '近三年',
      language: 'zh-TW',
      sourcePreferences: ['論壇', '官方網站'],
      freshness: 'year',
      maxBudgetPages: 80,
      maxRuntimeMinutes: 30,
      outputFormat: 'comparison',
    });

    expect(plan.queries.length).toBeGreaterThan(1);
    expect(plan.sourceTypes).toContain('official sites');
    expect(plan.stopConditions.some((item) => item.includes('max pages'))).toBe(true);
  });
});
