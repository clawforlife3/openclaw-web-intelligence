import {
  getBrowserRuntimeConfig,
  initializeBrowserRuntimeConfigFromEnv,
} from '../fetch/browserRuntime.js';

async function main() {
  const runtime = initializeBrowserRuntimeConfigFromEnv();

  if (runtime.mode !== 'remote-cdp') {
    console.log(JSON.stringify({
      ok: true,
      mode: runtime.mode,
      config: getBrowserRuntimeConfig(),
      diagnostics: {
        message: 'Browser runtime is in local launch mode.',
      },
    }, null, 2));
    return;
  }

  if (!runtime.cdpUrl) {
    console.log(JSON.stringify({
      ok: false,
      mode: runtime.mode,
      config: getBrowserRuntimeConfig(),
      diagnostics: {
        message: 'Remote CDP mode is enabled but cdpUrl is missing.',
        nextStep: 'Set OPENCLAW_BROWSER_REMOTE_CDP_URL to the remote browser endpoint.',
      },
    }, null, 2));
    process.exit(2);
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.connectOverCDP(runtime.cdpUrl);

  try {
    const browserContexts = browser.contexts();
    console.log(JSON.stringify({
      ok: true,
      mode: runtime.mode,
      config: getBrowserRuntimeConfig(),
      diagnostics: {
        cdpUrl: runtime.cdpUrl,
        contextCount: browserContexts.length,
        attachOnlyReady: !runtime.attachOnly || browserContexts.length > 0,
        message: runtime.attachOnly && browserContexts.length === 0
          ? 'Connected, but attachOnly mode has no existing browser context to reuse.'
          : 'Remote CDP connection is healthy.',
      },
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: {
      code: 'BROWSER_RUNTIME_PROBE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  }, null, 2));
  process.exit(1);
});
