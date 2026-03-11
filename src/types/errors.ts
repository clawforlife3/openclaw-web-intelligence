export type ExtractErrorCode =
  | 'VALIDATION_ERROR'
  | 'DOMAIN_POLICY_DENIED'
  | 'ROBOTS_POLICY_DENIED'
  | 'SEARCH_ERROR'
  | 'SITEMAP_NOT_FOUND'
  | 'SITEMAP_FETCH_ERROR'
  | 'SITEMAP_TIMEOUT'
  | 'SITEMAP_PARSE_ERROR'
  | 'FETCH_TIMEOUT'
  | 'FETCH_HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'BROWSER_UNAVAILABLE'
  | 'ANTI_BOT_BLOCKED'
  | 'INTERNAL_ERROR';

export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
    public retryable = false,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}
