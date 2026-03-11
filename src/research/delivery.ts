import { getCache } from '../storage/cache.js';

export interface MonitoringDeliveryEnvelope {
  taskId: string;
  topic: string;
  severity: 'info' | 'watch' | 'critical';
  title: string;
  summary: string;
  bullets: string[];
  relatedResearchTaskId?: string;
  deliveredAt: string;
}

type DeliveryTarget = 'console' | 'memory';

const DELIVERY_INDEX_KEY = 'research:deliveries:index';

function getStore() {
  return getCache({ enabled: true, ttlSeconds: 0 });
}

function makeDeliveryKey(taskId: string, deliveredAt: string): string {
  return `research:delivery:${taskId}:${deliveredAt}`;
}

export function deliverMonitoringEnvelope(
  envelope: MonitoringDeliveryEnvelope,
  target: DeliveryTarget[] = ['memory'],
): void {
  if (target.includes('console')) {
    console.log(JSON.stringify({
      channel: 'monitoring_digest',
      ...envelope,
    }));
  }

  if (target.includes('memory')) {
    const store = getStore();
    store.set(makeDeliveryKey(envelope.taskId, envelope.deliveredAt), envelope);
    const index = (store.get(DELIVERY_INDEX_KEY) as string[] | null) ?? [];
    index.push(makeDeliveryKey(envelope.taskId, envelope.deliveredAt));
    store.set(DELIVERY_INDEX_KEY, index.slice(-100));
  }
}

export function listMonitoringDeliveries(): MonitoringDeliveryEnvelope[] {
  const store = getStore();
  const index = (store.get(DELIVERY_INDEX_KEY) as string[] | null) ?? [];
  return index
    .map((key) => store.get(key) as MonitoringDeliveryEnvelope | null)
    .filter((item): item is MonitoringDeliveryEnvelope => Boolean(item))
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
}

export function buildTopicMonitoringDigest(topic: string, limit = 5): {
  topic: string;
  deliveryCount: number;
  severities: string[];
  latestSummary?: string;
  highlights: string[];
} {
  const deliveries = listMonitoringDeliveries()
    .filter((delivery) => delivery.topic === topic)
    .slice(0, limit);

  return {
    topic,
    deliveryCount: deliveries.length,
    severities: Array.from(new Set(deliveries.map((delivery) => delivery.severity))),
    latestSummary: deliveries[0]?.summary,
    highlights: deliveries.flatMap((delivery) => delivery.bullets).slice(0, 8),
  };
}
