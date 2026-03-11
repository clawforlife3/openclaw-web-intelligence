# Browser Operations Guide

> 本文件說明如何在不同環境下設定與運維 Playwright browser fetch 功能。

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
