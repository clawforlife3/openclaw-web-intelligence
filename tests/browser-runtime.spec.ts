import { describe, expect, it } from 'vitest';

import {
  initializeBrowserRuntimeConfigFromEnv,
  readBrowserRuntimeConfigFromEnv,
  resetBrowserRuntimeConfig,
} from '../src/fetch/browserRuntime.js';

describe('browser runtime config', () => {
  it('reads remote CDP config from env', () => {
    const config = readBrowserRuntimeConfigFromEnv({
      OPENCLAW_BROWSER_REMOTE_CDP_URL: 'http://127.0.0.1:9222',
      OPENCLAW_BROWSER_ATTACH_ONLY: 'true',
      OPENCLAW_BROWSER_PROFILE_NAME: 'windows-default',
    });

    expect(config).toEqual({
      mode: 'remote-cdp',
      cdpUrl: 'http://127.0.0.1:9222',
      attachOnly: true,
      profileName: 'windows-default',
    });
  });

  it('initializes launch mode when no remote CDP url is present', () => {
    const config = initializeBrowserRuntimeConfigFromEnv({
      OPENCLAW_BROWSER_ATTACH_ONLY: '1',
    });

    expect(config.mode).toBe('launch');
    expect(config.cdpUrl).toBeUndefined();
    expect(config.attachOnly).toBe(true);

    resetBrowserRuntimeConfig();
  });
});
