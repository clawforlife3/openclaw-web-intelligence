export type ExtractErrorCode =
  | 'VALIDATION_ERROR'
  | 'DOMAIN_POLICY_DENIED'
  | 'SEARCH_ERROR'
  | 'FETCH_TIMEOUT'
  | 'FETCH_HTTP_ERROR'
  | 'PARSE_ERROR'
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
