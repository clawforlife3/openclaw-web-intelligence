import { z } from 'zod';
import { logExtractRequest } from '../../observability/requestLogger.js';
import { ExtractError } from '../../types/errors.js';
import { generateRequestId, generateTraceId } from '../../types/utils.js';
import { SearchRequestSchema, SearchResponseSchema, type SearchResponse } from '../../types/schemas.js';
import { DdgsAdapter } from './ddgsAdapter.js';

const adapter = new DdgsAdapter();

type SearchRequestInput = z.input<typeof SearchRequestSchema>;

export async function search(request: SearchRequestInput): Promise<SearchResponse> {
  const requestId = generateRequestId();
  const traceId = generateTraceId();
  const started = Date.now();

  try {
    const input = SearchRequestSchema.parse(request);

    // Map API spec fields to adapter fields (backward compat)
    const limit = input.maxResults || 10;
    const mode = input.topic || 'general';

    const data = await adapter.search(input.query, {
      limit,
      includeDomains: input.includeDomains,
      excludeDomains: input.excludeDomains,
      mode,
    });

    // Add rank to results
    const rankedResults = data.results.map((r: { url?: string; title?: string; snippet?: string; source?: string }, idx: number) => ({
      ...r,
      rank: idx + 1,
      domain: r.url ? new URL(r.url).hostname : undefined,
    }));

    const output: SearchResponse = {
      success: true,
      data: {
        query: input.query,
        results: rankedResults,
        provider: data.provider,
      },
      meta: {
        requestId,
        traceId,
        tookMs: Date.now() - started,
        schemaVersion: 'v1',
      },
    };

    // Validate
    SearchResponseSchema.parse(output);

    await logExtractRequest({
      requestId,
      urlCount: data.results.length,
      status: 'ok',
      tookMs: Date.now() - started,
    });

    return output;
  } catch (err) {
    const known = err instanceof ExtractError
      ? err
      : new ExtractError('SEARCH_ERROR', (err as Error).message || 'Search failed', true);

    await logExtractRequest({
      requestId,
      urlCount: 0,
      status: 'error',
      tookMs: Date.now() - started,
      errorCode: known.code,
      errorMessage: known.message,
    });

    throw known;
  }
}
