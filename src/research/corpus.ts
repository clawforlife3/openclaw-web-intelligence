import type { ResearchSource, ResearchTopicRequest } from '../types/schemas.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./|:;()[\]{}'"!?+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function scoreOverlap(topicTokens: string[], text: string): number {
  const tokens = tokenize(text);
  if (tokens.length === 0 || topicTokens.length === 0) return 0.2;
  const tokenSet = new Set(tokens);
  const overlap = topicTokens.filter((token) => tokenSet.has(token)).length;
  return Math.min(1, 0.2 + (overlap / topicTokens.length) * 0.8);
}

function scoreQuality(source: ResearchSource): number {
  const haystack = `${source.title} ${source.snippet}`.toLowerCase();
  if (haystack.includes('compare') || haystack.includes('比較') || haystack.includes('pricing') || haystack.includes('官網')) {
    return 0.85;
  }
  if (haystack.includes('forum') || haystack.includes('討論') || haystack.includes('review') || haystack.includes('評測')) {
    return 0.7;
  }
  return 0.6;
}

export function buildResearchCorpus(
  request: ResearchTopicRequest,
  sources: ResearchSource[],
): { rankedSources: ResearchSource[]; duplicateRatio: number } {
  const topicTokens = unique(tokenize([
    request.topic,
    request.region,
    request.timeRange,
  ].filter(Boolean).join(' ')));

  const domainCounts = new Map<string, number>();
  const ranked = sources.map((source) => {
    const seen = domainCounts.get(source.domain) ?? 0;
    domainCounts.set(source.domain, seen + 1);

    const relevanceScore = scoreOverlap(topicTokens, `${source.title} ${source.snippet} ${source.sourceQuery}`);
    const qualityScore = scoreQuality(source);
    const diversityBoost = seen === 0 ? 0.15 : Math.max(0, 0.15 - (seen * 0.05));
    const evidenceScore = Math.min(1, (relevanceScore * 0.5) + (qualityScore * 0.35) + diversityBoost);

    return {
      ...source,
      relevanceScore,
      qualityScore,
      diversityBoost,
      evidenceScore,
    };
  }).sort((a, b) => b.evidenceScore - a.evidenceScore);

  const duplicateRatio = sources.length === 0 ? 0 : Math.max(0, 1 - (ranked.length / sources.length));
  return { rankedSources: ranked, duplicateRatio };
}
