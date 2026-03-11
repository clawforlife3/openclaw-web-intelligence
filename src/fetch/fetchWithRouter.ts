import { browserFetch } from './browserFetcher.js';
import { staticFetch, type StaticFetchRequest, type StaticFetchResult } from './staticFetcher.js';
import { route, type RouteDecision, type RouteInput } from '../router/retrievalRouter.js';
import { ExtractError } from '../types/errors.js';

export interface RoutedFetchRequest extends StaticFetchRequest {
  mode: RouteInput['mode'];
  renderMode?: RouteInput['renderMode'];
  htmlHint?: string;
  previousConfidence?: number;
  hostPolicyStrategy?: 'static' | 'browser' | 'unknown';
}

export interface RoutedFetchResult {
  fetchResult: StaticFetchResult;
  decision: RouteDecision;
  fallbackUsed: boolean;
}

export async function fetchWithRouter(request: RoutedFetchRequest): Promise<RoutedFetchResult> {
  const decision = route({
    mode: request.mode,
    renderMode: request.renderMode,
    url: request.url,
    htmlHint: request.htmlHint,
    previousConfidence: request.previousConfidence,
    hostPolicyStrategy: request.hostPolicyStrategy,
  });

  try {
    if (decision.strategy === 'browser') {
      const browserResult = await browserFetch(request);
      return {
        fetchResult: browserResult,
        decision,
        fallbackUsed: false,
      };
    }

    const staticResult = await staticFetch(request);
    return {
      fetchResult: staticResult,
      decision,
      fallbackUsed: false,
    };
  } catch (err) {
    if (
      err instanceof ExtractError
      && err.code === 'BROWSER_UNAVAILABLE'
      && decision.strategy === 'browser'
      && decision.allowFallback
      && decision.fallbackStrategy === 'static'
    ) {
      const staticResult = await staticFetch(request);
      return {
        fetchResult: staticResult,
        decision,
        fallbackUsed: true,
      };
    }
    throw err;
  }
}
