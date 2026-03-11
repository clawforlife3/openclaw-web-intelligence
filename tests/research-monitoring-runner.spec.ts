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
const { processDueMonitorTopicTasks } = await import('../src/research/monitoringRunner.js');
const { loadMonitorTopicTask, updateMonitorTopicTask } = await import('../src/research/monitoringStore.js');
const { acquireMonitoringCycleLease, releaseMonitoringCycleLease } = await import('../src/research/runnerState.js');

describe('monitoring runner', () => {
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

  it('processes due monitor tasks in a batch cycle', async () => {
    const created = await monitorTopic({
      topic: '批次監控',
      watchDomains: [],
      queryTemplates: [],
      schedule: 'every 1d',
      diffMode: 'field',
    });

    updateMonitorTopicTask(created.data.taskId, {
      nextRunAt: '2026-03-10T00:00:00.000Z',
    });

    const result = await processDueMonitorTopicTasks({
      now: new Date('2026-03-11T00:00:00.000Z'),
      limit: 10,
    });

    expect(result.skipped).toBe(false);
    expect(result.dueCount).toBeGreaterThan(0);
    expect(result.succeeded).toContain(created.data.taskId);
    expect(result.topicDigests.some((digest) => digest.topic === '批次監控')).toBe(true);

    const updated = loadMonitorTopicTask(created.data.taskId);
    expect(updated?.runCount).toBeGreaterThanOrEqual(2);
  });

  it('skips processing when another cycle lease is active', async () => {
    const lease = acquireMonitoringCycleLease({
      now: new Date('2026-03-11T00:00:00.000Z'),
      ttlMs: 60_000,
      holderId: 'test-holder',
    });
    expect(lease?.holderId).toBe('test-holder');

    const result = await processDueMonitorTopicTasks({
      now: new Date('2026-03-11T00:00:01.000Z'),
      limit: 10,
    });

    expect(result.skipped).toBe(true);
    expect(result.processedCount).toBe(0);

    releaseMonitoringCycleLease('test-holder');
  });
});
