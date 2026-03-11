import { describe, expect, it, vi, beforeEach } from 'vitest';

const goto = vi.fn();
const content = vi.fn();
const screenshot = vi.fn();
const allHeaders = vi.fn();
const status = vi.fn();
const pageUrl = vi.fn();
const closePage = vi.fn();
const closeContext = vi.fn();
const closeBrowser = vi.fn();
const newPage = vi.fn();
const newContext = vi.fn();
const launch = vi.fn();
const connectOverCDP = vi.fn();
const contexts = vi.fn();
const storageState = vi.fn();
const pageHtml = '<html><head><title>Browser Page</title></head><body><h1>Hello</h1></body></html>';

vi.mock('playwright', () => ({
  chromium: {
    launch,
    connectOverCDP,
  },
}));

const { browserFetch } = await import('../src/fetch/browserFetcher.js');
const { resetBrowserRuntimeConfig, setBrowserRuntimeConfig } = await import('../src/fetch/browserRuntime.js');

describe('browserFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBrowserRuntimeConfig();

    allHeaders.mockResolvedValue({ 'content-type': 'text/html' });
    status.mockReturnValue(200);
    pageUrl.mockReturnValue('https://example.com/final');
    content.mockResolvedValue(pageHtml);
    screenshot.mockResolvedValue(Buffer.from('png'));
    goto.mockResolvedValue({ status, allHeaders });
    closePage.mockResolvedValue(undefined);
    newPage.mockResolvedValue({ goto, content, screenshot, url: pageUrl, close: closePage });
    closeContext.mockResolvedValue(undefined);
    storageState.mockResolvedValue({ cookies: [], origins: [] });
    newContext.mockResolvedValue({ newPage, close: closeContext, storageState });
    closeBrowser.mockResolvedValue(undefined);
    contexts.mockReturnValue([{
      newPage,
      close: closeContext,
      storageState,
    }]);
    launch.mockResolvedValue({ newContext, close: closeBrowser });
    connectOverCDP.mockResolvedValue({ contexts, newContext, close: closeBrowser });
  });

  it('returns browser fetch result with html and headers', async () => {
    const result = await browserFetch({
      url: 'https://example.com',
      timeoutMs: 10_000,
      retryMax: 0,
      userAgent: 'test-agent',
      waitUntil: 'domcontentloaded',
    });

    expect(launch).toHaveBeenCalled();
    expect(goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    });
    expect(result.via).toBe('browser');
    expect(result.finalUrl).toBe('https://example.com/final');
    expect(result.contentType).toBe('text/html');
    expect(result.html).toContain('Browser Page');
  });

  it('writes screenshot path when requested', async () => {
    const result = await browserFetch({
      url: 'https://example.com',
      timeoutMs: 10_000,
      retryMax: 0,
      userAgent: 'test-agent',
      screenshot: true,
    });

    expect(screenshot).toHaveBeenCalled();
    expect(result.screenshotPath).toMatch(/artifacts\/browser\/browser-.*\.png$/);
  });

  it('connects over remote CDP and reuses existing context in attachOnly mode', async () => {
    setBrowserRuntimeConfig({
      mode: 'remote-cdp',
      cdpUrl: 'http://127.0.0.1:9222',
      attachOnly: true,
      profileName: 'windows-default',
    });

    const result = await browserFetch({
      url: 'https://example.com',
      timeoutMs: 10_000,
      retryMax: 0,
      userAgent: 'test-agent',
    });

    expect(connectOverCDP).toHaveBeenCalledWith('http://127.0.0.1:9222');
    expect(launch).not.toHaveBeenCalled();
    expect(newContext).not.toHaveBeenCalled();
    expect(closeBrowser).not.toHaveBeenCalled();
    expect(closePage).toHaveBeenCalled();
    expect(result.finalUrl).toBe('https://example.com/final');
  });

  it('suggests remote CDP when browser challenge is encountered in launch mode', async () => {
    content.mockResolvedValue('<html><body>g-recaptcha challenge</body></html>');

    await expect(browserFetch({
      url: 'https://example.com/login',
      timeoutMs: 10_000,
      retryMax: 0,
      userAgent: 'test-agent',
    })).rejects.toMatchObject({
      code: 'CHALLENGE_REQUIRED',
      details: {
        browserRuntimeMode: 'launch',
        suggestedBrowserMode: 'remote-cdp',
        suggestedEnv: {
          OPENCLAW_BROWSER_REMOTE_CDP_URL: 'http://127.0.0.1:9222',
          OPENCLAW_BROWSER_ATTACH_ONLY: 'true',
        },
      },
    });
  });
});
