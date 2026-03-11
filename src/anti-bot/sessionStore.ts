import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getDomainFromUrl } from '../observability/trace.js';

export interface DomainCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expiresAt?: number;
}

export interface DomainSession {
  domain: string;
  cookies: DomainCookie[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  rotationCount: number;
  storageStatePath?: string;
}

export interface SessionStoreConfig {
  baseDir: string;
  ttlMs: number;
  maxRotations: number;
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  baseDir: resolve(process.cwd(), '.openclaw-sessions'),
  ttlMs: 30 * 60 * 1000,
  maxRotations: 5,
};

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\./, '');
}

function parseSetCookie(value: string, fallbackDomain: string): DomainCookie | null {
  const [pair, ...attrs] = value.split(';').map((part) => part.trim());
  const eqIndex = pair.indexOf('=');
  if (eqIndex === -1) return null;

  const cookie: DomainCookie = {
    name: pair.slice(0, eqIndex),
    value: pair.slice(eqIndex + 1),
    domain: fallbackDomain,
  };

  for (const attr of attrs) {
    const [rawKey, rawVal] = attr.split('=');
    const key = rawKey.toLowerCase();
    if (key === 'domain' && rawVal) cookie.domain = normalizeDomain(rawVal);
    if (key === 'path' && rawVal) cookie.path = rawVal;
    if (key === 'expires' && rawVal) {
      const ts = Date.parse(rawVal);
      if (!Number.isNaN(ts)) cookie.expiresAt = ts;
    }
    if (key === 'max-age' && rawVal) {
      const seconds = parseInt(rawVal, 10);
      if (!Number.isNaN(seconds)) cookie.expiresAt = Date.now() + (seconds * 1000);
    }
  }

  return cookie;
}

function matchesDomain(hostname: string, cookieDomain: string): boolean {
  const normalizedHost = normalizeDomain(hostname);
  const normalizedCookieDomain = normalizeDomain(cookieDomain);
  return normalizedHost === normalizedCookieDomain || normalizedHost.endsWith(`.${normalizedCookieDomain}`);
}

function matchesPath(urlPath: string, cookiePath?: string): boolean {
  if (!cookiePath || cookiePath === '/') return true;
  return urlPath === cookiePath || urlPath.startsWith(`${cookiePath.replace(/\/$/, '')}/`);
}

function encodeCookieHeader(url: string, cookies: DomainCookie[]): string | undefined {
  const parsed = new URL(url);
  const valid = cookies.filter((cookie) => (
    (!cookie.expiresAt || cookie.expiresAt > Date.now())
    && matchesDomain(parsed.hostname, cookie.domain)
    && matchesPath(parsed.pathname, cookie.path)
  ));
  if (valid.length === 0) return undefined;
  return valid.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export class SessionStore {
  private readonly config: SessionStoreConfig;
  private readonly sessions = new Map<string, DomainSession>();

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    ensureDir(this.config.baseDir);
  }

  private getSessionPath(domain: string): string {
    return join(this.config.baseDir, `${normalizeDomain(domain)}.json`);
  }

  private load(domain: string): DomainSession | null {
    const normalized = normalizeDomain(domain);
    const inMemory = this.sessions.get(normalized);
    if (inMemory) return this.isExpired(inMemory) ? null : inMemory;

    const path = this.getSessionPath(normalized);
    if (!existsSync(path)) return null;
    const session = JSON.parse(readFileSync(path, 'utf8')) as DomainSession;
    if (this.isExpired(session)) return null;
    this.sessions.set(normalized, session);
    return session;
  }

  private save(session: DomainSession): void {
    const normalized = normalizeDomain(session.domain);
    this.sessions.set(normalized, session);
    writeFileSync(this.getSessionPath(normalized), JSON.stringify(session, null, 2), 'utf8');
  }

  private isExpired(session: DomainSession): boolean {
    return session.expiresAt <= Date.now();
  }

  getSessionForUrl(url: string): DomainSession | null {
    const domain = getDomainFromUrl(url);
    if (!domain) return null;
    return this.load(domain);
  }

  getCookieHeader(url: string): string | undefined {
    const session = this.getSessionForUrl(url);
    if (!session) return undefined;
    return encodeCookieHeader(url, session.cookies);
  }

  getStorageStatePath(url: string): string | undefined {
    const session = this.getSessionForUrl(url);
    return session?.storageStatePath;
  }

  updateFromResponse(url: string, setCookieHeaders: string[] = []): DomainSession | null {
    const domain = getDomainFromUrl(url);
    if (!domain) return null;
    const normalized = normalizeDomain(domain);
    const current = this.load(normalized) ?? {
      domain: normalized,
      cookies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttlMs,
      rotationCount: 0,
    };

    const parsed = setCookieHeaders
      .map((header) => parseSetCookie(header, normalized))
      .filter((cookie): cookie is DomainCookie => Boolean(cookie));

    if (parsed.length === 0) return current;

    const existing = new Map(current.cookies.map((cookie) => [`${cookie.domain}:${cookie.name}`, cookie]));
    for (const cookie of parsed) {
      existing.set(`${cookie.domain}:${cookie.name}`, cookie);
    }

    const next: DomainSession = {
      ...current,
      cookies: Array.from(existing.values()),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttlMs,
    };
    this.save(next);
    return next;
  }

  persistBrowserState(url: string, storageState: unknown): string | undefined {
    const domain = getDomainFromUrl(url);
    if (!domain) return undefined;
    const normalized = normalizeDomain(domain);
    const dir = join(this.config.baseDir, 'browser');
    ensureDir(dir);
    const path = join(dir, `${normalized}.json`);
    writeFileSync(path, JSON.stringify(storageState, null, 2), 'utf8');

    const current = this.load(normalized) ?? {
      domain: normalized,
      cookies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttlMs,
      rotationCount: 0,
    };

    const next: DomainSession = {
      ...current,
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttlMs,
      storageStatePath: path,
    };
    this.save(next);
    return path;
  }

  rotate(url: string): void {
    const domain = getDomainFromUrl(url);
    if (!domain) return;
    const current = this.load(domain);
    if (!current) return;
    const next: DomainSession = {
      ...current,
      cookies: [],
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttlMs,
      rotationCount: Math.min(current.rotationCount + 1, this.config.maxRotations),
    };
    this.save(next);
  }

  clear(domain?: string): void {
    if (domain) {
      const normalized = normalizeDomain(domain);
      this.sessions.delete(normalized);
      rmSync(this.getSessionPath(normalized), { force: true });
      rmSync(join(this.config.baseDir, 'browser', `${normalized}.json`), { force: true });
      return;
    }
    this.sessions.clear();
    rmSync(this.config.baseDir, { recursive: true, force: true });
    ensureDir(this.config.baseDir);
  }
}

let sessionStore: SessionStore | null = null;

export function createSessionStore(config?: Partial<SessionStoreConfig>): SessionStore {
  sessionStore = new SessionStore(config);
  return sessionStore;
}

export function getSessionStore(): SessionStore | null {
  return sessionStore;
}

export function setSessionStore(store: SessionStore): void {
  sessionStore = store;
}
