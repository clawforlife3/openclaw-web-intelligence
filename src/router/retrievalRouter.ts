export type RetrievalMode = 'search' | 'extract' | 'map' | 'crawl' | 'interact';

export function route(mode: RetrievalMode): RetrievalMode {
  return mode;
}
