import type {
  ResearchCluster,
  ResearchComparisonRow,
  ResearchDocument,
  ResearchEvidence,
  ResearchReport,
  ResearchTopicRequest,
} from '../types/schemas.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./|:;()[\]{}'"!?+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function detectLabel(document: ResearchDocument): string {
  const path = new URL(document.finalUrl).pathname.toLowerCase();
  const title = (document.title || '').toLowerCase();
  const text = `${title} ${path}`;

  if (text.includes('pricing') || text.includes('price') || text.includes('plan') || text.includes('費用')) return 'pricing';
  if (text.includes('docs') || text.includes('guide') || text.includes('reference')) return 'docs';
  if (text.includes('review') || text.includes('評測') || text.includes('評價')) return 'reviews';
  if (text.includes('forum') || text.includes('discussion') || text.includes('討論')) return 'discussion';
  if (text.includes('blog') || text.includes('news') || text.includes('article')) return 'articles';
  return 'general';
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function clusterResearchDocuments(documents: ResearchDocument[]): ResearchCluster[] {
  const buckets = new Map<string, ResearchDocument[]>();
  for (const document of documents) {
    const label = detectLabel(document);
    buckets.set(label, [...(buckets.get(label) ?? []), document]);
  }

  return Array.from(buckets.entries()).map(([label, docs], index) => ({
    clusterId: `cluster_${index + 1}_${label}`,
    label,
    documentUrls: docs.map((doc) => doc.url),
    domains: unique(docs.map((doc) => doc.domain)),
  }));
}

export function assignClusterIds(documents: ResearchDocument[], clusters: ResearchCluster[]): ResearchDocument[] {
  const lookup = new Map<string, string>();
  for (const cluster of clusters) {
    for (const url of cluster.documentUrls) {
      lookup.set(url, cluster.clusterId);
    }
  }
  return documents.map((document) => ({
    ...document,
    clusterId: lookup.get(document.url),
  }));
}

function extractComparisonValues(documents: ResearchDocument[]): ResearchComparisonRow[] {
  const topDocs = documents.slice(0, 5);
  if (topDocs.length === 0) return [];

  const domainValues = Object.fromEntries(topDocs.map((doc) => [doc.domain, doc.title || doc.domain]));
  const qualityValues = Object.fromEntries(topDocs.map((doc) => [doc.domain, (doc.qualityScore ?? 0).toFixed(2)]));
  const confidenceValues = Object.fromEntries(topDocs.map((doc) => [doc.domain, (doc.confidence ?? 0).toFixed(2)]));
  const clusterValues = Object.fromEntries(topDocs.map((doc) => [doc.domain, detectLabel(doc)]));
  const evidenceValues = Object.fromEntries(topDocs.map((doc) => [doc.domain, ((doc.evidenceScore ?? 0)).toFixed(2)]));

  return [
    { label: 'top_document', values: domainValues },
    { label: 'quality_score', values: qualityValues },
    { label: 'confidence', values: confidenceValues },
    { label: 'content_type', values: clusterValues },
    { label: 'evidence_score', values: evidenceValues },
  ];
}

function buildCoverageSummary(documents: ResearchDocument[], clusters: ResearchCluster[]): string {
  const domains = unique(documents.map((doc) => doc.domain));
  return `Coverage spans ${documents.length} documents across ${domains.length} domains and ${clusters.length} content clusters.`;
}

function buildTrendSignals(request: ResearchTopicRequest, documents: ResearchDocument[], clusters: ResearchCluster[]): string[] {
  const signals: string[] = [];
  const labels = clusters.map((cluster) => cluster.label);

  if (labels.includes('pricing')) {
    signals.push(`Pricing-related evidence is active in the current "${request.topic}" corpus.`);
  }
  if (labels.includes('discussion') || labels.includes('reviews')) {
    signals.push(`Community or review signals are present for "${request.topic}".`);
  }
  if (labels.includes('docs')) {
    signals.push(`Documentation-style evidence suggests deeper product maturity signals for "${request.topic}".`);
  }

  const highConfidence = documents.filter((doc) => (doc.confidence ?? 0) >= 0.75).length;
  if (highConfidence > 0) {
    signals.push(`${highConfidence} documents currently clear the high-confidence threshold.`);
  }

  return signals;
}

function buildUncertainties(documents: ResearchDocument[], evidence: ResearchEvidence[]): string[] {
  const notes: string[] = [];
  const uniqueDomains = unique(documents.map((doc) => doc.domain)).length;

  if (documents.length < 4) {
    notes.push('Document corpus is still small; broad conclusions may be premature.');
  }
  if (uniqueDomains <= 2) {
    notes.push('Domain diversity remains limited and may bias the analysis.');
  }
  if (evidence.length < 3) {
    notes.push('Evidence set is narrow; more corroborating sources would improve confidence.');
  }

  return notes;
}

function buildInsights(request: ResearchTopicRequest, documents: ResearchDocument[], clusters: ResearchCluster[]): string[] {
  const insights: string[] = [];
  insights.push(`The current corpus contains ${documents.length} extracted documents grouped into ${clusters.length} thematic clusters.`);

  const topCluster = clusters[0];
  if (topCluster) {
    insights.push(`The strongest visible content pattern is "${topCluster.label}" across domains ${topCluster.domains.join(', ')}.`);
  }

  const terms = documents.flatMap((doc) => tokenize(`${doc.title || ''} ${doc.text.slice(0, 400)}`));
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  const topTerms = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([term]) => term);
  if (topTerms.length > 0) {
    insights.push(`Common recurring terms for "${request.topic}" include: ${topTerms.join(', ')}.`);
  }

  return insights;
}

export function buildResearchReport(input: {
  request: ResearchTopicRequest;
  documents: ResearchDocument[];
  evidence: ResearchEvidence[];
}): { report: ResearchReport; clusteredDocuments: ResearchDocument[] } {
  const clusters = clusterResearchDocuments(input.documents);
  const clusteredDocuments = assignClusterIds(input.documents, clusters);
  const insights = buildInsights(input.request, clusteredDocuments, clusters);
  const comparisons = input.request.goal === 'compare'
    ? extractComparisonValues(clusteredDocuments)
    : [];

  return {
    clusteredDocuments,
    report: {
      executiveSummary: `Research report for "${input.request.topic}" built from ${clusteredDocuments.length} extracted documents and ${input.evidence.length} top evidence items.`,
      coverageSummary: buildCoverageSummary(clusteredDocuments, clusters),
      keyInsights: insights,
      trendSignals: buildTrendSignals(input.request, clusteredDocuments, clusters),
      uncertainties: buildUncertainties(clusteredDocuments, input.evidence),
      comparisons,
      clusters,
      citations: input.evidence,
    },
  };
}
