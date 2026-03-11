export interface BrowserRuntimeConfig {
  mode: 'launch' | 'remote-cdp';
  cdpUrl?: string;
  attachOnly: boolean;
  profileName?: string;
}

type BrowserRuntimeEnv = Record<string, string | undefined>;

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export function readBrowserRuntimeConfigFromEnv(env: BrowserRuntimeEnv = process.env): BrowserRuntimeConfig {
  return {
    mode: env.OPENCLAW_BROWSER_REMOTE_CDP_URL ? 'remote-cdp' : 'launch',
    cdpUrl: env.OPENCLAW_BROWSER_REMOTE_CDP_URL,
    attachOnly: parseBoolean(env.OPENCLAW_BROWSER_ATTACH_ONLY),
    profileName: env.OPENCLAW_BROWSER_PROFILE_NAME,
  };
}

const DEFAULT_BROWSER_RUNTIME_CONFIG: BrowserRuntimeConfig = readBrowserRuntimeConfigFromEnv();

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

export function initializeBrowserRuntimeConfigFromEnv(
  env: BrowserRuntimeEnv = process.env,
): BrowserRuntimeConfig {
  browserRuntimeConfig = readBrowserRuntimeConfigFromEnv(env);
  return getBrowserRuntimeConfig();
}
