export interface BrowserRuntimeConfig {
  mode: 'launch' | 'remote-cdp';
  cdpUrl?: string;
  attachOnly: boolean;
  profileName?: string;
}

const DEFAULT_BROWSER_RUNTIME_CONFIG: BrowserRuntimeConfig = {
  mode: process.env.OPENCLAW_BROWSER_REMOTE_CDP_URL ? 'remote-cdp' : 'launch',
  cdpUrl: process.env.OPENCLAW_BROWSER_REMOTE_CDP_URL,
  attachOnly: process.env.OPENCLAW_BROWSER_ATTACH_ONLY === 'true',
  profileName: process.env.OPENCLAW_BROWSER_PROFILE_NAME,
};

let browserRuntimeConfig: BrowserRuntimeConfig = { ...DEFAULT_BROWSER_RUNTIME_CONFIG };

export function getBrowserRuntimeConfig(): BrowserRuntimeConfig {
  return { ...browserRuntimeConfig };
}

export function setBrowserRuntimeConfig(config: Partial<BrowserRuntimeConfig>): BrowserRuntimeConfig {
  browserRuntimeConfig = {
    ...browserRuntimeConfig,
    ...config,
  };
  return getBrowserRuntimeConfig();
}

export function resetBrowserRuntimeConfig(): BrowserRuntimeConfig {
  browserRuntimeConfig = { ...DEFAULT_BROWSER_RUNTIME_CONFIG };
  return getBrowserRuntimeConfig();
}
