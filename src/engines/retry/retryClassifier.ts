/**
 * Retry classification taxonomy for browser fallback decisions.
 * This provides standardized retry reasons that can be tracked for observability
 * and later used for host policy memory.
 */

/**
 * Standardized retry reason categories
 */
export type RetryReason =
  // Shell detection
  | 'js_app_shell_detected'
  | 'noscript_shell_detected'
  | 'dom_shell_detected'
  // Content quality
  | 'low_confidence'
  | 'low_text_high_script_ratio'
  | 'thin_static_content'
  // Server/Network
  | 'http_error_retry'
  | 'timeout_retry';

/**
 * Fetch outcome classification
 */
export type FetchOutcome =
  | 'success_static'      // Static fetch succeeded directly
  | 'success_browser'    // Browser fetch succeeded directly  
  | 'success_retry'      // Succeeded after retry
  | 'failed_static'      // Static fetch failed
  | 'failed_browser'    // Browser fetch failed
  | 'blocked_robots'   // Blocked by robots.txt
  | 'blocked_policy'   // Blocked by domain policy
  | 'error';           // Other errors

/**
 * Mapping from retry reasons to outcome categories
 */
export function classifyOutcome(
  fetchOutcome: FetchOutcome,
  retryReason?: RetryReason,
  autoRetried?: boolean,
): {
  outcome: FetchOutcome;
  retryCount: number;
  neededRetry: boolean;
  wasShellDetection: boolean;
} {
  const neededRetry = autoRetried === true || !!retryReason;
  
  // Check if retry was due to shell detection (important for host policy learning)
  const wasShellDetection = retryReason
    ? ['js_app_shell_detected', 'noscript_shell_detected', 'dom_shell_detected'].includes(retryReason)
    : false;

  return {
    outcome: fetchOutcome,
    retryCount: neededRetry ? 1 : 0,
    neededRetry,
    wasShellDetection,
  };
}

/**
 * Get all known retry reasons for documentation/testing
 */
export function getRetryReasonLabels(): Record<RetryReason, string> {
  return {
    js_app_shell_detected: 'JS app shell detected (React/Next/Nuxt/Remix markers)',
    noscript_shell_detected: 'Noscript shell detected',
    dom_shell_detected: 'Empty DOM with high script count',
    low_confidence: 'Low extraction confidence score',
    low_text_high_script_ratio: 'Low text content with high script ratio',
    thin_static_content: 'Thin static content detected',
    http_error_retry: 'HTTP error triggered retry',
    timeout_retry: 'Timeout triggered retry',
  };
}

/**
 * Check if a retry reason indicates shell detection
 */
export function isShellDetectionReason(reason?: string): boolean {
  if (!reason) return false;
  return ['js_app_shell_detected', 'noscript_shell_detected', 'dom_shell_detected'].includes(reason);
}
