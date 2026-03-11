export type RobotsMode = 'strict' | 'balanced' | 'off';

export interface RobotsEvaluation {
  allowed: boolean;
  reason: 'allowed' | 'disallowed' | 'unavailable' | 'off';
  robotsUrl?: string;
}

interface Rule {
  pattern: string;
  allow: boolean;
}

interface ParsedRobots {
  rules: Rule[];
  sourceUrl: string;
}

const DEFAULT_USER_AGENT = 'OpenClaw-Web-Intelligence';
const robotsCache = new Map<string, ParsedRobots | null>();

function stripComment(line: string): string {
  const commentIndex = line.indexOf('#');
  return commentIndex === -1 ? line.trim() : line.slice(0, commentIndex).trim();
}

function normalizePattern(pattern: string): string {
  if (!pattern) return '/';
  return pattern.startsWith('/') ? pattern : `/${pattern}`;
}

function parseRobotsTxt(content: string, sourceUrl: string): ParsedRobots {
  const lines = content.split(/\r?\n/);
  const targetedRules: Rule[] = [];
  const wildcardRules: Rule[] = [];

  let currentTargets: string[] = [];

  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    if (!line) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const field = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      currentTargets = [agent];
      continue;
    }

    if ((field === 'allow' || field === 'disallow') && value !== '') {
      const rule: Rule = {
        pattern: normalizePattern(value),
        allow: field === 'allow',
      };

      if (currentTargets.includes('*')) {
        wildcardRules.push(rule);
      }

      if (currentTargets.some((target) => target.includes(DEFAULT_USER_AGENT.toLowerCase()))) {
        targetedRules.push(rule);
      }
    }
  }

  return {
    rules: targetedRules.length > 0 ? targetedRules : wildcardRules,
    sourceUrl,
  };
}

function matchesRule(pathname: string, pattern: string): boolean {
  if (pattern === '/') return true;
  return pathname.startsWith(pattern);
}

function evaluateRules(pathname: string, rules: Rule[]): boolean {
  let matched: Rule | undefined;

  for (const rule of rules) {
    if (!matchesRule(pathname, rule.pattern)) continue;
    if (!matched || rule.pattern.length > matched.pattern.length) {
      matched = rule;
      continue;
    }
    if (matched && rule.pattern.length === matched.pattern.length && rule.allow) {
      matched = rule;
    }
  }

  return matched ? matched.allow : true;
}

async function loadRobots(url: URL): Promise<ParsedRobots | null> {
  const origin = url.origin;
  if (robotsCache.has(origin)) {
    return robotsCache.get(origin) ?? null;
  }

  const robotsUrl = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(robotsUrl, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 404) {
      robotsCache.set(origin, null);
      return null;
    }

    if (!response.ok) {
      throw new Error(`robots_http_${response.status}`);
    }

    const parsed = parseRobotsTxt(await response.text(), robotsUrl);
    robotsCache.set(origin, parsed);
    return parsed;
  } catch {
    clearTimeout(timer);
    throw new Error('robots_unavailable');
  }
}

export async function evaluateRobotsPolicy(url: string, mode: RobotsMode): Promise<RobotsEvaluation> {
  if (mode === 'off') {
    return { allowed: true, reason: 'off' };
  }

  const parsedUrl = new URL(url);

  try {
    const robots = await loadRobots(parsedUrl);
    if (!robots) {
      return { allowed: true, reason: 'allowed', robotsUrl: `${parsedUrl.origin}/robots.txt` };
    }

    const allowed = evaluateRules(parsedUrl.pathname || '/', robots.rules);
    return {
      allowed,
      reason: allowed ? 'allowed' : 'disallowed',
      robotsUrl: robots.sourceUrl,
    };
  } catch {
    return {
      allowed: mode === 'balanced',
      reason: 'unavailable',
      robotsUrl: `${parsedUrl.origin}/robots.txt`,
    };
  }
}

export function clearRobotsPolicyCache(): void {
  robotsCache.clear();
}

