import { extract } from '../engines/extract/httpExtractor.js';
import type { ResearchDocument, ResearchSource, ResearchTopicRequest } from '../types/schemas.js';
import { normalizeResearchStructured } from './normalizeStructured.js';

function makeSnippet(text: string, fallback: string): string {
  const base = text.trim() || fallback.trim();
  return base.slice(0, 220);
}

export async function collectCorpus(
  request: ResearchTopicRequest,
  sources: ResearchSource[],
): Promise<ResearchDocument[]> {
  const docs: ResearchDocument[] = [];
  const maxDocs = Math.min(sources.length, Math.max(5, Math.min(request.maxBudgetPages, 12)));
  const selected = sources.slice(0, maxDocs);

  for (const source of selected) {
    try {
      const result = await extract({
        urls: [source.url],
        includeStructured: true,
        includeLinks: true,
        cacheTtlSeconds: 300,
        renderMode: 'auto',
      });

      const doc = result.data.documents[0];
      if (!doc) continue;

      docs.push({
        url: doc.url,
        finalUrl: doc.finalUrl,
        domain: new URL(doc.finalUrl).hostname,
        title: doc.title,
        text: doc.text,
        markdown: doc.markdown,
        snippet: makeSnippet(doc.text, source.snippet),
        qualityScore: doc.sourceQuality ?? source.qualityScore ?? 0.6,
        confidence: doc.confidence ?? 0.6,
        extractedAt: doc.extractedAt,
        sourceQuery: source.sourceQuery,
        relevanceScore: source.relevanceScore,
        evidenceScore: source.evidenceScore,
        normalizedStructured: normalizeResearchStructured(doc.structured as Record<string, unknown> | undefined),
      });
    } catch {
      // Best-effort collection for baseline research pipeline.
    }
  }

  return docs;
}
