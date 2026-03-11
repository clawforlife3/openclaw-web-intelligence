import type { ResearchDocument, ResearchEvidence, ResearchFinding, ResearchSource, ResearchTopicRequest } from '../types/schemas.js';

function topDomains(sources: ResearchSource[]): string[] {
  const counts = new Map<string, number>();
  for (const source of sources) {
    counts.set(source.domain, (counts.get(source.domain) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);
}

export function buildResearchFindings(
  request: ResearchTopicRequest,
  sources: ResearchSource[],
  documents: ResearchDocument[],
): ResearchFinding[] {
  const domains = topDomains(sources);
  const findings: ResearchFinding[] = [
    {
      label: 'coverage',
      detail: `Collected ${sources.length} candidate sources and ${documents.length} extracted documents across ${new Set(sources.map((source) => source.domain)).size} domains for topic "${request.topic}".`,
    },
  ];

  if (domains.length > 0) {
    findings.push({
      label: 'top_domains',
      detail: `Most represented domains: ${domains.join(', ')}.`,
    });
  }

  const highSignal = sources.filter((source) => (source.evidenceScore ?? 0) >= 0.75).length;
  findings.push({
    label: 'high_signal_sources',
    detail: `${highSignal} sources currently pass the high-signal threshold.`,
  });

  if (documents.length > 0) {
    findings.push({
      label: 'document_corpus',
      detail: `Extracted document corpus currently contains ${documents.length} normalized research documents.`,
    });
  }

  return findings;
}

export function buildResearchEvidence(sources: ResearchSource[], limit = 5): ResearchEvidence[] {
  return sources.slice(0, limit).map((source) => ({
    url: source.url,
    domain: source.domain,
    title: source.title,
    snippet: source.snippet,
    evidenceScore: source.evidenceScore ?? 0.5,
  }));
}

export function buildResearchSummary(request: ResearchTopicRequest, sources: ResearchSource[], documents: ResearchDocument[]): string {
  const domains = new Set(sources.map((source) => source.domain)).size;
  const evidence = documents.slice(0, 3).map((document) => document.title || document.domain).join(' / ');
  return `Topic "${request.topic}" was expanded into ${sources.length} ranked sources from ${domains} domains, with ${documents.length} extracted research documents. Top evidence currently centers on: ${evidence || 'no extracted evidence yet'}.`;
}

export function buildConfidenceNotes(sources: ResearchSource[], documents: ResearchDocument[]): string[] {
  const notes: string[] = [];
  if (sources.length < 5) {
    notes.push('Source coverage is still shallow; more discovery is likely needed.');
  }
  if (documents.length === 0) {
    notes.push('No documents were successfully extracted yet; current output is discovery-heavy and should not be treated as final research.');
  }
  const uniqueDomains = new Set(sources.map((source) => source.domain)).size;
  if (uniqueDomains <= 2) {
    notes.push('Domain diversity is limited; findings may be biased toward a narrow source set.');
  }
  const lowQuality = sources.filter((source) => (source.qualityScore ?? 0) < 0.65).length;
  if (lowQuality > 0) {
    notes.push('Some ranked sources are low-confidence and should be validated with extraction and corpus filtering.');
  }
  if (notes.length === 0) {
    notes.push('This is a planning and discovery baseline; extraction and corpus validation should deepen confidence.');
  }
  return notes;
}
