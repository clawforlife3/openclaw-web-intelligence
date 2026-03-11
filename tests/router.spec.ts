import { describe, expect, it } from 'vitest';
import { route } from '../src/router/retrievalRouter.js';

describe('retrievalRouter', () => {
  it('uses browser when explicitly requested', () => {
    const decision = route({ mode: 'extract', renderMode: 'browser', url: 'https://example.com' });
    expect(decision.strategy).toBe('browser');
    expect(decision.allowFallback).toBe(false);
  });

  it('defaults to static with browser fallback for extract', () => {
    const decision = route({ mode: 'extract', renderMode: 'auto', url: 'https://example.com' });
    expect(decision.strategy).toBe('static');
    expect(decision.fallbackStrategy).toBe('browser');
    expect(decision.allowFallback).toBe(true);
  });

  it('suggests browser for framework-like html hints', () => {
    const decision = route({
      mode: 'extract',
      renderMode: 'auto',
      url: 'https://example.com',
      htmlHint: '<html><body><div id="root"></div><script src="app.js"></script></body></html>',
    });
    expect(decision.strategy).toBe('browser');
    expect(decision.fallbackStrategy).toBe('static');
  });
});
