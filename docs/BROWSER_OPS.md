# Browser Operations Guide

> 本文件說明如何在不同環境下設定與運維 Playwright browser fetch 功能。

## Browser Runtime Modes

本專案目前支援兩種 browser runtime：

- `launch`
  - 由 worker/CLI 直接啟動本地 Playwright Chromium
- `remote-cdp`
  - 透過 `playwright.chromium.connectOverCDP(...)` 連到外部已啟動的 Chromium
  - 適合 WSL2 連 Windows 上已登入的瀏覽器

相關環境變數：

```bash
OPENCLAW_BROWSER_REMOTE_CDP_URL=http://127.0.0.1:9222
OPENCLAW_BROWSER_ATTACH_ONLY=true
OPENCLAW_BROWSER_PROFILE_NAME=windows-default
```

說明：

- `OPENCLAW_BROWSER_REMOTE_CDP_URL`
  - 設定後會自動把 browser runtime 切到 `remote-cdp`
- `OPENCLAW_BROWSER_ATTACH_ONLY`
  - `true` 時，會重用 remote browser 的既有 context
  - 適合繼承已登入 session、cookies、localStorage
- `OPENCLAW_BROWSER_PROFILE_NAME`
  - 目前主要用於 observability / profile 註記
  - 不會直接建立或切換 Chromium profile

## 環境需求

### 基本需求
- Node.js 18+
- npm
- Chromium binaries（透過 Playwright 安裝）

### 安裝 Playwright 與 Chromium

```bash
# 在專案目錄安裝
npm install

# 安裝 Playwright Chromium
npx playwright install chromium

# 或安裝所有瀏覽器
npx playwright install
```

## 常見環境設置

### 本機開發（macOS/Linux）

```bash
# 自動應該可以運作
npx playwright install chromium
```

### WSL2（Windows Subsystem for Linux）

```bash
# WSL2 需要額外套件
sudo apt-get update
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2

# 然後安裝 Playwright
npx playwright install chromium
```

### WSL2 + Windows Remote CDP

如果你的目標站需要：

- 高 JS render
- 已登入 session
- 沿用 Windows Chrome/Chromium 既有 profile

建議不要在 WSL 內直接新開乾淨 browser，而是 attach 到 Windows 上的 browser。

Windows 端先啟動 Chromium/Chrome 並開啟 remote debugging，例如：

```powershell
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\openclaw-cdp-profile"
```

如果你要沿用平常已登入的 profile，應先確認這樣做符合你的安全需求；較穩定的做法通常是使用專用 research profile。

WSL 端設定：

```bash
export OPENCLAW_BROWSER_REMOTE_CDP_URL=http://127.0.0.1:9222
export OPENCLAW_BROWSER_ATTACH_ONLY=true
export OPENCLAW_BROWSER_PROFILE_NAME=windows-default
```

之後執行：

```bash
npm run browser-runtime
npm run research -- --topic "台灣 CRM 市場"
npm run extract -- --url https://example.com --render-mode=browser
node dist/scripts/crawl-worker.js --redis-url redis://localhost:6379 --queue crawl-jobs
```

`attachOnly=true` 的行為：

- 不建立新的 browser process
- 盡量重用 remote browser 的第一個既有 context
- 會關閉本次打開的 page，但不會關掉外部 browser 本體

這條路徑最適合：

- 需要登入才能查看完整內容的站點
- 需要沿用人工登入、SSO、2FA 後 session 的站點
- WSL 中 Playwright browser 啟動成本高或依賴複雜的環境

### Docker 容器

```dockerfile
FROM node:18-slim

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# 安裝專案
WORKDIR /app
COPY package*.json ./
RUN npm install

# 安裝 Playwright browsers
RUN npx playwright install --with-deps chromium
```

### CI/CD（GitHub Actions）

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

## 驗證安裝

```bash
# 測試 Playwright 是否可用
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  console.log('Chromium launch OK');
  await browser.close();
})();
"
```

### 驗證 Remote CDP

```bash
npm run browser-runtime
```

如果你想直接用 Playwright 驗證：

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP(process.env.OPENCLAW_BROWSER_REMOTE_CDP_URL);
  console.log('Remote CDP OK, contexts=', browser.contexts().length);
})();
"
```

## 常見問題

### Q: 出現 "Executable doesn't exist at ..."

```bash
# 重新安裝
npx playwright install chromium
```

### Q: 出現 "Library not loaded"

```bash
# Ubuntu/WSL 需要額外套件
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2
```

### Q: Docker 容器中無法啟動

```dockerfile
# 添加 --no-sandbox 參數
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/ms-playwright/chromium-*/chrome-linux/chrome
```

## 效能優化

### 減少記憶體使用

```typescript
// 使用 headless 模式（預設）
await browser.launch({ headless: true });

// 限制並發
const context = await browser.newContext({
  maxConcurrentPages: 5,
});
```

### 加快啟動速度

```bash
# 安裝特定瀏覽器而非全部
npx playwright install chromium
```

## 監控

### 檢查瀏覽器可用性

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch({ timeout: 5000 });
    await browser.close();
    console.log('Browser OK');
  } catch (e) {
    console.log('Browser NOT available:', e.message);
  }
})();
"
```

## 相關設定

在 `openclaw-web-intelligence` 中使用：

```typescript
import { browserFetch } from './src/api/index.js';

const result = await browserFetch({
  url: 'https://example.com',
  waitUntil: 'domcontentloaded', // 或 'networkidle'
  timeoutMs: 15000,
});
```

也可以直接從 API 設定 runtime：

```typescript
import {
  browserFetch,
  setBrowserRuntimeConfig,
} from './src/api/index.js';

setBrowserRuntimeConfig({
  mode: 'remote-cdp',
  cdpUrl: 'http://127.0.0.1:9222',
  attachOnly: true,
  profileName: 'windows-default',
});

const result = await browserFetch({
  url: 'https://example.com/account',
  timeoutMs: 15000,
});
```
