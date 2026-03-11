import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtractError } from '../types/errors.js';
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
  let browser: Awaited<ReturnType<PlaywrightModule['chromium']['launch']>> | undefined;
  let screenshotPath: string | undefined;

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      proxy: request.proxyUrl ? { server: request.proxyUrl } : undefined,
    });
    const context = await browser.newContext({
      userAgent: request.userAgent,
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      timezoneId: 'Asia/Taipei',
    });

    const page = await context.newPage();
    const response = await page.goto(request.url, {
      waitUntil: request.waitUntil ?? 'domcontentloaded',
      timeout: request.timeoutMs,
    });

    if (!response) {
      throw new ExtractError('BROWSER_UNAVAILABLE', `Browser navigation returned no response for ${request.url}`, true, {
        url: request.url,
      });
    }

    const statusCode = response.status();
    if (statusCode === 403 || statusCode === 429) {
      throw new ExtractError('ANTI_BOT_BLOCKED', `Blocked by anti-bot or rate limiting: ${statusCode}`, true, {
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

    const html = await page.content();

    if (request.screenshot) {
      screenshotPath = makeScreenshotPath();
      const screenshot = await page.screenshot({ type: 'png' });
      writeFileSync(screenshotPath, screenshot);
    }

    const headers = normalizeHeaders(await response.allHeaders());
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
    if (err instanceof ExtractError) throw err;

    throw new ExtractError('BROWSER_UNAVAILABLE', `Browser fetch failed for ${request.url}`, true, {
      url: request.url,
      cause: (err as Error).message,
      nextStep: 'Verify Playwright browser binaries are installed and launchable in this environment.',
    });
  } finally {
    await browser?.close();
  }
}
