import { monitor } from '../monitor/monitor.js';
import { MonitorTopicRequestSchema, MonitorTopicResponseSchema, type MonitorTopicRequest, type MonitorTopicResponse } from '../types/schemas.js';
import { generateRequestId, generateTraceId } from '../types/utils.js';

function buildTopicTargets(topic: string, watchDomains: string[], queryTemplates: string[]): string[] {
  const explicit = watchDomains.map((domain) => domain.startsWith('http') ? domain : `https://${domain}`);
  if (explicit.length > 0) return explicit;
  return queryTemplates
    .slice(0, 3)
    .map((template) => `https://search.invalid/?q=${encodeURIComponent(`${template} ${topic}`)}`);
}

export async function monitorTopic(input: MonitorTopicRequest): Promise<MonitorTopicResponse> {
  const request = MonitorTopicRequestSchema.parse(input);
  const started = Date.now();
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const taskId = `monitor_topic_${Date.now().toString(36)}`;
  const targets = buildTopicTargets(request.topic, request.watchDomains, request.queryTemplates);

  const changedPages: string[] = [];
  const alerts: string[] = [];
  let status: 'created' | 'checked' = 'created';

  for (const target of targets) {
    if (!target.startsWith('http')) continue;
    try {
      const result = await monitor({
        targetType: 'page',
        target,
        schedule: request.schedule,
        diffPolicy: { mode: request.diffMode },
        execution: { operation: 'extract' },
      });
      status = result.data.status === 'checked' ? 'checked' : status;
      if (result.data.changed) {
        changedPages.push(target);
        alerts.push(...(result.data.change?.summary ?? []));
      }
    } catch {
      // Best-effort baseline. Failed targets remain outside changedPages.
    }
  }

  const newFindings = changedPages.length > 0
    ? [`${changedPages.length} monitored pages changed for topic "${request.topic}".`]
    : [`No changed pages detected yet for topic "${request.topic}".`];

  return MonitorTopicResponseSchema.parse({
    success: true,
    data: {
      taskId,
      status,
      topic: request.topic,
      watchList: targets,
      newFindings,
      changedPages,
      alerts,
      updatedSummary: changedPages.length > 0
        ? `Detected changes for topic "${request.topic}" across ${changedPages.length} monitored pages.`
        : `Monitoring baseline created for topic "${request.topic}".`,
    },
    meta: {
      requestId,
      traceId,
      tookMs: Date.now() - started,
      schemaVersion: 'v1',
    },
  });
}
