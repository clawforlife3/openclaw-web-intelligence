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
const { loadRegisteredTask } = await import('../src/research/taskRegistry.js');
const { listMonitoringDeliveries } = await import('../src/research/delivery.js');

describe('task registry and delivery', () => {
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

  it('registers related monitor/research tasks and stores delivered digests', async () => {
    const result = await monitorTopic({
      topic: '品牌監控',
      watchDomains: [],
      queryTemplates: [],
      schedule: 'every 1d',
      diffMode: 'field',
    });

    const monitorTask = loadRegisteredTask(result.data.taskId);
    expect(monitorTask?.taskType).toBe('monitor_topic');
    expect(monitorTask?.relatedTaskIds).toContain('research_for_品牌監控');

    const relatedTask = loadRegisteredTask('research_for_品牌監控');
    expect(relatedTask?.taskType).toBe('research_topic');

    const deliveries = listMonitoringDeliveries();
    const matchingDelivery = deliveries.find((delivery) => delivery.taskId === result.data.taskId);
    expect(matchingDelivery).toBeTruthy();
    expect(matchingDelivery?.title).toContain('品牌監控');
  });
});
