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
  search: vi.fn(async () => ({
    success: true,
    data: {
      query: 'mock',
      provider: 'mock',
      results: [
        {
          url: 'https://news.example.com/post',
          title: 'News result',
          snippet: 'News snippet',
          rank: 1,
          domain: 'news.example.com',
        },
      ],
    },
    meta: {},
  })),
}));

vi.mock('../src/monitor/monitor.js', () => ({
  monitor: monitorMock,
}));

const { monitorTopic } = await import('../src/research/monitoring.js');
const { buildTaskBriefing, buildTopicBriefing } = await import('../src/research/briefing.js');

describe('research briefing', () => {
  monitorMock.mockImplementation(async () => ({
    success: true,
    data: {
      monitorJobId: 'mon_1',
      status: 'checked',
      changed: true,
      change: {
        changed: true,
        fields: ['text'],
        summary: ['Main text content changed.'],
      },
      snapshot: {},
    },
    meta: {},
  }));

  it('builds task and topic briefings from stored orchestration state', async () => {
    const created = await monitorTopic({
      topic: '品牌簡報',
      watchDomains: [],
      queryTemplates: [],
      schedule: 'every 1d',
      diffMode: 'field',
    });

    const taskBriefing = buildTaskBriefing(created.data.taskId);
    expect(taskBriefing?.taskId).toBe(created.data.taskId);
    expect(taskBriefing?.summary).toContain('品牌簡報');
    expect(taskBriefing?.highlights.length).toBeGreaterThan(0);

    const topicBriefing = buildTopicBriefing('品牌簡報');
    expect(topicBriefing.monitoringDigest.deliveryCount).toBeGreaterThan(0);
    expect(topicBriefing.latestTasks.length).toBeGreaterThan(0);
    expect(topicBriefing.latestTasks.every((task) => task.topic === '品牌簡報')).toBe(true);
    expect(topicBriefing.latestDeliveryTitles.length).toBeGreaterThan(0);
  });
});
