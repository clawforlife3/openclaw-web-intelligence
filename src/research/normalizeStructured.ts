function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function inferCategory(kind?: string, pathType?: string): string | undefined {
  if (pathType) return pathType;
  if (!kind) return undefined;
  if (['docs', 'docusaurus', 'mkdocs', 'github-docs'].includes(kind)) return 'docs';
  if (['article', 'blog', 'changelog'].includes(kind)) return 'article';
  return kind;
}

export function normalizeResearchStructured(structured: Record<string, unknown> | undefined): {
  kind?: string;
  category?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  section?: string;
  pathType?: string;
  keyPoints?: string[];
} | undefined {
  if (!structured || Object.keys(structured).length === 0) return undefined;

  const kind = asString(structured.kind);
  const pathType = asString(structured.pathType);
  const headingTree = asStringArray(structured.headingTree).slice(0, 5);
  const keyPoints = headingTree.length > 0
    ? headingTree
    : asStringArray(structured.highlights).slice(0, 5);

  return {
    kind,
    category: inferCategory(kind, pathType),
    author: asString(structured.author),
    publishedAt: asString(structured.publishedAt),
    updatedAt: asString(structured.updatedAt) ?? asString(structured.lastUpdated),
    section: asString(structured.section),
    pathType,
    keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
  };
}
