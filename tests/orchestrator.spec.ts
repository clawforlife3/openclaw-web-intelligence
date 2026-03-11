import { describe, expect, it } from 'vitest';
import { ClusterCoordinator, buildNamespace, chooseRegion } from '../src/queue/orchestrator.js';

describe('ClusterCoordinator', () => {
  it('assigns jobs by namespace and preferred region', () => {
    const coordinator = new ClusterCoordinator();
    coordinator.registerWorker({
      workerId: 'w-us',
      region: 'us-east',
      namespaces: ['cluster-a:crawl'],
      capacity: 2,
      activeJobs: 0,
    });
    coordinator.registerWorker({
      workerId: 'w-ap',
      region: 'ap-sg',
      namespaces: ['cluster-a:crawl'],
      capacity: 2,
      activeJobs: 0,
    });

    const assignment = coordinator.assign({
      jobId: 'job-1',
      namespace: 'cluster-a:crawl',
      preferredRegion: 'ap-sg',
    });

    expect(assignment?.workerId).toBe('w-ap');
    expect(coordinator.getMetrics().activeJobs).toBe(1);
  });

  it('builds isolated namespaces and deterministic region selection', () => {
    expect(buildNamespace('crawl', 'cluster-a')).toBe('cluster-a:crawl');
    expect(['us-east', 'eu-west']).toContain(chooseRegion('https://example.com', ['us-east', 'eu-west']));
  });
});
