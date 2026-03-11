import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtractError } from '../types/errors.js';
import { getEvasionManager } from '../anti-bot/evasion.js';
import { buildFetchPolicy, getOutcome } from './policy.js';
import { getSessionStore } from '../anti-bot/sessionStore.js';
import { handleChallenge } from '../anti-bot/challenge.js';
import { recordDomainOutcome } from '../observability/metrics.js';
import { getDomainFromUrl } from '../observability/trace.js';
import type { StaticFetchRequest, StaticFetchResult } from './staticFetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = join(__dirname, '../../artifacts/browser');

export interface BrowserFetchRequest extends StaticFetchRequest {
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  screenshot?: boolean;
}

export interface BrowserFetchResult extends StaticFetchResult {
  via: 'browser';
  screenshotPath?: string;
}

type PlaywrightModule = typeof import('playwright');

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import('playwright');
  } catch (err) {
    throw new ExtractError(
      'BROWSER_UNAVAILABLE',
      'Playwright package is not available. Install `playwright` and browser binaries to enable browser fetch.',
      false,
      {
        cause: (err as Error).message,
        nextStep: 'Run `npm install playwright` and `npx playwright install chromium`.',
      },
    );
  }
}

function ensureArtifactsDir() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function makeScreenshotPath(): string {
  ensureArtifactsDir();
  return join(ARTIFACTS_DIR, `browser-${Date.now()}.png`);
}

function normalizeHeaders(headers: { [key: string]: string }): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

export async function browserFetch(request: BrowserFetchRequest): Promise<BrowserFetchResult> {
  const playwright = await loadPlaywright();
  const evasion = getEvasionManager();
  const sessionStore = getSessionStore();
  let browser: Awaited<ReturnType<PlaywrightModule['chromium']['launch']>> | undefined;
  let screenshotPath: string | undefined;

  try {
    if (evasion) {
      await evasion.delay();
    }

    const session = evasion?.getSession();
    const fingerprint = session?.fingerprint;
    const policy = buildFetchPolicy({ ...request, strategy: 'browser' });

    browser = await playwright.chromium.launch({
      headless: true,
      proxy: policy.proxyUrl ? { server: policy.proxyUrl } : undefined,
    });
    const context = await browser.newContext({
      userAgent: session?.userAgent || request.userAgent,
      viewport: (() => {
        const raw = fingerprint?.screen;
        if (!raw) return { width: 1440, height: 900 };
        const [w, h] = raw.split('x').map((v) => parseInt(v, 10));
        return { width: w || 1440, height: h || 900 };
      })(),
      locale: session?.language?.split(',')[0] || 'en-US',
      timezoneId: fingerprint?.timezone || 'Asia/Taipei',
      extraHTTPHeaders: evasion?.getHeaders(),
      storageState: sessionStore?.getStorageStatePath(request.url),
    });

    const page = await context.newPage();
    const startTime = Date.now();
    const response = await page.goto(request.url, {
      waitUntil: request.waitUntil ?? 'domcontentloaded',
      timeout: policy.timeoutMs,
    });

    if (!response) {
      throw new ExtractError('BROWSER_UNAVAILABLE', `Browser navigation returned no response for ${request.url}`, true, {
        url: request.url,
      });
    }

    const statusCode = response.status();
    const html = await page.content();
    const headers = normalizeHeaders(await response.allHeaders());

    await handleChallenge({
      url: request.url,
      statusCode,
      headers,
      body: html,
    });

    const analysis = evasion?.analyzeResponse(statusCode, headers, html);
    if (analysis?.blocked) {
      throw new ExtractError('ANTI_BOT_BLOCKED', analysis.reason || `Blocked by anti-bot or rate limiting: ${statusCode}`, true, {
        url: request.url,
        status: statusCode,
        via: 'browser',
      });
    }
    if (statusCode < 200 || statusCode >= 400) {
      throw new ExtractError('FETCH_HTTP_ERROR', `HTTP ${statusCode} on ${request.url}`, statusCode >= 500, {
        url: request.url,
        status: statusCode,
        via: 'browser',
      });
    }

    if (request.screenshot) {
      screenshotPath = makeScreenshotPath();
      const screenshot = await page.screenshot({ type: 'png' });
      writeFileSync(screenshotPath, screenshot);
    }

    const storageState = await context.storageState();
    sessionStore?.persistBrowserState(request.url, storageState);
    recordDomainOutcome({
      domain: getDomainFromUrl(request.url),
      latencyMs: Date.now() - startTime,
      success: true,
    });
    await context.close();

    return {
      requestedUrl: request.url,
      finalUrl: page.url(),
      statusCode,
      contentType: headers['content-type'],
      html,
      fetchedAt: new Date().toISOString(),
      headers,
      via: 'browser',
      screenshotPath,
    };
  } catch (err) {
    recordDomainOutcome({
      domain: getDomainFromUrl(request.url),
      blocked: err instanceof ExtractError && (err.code === 'ANTI_BOT_BLOCKED' || err.code === 'CHALLENGE_REQUIRED'),
    });
    if (err instanceof ExtractError) throw err;

    throw new ExtractError('BROWSER_UNAVAILABLE', `Browser fetch failed for ${request.url}`, true, {
      url: request.url,
      cause: (err as Error).message,
      outcome: getOutcome(false, 'browser'),
      nextStep: 'Verify Playwright browser binaries are installed and launchable in this environment.',
    });
  } finally {
    await browser?.close();
  }
}
