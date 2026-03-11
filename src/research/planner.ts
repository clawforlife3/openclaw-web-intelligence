import { ResearchPlanSchema, type ResearchGoal, type ResearchPlan, type ResearchTopicRequest } from '../types/schemas.js';

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeLanguage(language?: string): string {
  return language?.trim() || 'zh-TW';
}

function buildSourceTypes(goal: ResearchGoal, sourcePreferences: string[]): string[] {
  const defaults = {
    summary: ['official sites', 'media reviews', 'blogs', 'forums'],
    compare: ['official sites', 'pricing pages', 'comparison articles', 'reviews'],
    track: ['news', 'social discussions', 'forums', 'official announcements'],
    monitor: ['official announcements', 'news', 'community discussions'],
    explore_domain: ['docs', 'blog', 'product pages', 'pricing'],
  } satisfies Record<ResearchGoal, string[]>;

  return uniqueStrings([...defaults[goal], ...sourcePreferences]);
}

function buildQueries(input: ResearchTopicRequest): string[] {
  const fragments = uniqueStrings([
    input.topic,
    input.region,
    input.timeRange,
    input.goal === 'compare' ? '比較' : '',
    input.goal === 'track' || input.goal === 'monitor' ? '趨勢 討論 評價' : '',
    input.goal === 'explore_domain' ? '官方 文件 功能 定價' : '',
  ]);

  const joined = fragments.join(' ').trim();
  const variants = [
    joined,
    `${joined} 比較`,
    `${joined} 評測`,
    `${joined} 推薦`,
    `${joined} 討論`,
    `${joined} 官網`,
  ];

  if (normalizeLanguage(input.language).startsWith('en')) {
    variants.push(
      `${input.topic} market overview`,
      `${input.topic} comparison`,
      `${input.topic} reviews`,
    );
  }

  return uniqueStrings(variants).slice(0, 8);
}

export function buildResearchPlan(input: ResearchTopicRequest): ResearchPlan {
  const plan: ResearchPlan = {
    queries: buildQueries(input),
    sourceTypes: buildSourceTypes(input.goal, input.sourcePreferences),
    targetPatterns: input.goal === 'explore_domain'
      ? ['docs', 'pricing', 'blog', 'features']
      : ['official', 'review', 'comparison', 'discussion'],
    stopConditions: [
      `max pages ${input.maxBudgetPages}`,
      `max runtime ${input.maxRuntimeMinutes} minutes`,
      'stop when evidence quality saturates',
    ],
    qualityThresholds: [
      'prefer official or primary sources',
      'prefer diverse domains',
      'filter thin or duplicate pages',
    ],
  };

  return ResearchPlanSchema.parse(plan);
}
