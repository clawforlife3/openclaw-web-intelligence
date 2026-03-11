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
import { getBrowserRuntimeConfig } from './browserRuntime.js';
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
type BrowserInstance = Awaited<ReturnType<PlaywrightModule['chromium']['launch']>>;
type BrowserContextInstance = Awaited<ReturnType<BrowserInstance['newContext']>>;
type BrowserPageInstance = Awaited<ReturnType<BrowserContextInstance['newPage']>>;

let remoteBrowserCache: {
  cdpUrl: string;
  browser: BrowserInstance;
} | null = null;

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

async function getRemoteBrowser(playwright: PlaywrightModule, cdpUrl: string): Promise<BrowserInstance> {
  if (remoteBrowserCache?.cdpUrl === cdpUrl) {
    return remoteBrowserCache.browser;
  }
  const browser = await playwright.chromium.connectOverCDP(cdpUrl);
  remoteBrowserCache = {
    cdpUrl,
    browser,
  };
  return browser;
}

async function buildBrowserContext(input: {
  playwright: PlaywrightModule;
  request: BrowserFetchRequest;
  policy: ReturnType<typeof buildFetchPolicy>;
  session: ReturnType<NonNullable<ReturnType<typeof getEvasionManager>>['getSession']> | undefined;
  sessionStore: ReturnType<typeof getSessionStore>;
}): Promise<{
  browser: BrowserInstance;
  context: BrowserContextInstance;
  page: BrowserPageInstance;
  closeContextOnFinish: boolean;
  closePageOnFinish: boolean;
  closeBrowserOnFinish: boolean;
}> {
  const runtime = getBrowserRuntimeConfig();
  const { request, policy, session, sessionStore, playwright } = input;
  const fingerprint = session?.fingerprint;

  const contextOptions = {
    userAgent: session?.userAgent || request.userAgent,
    viewport: (() => {
      const raw = fingerprint?.screen;
      if (!raw) return { width: 1440, height: 900 };
      const [w, h] = raw.split('x').map((v) => parseInt(v, 10));
      return { width: w || 1440, height: h || 900 };
    })(),
    locale: session?.language?.split(',')[0] || 'en-US',
    timezoneId: fingerprint?.timezone || 'Asia/Taipei',
    extraHTTPHeaders: getEvasionManager()?.getHeaders(),
    storageState: sessionStore?.getStorageStatePath(request.url),
  };

  if (runtime.mode === 'remote-cdp') {
    if (!runtime.cdpUrl) {
      throw new ExtractError('BROWSER_UNAVAILABLE', 'Remote CDP mode requires OPENCLAW_BROWSER_REMOTE_CDP_URL or runtime config cdpUrl.', false, {
        url: request.url,
        nextStep: 'Set OPENCLAW_BROWSER_REMOTE_CDP_URL to the remote browser WebSocket/HTTP CDP endpoint.',
      });
    }

    const browser = await getRemoteBrowser(playwright, runtime.cdpUrl);
    const existingContext = browser.contexts()[0];
    if (runtime.attachOnly) {
      if (!existingContext) {
        throw new ExtractError('BROWSER_UNAVAILABLE', 'Remote CDP attachOnly mode requires an existing browser context/profile.', false, {
          url: request.url,
          cdpUrl: runtime.cdpUrl,
          profileName: runtime.profileName,
          nextStep: 'Open the target Windows/desktop browser profile first, then retry attachOnly mode.',
        });
      }
      const page = await existingContext.newPage();
      return {
        browser,
        context: existingContext,
        page,
        closeContextOnFinish: false,
        closePageOnFinish: true,
        closeBrowserOnFinish: false,
      };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    return {
      browser,
      context,
      page,
      closeContextOnFinish: true,
      closePageOnFinish: false,
      closeBrowserOnFinish: false,
    };
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    proxy: policy.proxyUrl ? { server: policy.proxyUrl } : undefined,
  });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    closeContextOnFinish: true,
    closePageOnFinish: false,
    closeBrowserOnFinish: true,
  };
}

export async function browserFetch(request: BrowserFetchRequest): Promise<BrowserFetchResult> {
  const playwright = await loadPlaywright();
  const evasion = getEvasionManager();
  const sessionStore = getSessionStore();
  let browser: BrowserInstance | undefined;
  let context: BrowserContextInstance | undefined;
  let page: BrowserPageInstance | undefined;
  let closeContextOnFinish = false;
  let closePageOnFinish = false;
  let closeBrowserOnFinish = false;
  let screenshotPath: string | undefined;

  try {
    if (evasion) {
      await evasion.delay();
    }

    const session = evasion?.getSession();
    const policy = buildFetchPolicy({ ...request, strategy: 'browser' });
    const browserParts = await buildBrowserContext({
      playwright,
      request,
      policy,
      session,
      sessionStore,
    });
    browser = browserParts.browser;
    context = browserParts.context;
    page = browserParts.page;
    closeContextOnFinish = browserParts.closeContextOnFinish;
    closePageOnFinish = browserParts.closePageOnFinish;
    closeBrowserOnFinish = browserParts.closeBrowserOnFinish;
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
    if (err instanceof ExtractError) {
      const runtime = getBrowserRuntimeConfig();
      if (
        (err.code === 'ANTI_BOT_BLOCKED' || err.code === 'CHALLENGE_REQUIRED')
        && runtime.mode !== 'remote-cdp'
      ) {
        throw new ExtractError(err.code, err.message, err.retryable, {
          ...err.details,
          browserRuntimeMode: runtime.mode,
          suggestedBrowserMode: 'remote-cdp',
          suggestedEnv: {
            OPENCLAW_BROWSER_REMOTE_CDP_URL: 'http://127.0.0.1:9222',
            OPENCLAW_BROWSER_ATTACH_ONLY: 'true',
          },
          nextStep: 'Retry with a remote CDP browser attached to an already logged-in desktop profile, or complete manual verification first.',
        });
      }
      throw err;
    }

    throw new ExtractError('BROWSER_UNAVAILABLE', `Browser fetch failed for ${request.url}`, true, {
      url: request.url,
      cause: (err as Error).message,
      outcome: getOutcome(false, 'browser'),
      nextStep: 'Verify Playwright browser binaries are installed and launchable in this environment.',
    });
  } finally {
    if (closePageOnFinish) {
      await page?.close().catch(() => undefined);
    }
    if (closeContextOnFinish) {
      await context?.close().catch(() => undefined);
    }
    if (closeBrowserOnFinish) {
      await browser?.close().catch(() => undefined);
    }
  }
}
