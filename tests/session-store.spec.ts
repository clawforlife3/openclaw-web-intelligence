import { describe, expect, it, beforeEach } from 'vitest';
import { createSessionStore, getSessionStore } from '../src/anti-bot/sessionStore.js';

describe('SessionStore', () => {
  beforeEach(() => {
    createSessionStore({
      baseDir: '/tmp/openclaw-session-store-tests',
      ttlMs: 60_000,
    }).clear();
  });

  it('stores and replays cookies by domain', () => {
    const store = getSessionStore()!;
    store.updateFromResponse('https://example.com/page', [
      'sid=abc123; Path=/; Max-Age=3600',
      'pref=light; Path=/docs',
    ]);

    expect(store.getCookieHeader('https://example.com/next')).toContain('sid=abc123');
    expect(store.getCookieHeader('https://example.com/next')).not.toContain('pref=light');
    expect(store.getCookieHeader('https://example.com/docs/page')).toContain('pref=light');
  });

  it('persists browser state path per domain', () => {
    const store = getSessionStore()!;
    const path = store.persistBrowserState('https://docs.example.com/page', { cookies: [] });
    expect(path).toContain('docs.example.com');
    expect(store.getStorageStatePath('https://docs.example.com/page')).toBe(path);
  });
});
