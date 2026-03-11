export type RetrievalMode = 'search' | 'extract' | 'map' | 'crawl' | 'interact';
export type FetchStrategy = 'static' | 'browser';

export interface RouteInput {
  mode: RetrievalMode;
  renderMode?: 'auto' | 'static' | 'browser';
  url?: string;
  htmlHint?: string;
  previousConfidence?: number;
}

export interface RouteDecision {
  mode: RetrievalMode;
  strategy: FetchStrategy;
  allowFallback: boolean;
  fallbackStrategy?: FetchStrategy;
  reason: string;
}

function shouldSuggestBrowser(input: RouteInput): boolean {
  if (!input.htmlHint) return false;

  const hint = input.htmlHint.toLowerCase();
  const frameworkMarkers = [
    'id="root"',
    "id='root'",
    'id="app"',
    "id='app'",
    'id="__next"',
    '__next',
    'data-reactroot',
    'data-react-checksum',
    'ng-version',
    'nuxt',
    '__nuxt',
    '__remix',
    'data-server-rendered',
    'webpack',
    'vite',
  ];

  const noscriptShell = /<noscript[\s>][\s\S]*?(enable javascript|requires javascript|javascript to run)/i.test(input.htmlHint);
  const scriptCount = (hint.match(/<script\b/g) || []).length;
  const contentTagCount = (hint.match(/<(p|li|article|section|main|h1|h2|h3)\b/g) || []).length;

  return frameworkMarkers.some((marker) => hint.includes(marker))
    || noscriptShell
    || (scriptCount >= 5 && contentTagCount <= 2);
}

export function route(input: RouteInput): RouteDecision {
  if (input.renderMode === 'browser') {
    return {
      mode: input.mode,
      strategy: 'browser',
      allowFallback: false,
      reason: 'User explicitly requested browser rendering.',
    };
  }

  if (input.renderMode === 'static') {
    return {
      mode: input.mode,
      strategy: 'static',
      allowFallback: false,
      reason: 'User explicitly requested static rendering.',
    };
  }

  if (input.previousConfidence !== undefined && input.previousConfidence < 0.55) {
    return {
      mode: input.mode,
      strategy: 'browser',
      allowFallback: false,
      reason: 'Low-confidence static extraction suggests browser rendering.',
    };
  }

  if (shouldSuggestBrowser(input)) {
    return {
      mode: input.mode,
      strategy: 'browser',
      allowFallback: true,
      fallbackStrategy: 'static',
      reason: 'HTML/framework hints suggest the page may require browser rendering.',
    };
  }

  return {
    mode: input.mode,
    strategy: 'static',
    allowFallback: input.mode === 'extract' || input.mode === 'crawl',
    fallbackStrategy: 'browser',
    reason: 'Default to static fetch first; browser remains fallback path for Phase 2.',
  };
}
