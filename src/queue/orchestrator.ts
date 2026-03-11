import { createHash } from 'node:crypto';

export interface ClusterWorker {
  workerId: string;
  region: string;
  namespaces: string[];
  capacity: number;
  activeJobs: number;
}

export interface ClusterJob {
  jobId: string;
  namespace: string;
  preferredRegion?: string;
}

export interface ClusterAssignment {
  workerId: string;
  namespace: string;
  region: string;
}

export interface ClusterMetricsSnapshot {
  workers: number;
  activeJobs: number;
  namespaces: Record<string, number>;
  regions: Record<string, number>;
}

export class ClusterCoordinator {
  private readonly workers = new Map<string, ClusterWorker>();

  registerWorker(worker: ClusterWorker): void {
    this.workers.set(worker.workerId, worker);
  }

  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
  }

  assign(job: ClusterJob): ClusterAssignment | null {
    const candidates = Array.from(this.workers.values())
      .filter((worker) => worker.namespaces.includes(job.namespace) && worker.activeJobs < worker.capacity)
      .sort((a, b) => {
        if (job.preferredRegion && a.region === job.preferredRegion && b.region !== job.preferredRegion) return -1;
        if (job.preferredRegion && b.region === job.preferredRegion && a.region !== job.preferredRegion) return 1;
        return a.activeJobs - b.activeJobs;
      });

    const selected = candidates[0];
    if (!selected) return null;
    selected.activeJobs += 1;
    return {
      workerId: selected.workerId,
      namespace: job.namespace,
      region: selected.region,
    };
  }

  complete(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.activeJobs = Math.max(0, worker.activeJobs - 1);
  }

  getMetrics(): ClusterMetricsSnapshot {
    const namespaces: Record<string, number> = {};
    const regions: Record<string, number> = {};
    let activeJobs = 0;

    for (const worker of this.workers.values()) {
      activeJobs += worker.activeJobs;
      regions[worker.region] = (regions[worker.region] ?? 0) + 1;
      for (const namespace of worker.namespaces) {
        namespaces[namespace] = (namespaces[namespace] ?? 0) + 1;
      }
    }

    return {
      workers: this.workers.size,
      activeJobs,
      namespaces,
      regions,
    };
  }
}

export function buildNamespace(base: string, clusterId: string): string {
  return `${clusterId}:${base}`;
}

export function chooseRegion(url: string, availableRegions: string[]): string {
  const hash = createHash('md5').update(url).digest('hex');
  return availableRegions[parseInt(hash.slice(0, 8), 16) % availableRegions.length];
}
