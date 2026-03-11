import type { MonitorChange, MonitorRequest, MonitorSnapshot } from '../types/schemas.js';
import { incrementMetric } from '../observability/metrics.js';
import { logInfo } from '../observability/logger.js';

export interface AlertPayload {
  monitorJobId: string;
  target: string;
  changed: boolean;
  change: MonitorChange;
  snapshot: MonitorSnapshot;
  checkedAt: string;
}

export interface AlertNotifier {
  name: string;
  send(payload: AlertPayload): Promise<void>;
}

export class ConsoleNotifier implements AlertNotifier {
  name = 'console';
  async send(payload: AlertPayload): Promise<void> {
    logInfo('monitor.alert', 'Monitor alert emitted', {
      target: payload.target,
      changed: payload.changed,
      outcome: payload.changed ? 'change_detected' : 'no_change',
      summary: payload.change.summary.join(' | '),
    });
  }
}

export class WebhookNotifier implements AlertNotifier {
  name = 'webhook';
  constructor(private readonly url: string) {}
  async send(payload: AlertPayload): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}

export async function notifyIfNeeded(
  request: MonitorRequest,
  payload: AlertPayload,
  notifier: AlertNotifier = new ConsoleNotifier(),
): Promise<void> {
  const policy = request.notifyPolicy ?? { cooldownMinutes: 180, onlyOnChange: true };
  if (policy.onlyOnChange && !payload.changed) return;
  await notifier.send(payload);
  incrementMetric('alertsSent');
}
