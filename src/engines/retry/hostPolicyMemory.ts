/**
 * Host policy memory - remembers fetch outcomes per host to improve routing decisions.
 * This is a lightweight in-memory implementation that can be extended to persistence later.
 */

import type { FetchOutcome } from '../../types/schemas.js';

export interface HostPolicy {
  host: string;
  preferredStrategy: 'static' | 'browser' | 'unknown';
  successRate: number;
  totalAttempts: number;
  successfulAttempts: number;
  shellDetectionRate: number;
  lastUpdated: string;
  recentOutcomes: FetchOutcome[];
}

interface HostPolicyStore {
  [host: string]: HostPolicy;
}

// In-memory store (can be replaced with persistence later)
const hostPolicyStore: HostPolicyStore = {};

// Configuration
const MAX_RECENT_OUTCOMES = 20;
const SHELL_DETECTION_THRESHOLD = 0.3; // 30% shell detection rate triggers browser preference
const SUCCESS_RATE_THRESHOLD = 0.7; // 70% success rate threshold

function normalizeHost(urlOrHost: string): string {
  try {
    const url = new URL(urlOrHost);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlOrHost.replace(/^www\./, '').toLowerCase();
  }
}

function getOrCreatePolicy(host: string): HostPolicy {
  const normalized = normalizeHost(host);
  if (!hostPolicyStore[normalized]) {
    hostPolicyStore[normalized] = {
      host: normalized,
      preferredStrategy: 'unknown',
      successRate: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
      shellDetectionRate: 0,
      lastUpdated: new Date().toISOString(),
      recentOutcomes: [],
    };
  }
  return hostPolicyStore[normalized];
}

function isShellDetectionOutcome(outcome: FetchOutcome): boolean {
  // We don't have retryReason here, but we can infer from outcome patterns
  return outcome === 'failed_static' || outcome === 'failed_browser';
}

export function recordFetchOutcome(
  host: string,
  outcome: FetchOutcome,
  wasShellDetection?: boolean,
): void {
  const policy = getOrCreatePolicy(host);
  const now = new Date().toISOString();

  // Update counters
  policy.totalAttempts += 1;
  if (outcome.startsWith('success') || outcome === 'blocked_robots' || outcome === 'blocked_policy') {
    policy.successfulAttempts += 1;
  }

  // Track shell detection
  if (wasShellDetection) {
    policy.shellDetectionRate = ((policy.shellDetectionRate * (policy.totalAttempts - 1)) + 1) / policy.totalAttempts;
  }

  // Update recent outcomes
  policy.recentOutcomes.push(outcome);
  if (policy.recentOutcomes.length > MAX_RECENT_OUTCOMES) {
    policy.recentOutcomes.shift();
  }

  // Calculate success rate
  policy.successRate = policy.successfulAttempts / policy.totalAttempts;

  // Determine preferred strategy based on outcomes
  const recentBrowserSuccess = policy.recentOutcomes.filter(
    (o) => o === 'success_browser' || o === 'success_retry',
  ).length;
  const recentStaticSuccess = policy.recentOutcomes.filter((o) => o === 'success_static').length;
  const recentTotal = policy.recentOutcomes.length;

  if (recentTotal >= 3) {
    if (policy.shellDetectionRate > SHELL_DETECTION_THRESHOLD) {
      policy.preferredStrategy = 'browser';
    } else if (recentBrowserSuccess > recentStaticSuccess * 2 && recentBrowserSuccess >= 3) {
      policy.preferredStrategy = 'browser';
    } else if (recentStaticSuccess > recentBrowserSuccess * 2 && recentStaticSuccess >= 3) {
      policy.preferredStrategy = 'static';
    } else {
      policy.preferredStrategy = 'unknown';
    }
  }

  policy.lastUpdated = now;
}

export function getHostPolicy(host: string): HostPolicy | null {
  const normalized = normalizeHost(host);
  return hostPolicyStore[normalized] || null;
}

export function getPreferredStrategy(host: string): 'static' | 'browser' | 'unknown' {
  const policy = getHostPolicy(host);
  if (!policy || policy.totalAttempts < 3) {
    return 'unknown';
  }
  return policy.preferredStrategy;
}

export function getHostPolicyStats(): HostPolicy[] {
  return Object.values(hostPolicyStore);
}

export function clearHostPolicy(host?: string): void {
  if (host) {
    const normalized = normalizeHost(host);
    delete hostPolicyStore[normalized];
  } else {
    // Clear all
    Object.keys(hostPolicyStore).forEach((key) => delete hostPolicyStore[key]);
  }
}
