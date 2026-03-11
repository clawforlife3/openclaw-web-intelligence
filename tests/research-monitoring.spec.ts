import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/monitor/monitor.js', () => ({
  monitor: vi.fn(async ({ target }: { target: string }) => ({
    success: true,
    data: {
      monitorJobId: 'mon_1',
      status: 'checked',
      changed: target.includes('forum'),
      change: {
        changed: target.includes('forum'),
        fields: target.includes('forum') ? ['text'] : [],
        summary: target.includes('forum') ? ['Main text content changed.'] : ['No meaningful change detected.'],
      },
      snapshot: {},
    },
    meta: {},
  })),
}));

const { monitorTopic } = await import('../src/research/monitoring.js');

describe('monitorTopic', () => {
  it('aggregates topic monitoring results into task-level output', async () => {
    const result = await monitorTopic({
      topic: '品牌負評',
      watchDomains: ['news.example.com', 'forum.example.com'],
      queryTemplates: [],
      schedule: 'every 1d',
      diffMode: 'field',
    });

    expect(result.data.watchList).toHaveLength(2);
    expect(result.data.changedPages).toHaveLength(1);
    expect(result.data.alerts.length).toBeGreaterThan(0);
  });
});
