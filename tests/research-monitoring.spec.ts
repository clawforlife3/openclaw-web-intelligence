import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/engines/search/search.js', () => ({
  search: vi.fn(async ({ query }: { query: string }) => ({
    success: true,
    data: {
      query,
      provider: 'mock',
      results: [
        {
          url: 'https://news.example.com/post',
          title: 'News result',
          snippet: 'News snippet',
          rank: 1,
          domain: 'news.example.com',
        },
        {
          url: 'https://forum.example.com/thread',
          title: 'Forum result',
          snippet: 'Forum snippet',
          rank: 2,
          domain: 'forum.example.com',
        },
      ],
    },
    meta: {},
  })),
}));

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

const { getMonitorTopicTask, getMonitorTopicTaskList, monitorTopic, rerunMonitorTopicTask } = await import('../src/research/monitoring.js');

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
    expect(result.data.runCount).toBe(1);
  });

  it('persists monitoring tasks and supports reruns', async () => {
    const created = await monitorTopic({
      topic: 'AI SEO 工具',
      watchDomains: [],
      queryTemplates: [],
      schedule: 'every 1d',
      diffMode: 'field',
    });

    const stored = getMonitorTopicTask(created.data.taskId);
    expect(stored?.topic).toBe('AI SEO 工具');
    expect(stored?.watchList.length).toBeGreaterThan(0);
    expect(stored?.watchList.some((url) => url.includes('forum.example.com'))).toBe(true);

    const rerun = await rerunMonitorTopicTask(created.data.taskId);
    expect(rerun?.data.runCount).toBe(2);

    const tasks = getMonitorTopicTaskList();
    expect(tasks.some((task) => task.taskId === created.data.taskId)).toBe(true);
  });
});
