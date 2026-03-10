export type SearchProvider = 'ddgs' | 'tavily' | 'serper';

export interface SearchProviderAdapter {
  search(query: string, options: {
    limit?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    mode?: 'general' | 'news' | 'docs';
  }): Promise<{
    results: Array<{
      url: string;
      title: string;
      snippet: string;
      source?: string;
      publishedAt?: string;
    }>;
    provider: string;
  }>;
}
