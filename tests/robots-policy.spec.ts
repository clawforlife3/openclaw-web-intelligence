import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRobotsPolicyCache, evaluateRobotsPolicy } from '../src/engines/crawl/robotsPolicy.js';

describe('robots policy evaluator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearRobotsPolicyCache();
  });

  it('blocks disallowed paths from wildcard robots rules', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('User-agent: *\nDisallow: /private\nAllow: /public\n', { status: 200 })));

    const allowed = await evaluateRobotsPolicy('https://example.com/public/page', 'strict');
    const denied = await evaluateRobotsPolicy('https://example.com/private/page', 'strict');

    expect(allowed.allowed).toBe(true);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('disallowed');
  });

  it('allows on robots fetch failure in balanced mode but denies in strict mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network failed');
    }));

    const balanced = await evaluateRobotsPolicy('https://balanced.example.com/docs', 'balanced');
    clearRobotsPolicyCache();
    const strict = await evaluateRobotsPolicy('https://strict.example.com/docs', 'strict');

    expect(balanced.allowed).toBe(true);
    expect(balanced.reason).toBe('unavailable');
    expect(strict.allowed).toBe(false);
    expect(strict.reason).toBe('unavailable');
  });
});

