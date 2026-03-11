export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  traceId?: string;
  requestId?: string;
  jobId?: string;
  workerId?: string;
  domain?: string;
  proxyId?: string;
  retryCount?: number;
  retryReason?: string;
  outcome?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  event: string;
  message: string;
  timestamp: string;
  context?: LogContext;
}

function serialize(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export function logEvent(level: LogLevel, event: string, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    level,
    event,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  const line = serialize(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, message: string, context?: LogContext): void {
  logEvent('info', event, message, context);
}

export function logWarn(event: string, message: string, context?: LogContext): void {
  logEvent('warn', event, message, context);
}

export function logError(event: string, message: string, context?: LogContext): void {
  logEvent('error', event, message, context);
}
