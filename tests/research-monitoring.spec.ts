import { describe, expect, it, vi } from 'vitest';

const monitorMock = vi.fn();

vi.mock('../src/research/gateway.js', () => ({
  researchTopic: vi.fn(async ({ topic }: { topic: string }) => ({
    success: true,
    data: {
      taskId: `research_for_${topic}`,
      report: {
        executiveSummary: `Research report refreshed for ${topic}.`,
        keyInsights: [`Fresh monitoring insight for ${topic}.`],
      },
    },
    meta: {},
  })),
}));

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
  monitor: monitorMock,
}));

const { getMonitorTopicTask, getMonitorTopicTaskList, monitorTopic, rerunMonitorTopicTask } = await import('../src/research/monitoring.js');

describe('monitorTopic', () => {
  monitorMock.mockImplementation(async ({ target }: { target: string }) => ({
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
  }));

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
    expect(result.data.relatedResearchTaskId).toBe('research_for_品牌負評');
    expect(result.data.reportSummary).toContain('品牌負評');
    expect(result.data.reportInsights?.length).toBeGreaterThan(0);
    expect(result.data.trendSummary).toContain('Initial monitoring baseline');
    expect(result.data.persistentSignals).toHaveLength(0);
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
    expect(stored?.latestResearchTaskId).toBe('research_for_AI SEO 工具');
    expect(stored?.researchTaskIds).toContain('research_for_AI SEO 工具');
    expect(stored?.runHistory).toHaveLength(1);

    monitorMock.mockImplementationOnce(async ({ target }: { target: string }) => ({
      success: true,
      data: {
        monitorJobId: 'mon_2',
        status: 'checked',
        changed: target.includes('news'),
        change: {
          changed: target.includes('news'),
          fields: target.includes('news') ? ['title'] : [],
          summary: target.includes('news') ? ['Headline sentiment shifted.'] : ['No meaningful change detected.'],
        },
        snapshot: {},
      },
      meta: {},
    }));
    monitorMock.mockImplementationOnce(async ({ target }: { target: string }) => ({
      success: true,
      data: {
        monitorJobId: 'mon_3',
        status: 'checked',
        changed: false,
        change: {
          changed: false,
          fields: [],
          summary: ['No meaningful change detected.'],
        },
        snapshot: {},
      },
      meta: {},
    }));

    const rerun = await rerunMonitorTopicTask(created.data.taskId);
    expect(rerun?.data.runCount).toBe(2);
    expect(rerun?.data.relatedResearchTaskId).toBe('research_for_AI SEO 工具');
    expect(rerun?.data.newSignals).toContain('https://news.example.com/post');
    expect(rerun?.data.droppedSignals).toContain('https://forum.example.com/thread');
    expect(rerun?.data.trendSummary).toContain('new signals');

    const tasks = getMonitorTopicTaskList();
    expect(tasks.some((task) => task.taskId === created.data.taskId)).toBe(true);
    const updated = getMonitorTopicTask(created.data.taskId);
    expect(updated?.runHistory).toHaveLength(2);
  });
});
