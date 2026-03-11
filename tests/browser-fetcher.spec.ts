import { describe, expect, it, vi, beforeEach } from 'vitest';

const goto = vi.fn();
const content = vi.fn();
const screenshot = vi.fn();
const allHeaders = vi.fn();
const status = vi.fn();
const pageUrl = vi.fn();
const closeContext = vi.fn();
const closeBrowser = vi.fn();
const newPage = vi.fn();
const newContext = vi.fn();
const launch = vi.fn();

vi.mock('playwright', () => ({
  chromium: {
    launch,
  },
}));

const { browserFetch } = await import('../src/fetch/browserFetcher.js');

describe('browserFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    allHeaders.mockResolvedValue({ 'content-type': 'text/html' });
    status.mockReturnValue(200);
    pageUrl.mockReturnValue('https://example.com/final');
    content.mockResolvedValue('<html><head><title>Browser Page</title></head><body><h1>Hello</h1></body></html>');
    screenshot.mockResolvedValue(Buffer.from('png'));
    goto.mockResolvedValue({ status, allHeaders });
    newPage.mockResolvedValue({ goto, content, screenshot, url: pageUrl });
    closeContext.mockResolvedValue(undefined);
    newContext.mockResolvedValue({ newPage, close: closeContext });
    closeBrowser.mockResolvedValue(undefined);
    launch.mockResolvedValue({ newContext, close: closeBrowser });
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
});
