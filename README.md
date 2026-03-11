# OpenClaw Web Intelligence Gateway

> 為 OpenClaw Agent 設計的網頁情報取得工具：搜尋、抽取、網站地圖、爬取、browser fallback、structured extraction、monitor/diff。

- GitHub: https://github.com/clawforlife3/openclaw-web-intelligence
- Current status: **MVP 1.0 完成 / MVP 2.0 first-usable**
- 詳細現況：[`docs/CURRENT_STATE.md`](./docs/CURRENT_STATE.md)
- 路線圖：[`docs/ROADMAP.md`](./docs/ROADMAP.md)
- 演進計畫：[`docs/RESEARCH_TO_PRODUCTION_PLAN.md`](./docs/RESEARCH_TO_PRODUCTION_PLAN.md)
- 架構文件：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

## Executive Summary

`openclaw-web-intelligence` 的定位不是通用大型爬蟲平台，而是 **給 Agent 用的網頁資料獲取層**。

它解決的核心問題是：
1. Agent 需要搜尋和抓內容
2. 不同網站需要不同抓取策略（static / browser）
3. 抓回來的資料要能直接進入後續 reasoning，而不是只有一坨 HTML
4. 同一頁反覆抓取需要快取與 revalidation，避免浪費
5. 後續還要支援變更監控（monitor / diff）

所以這個專案採用的是 **search + extract + map + crawl + cache + monitor** 的分層設計，並把「資料品質」放在第一位。

---

## 這個專案能做什麼

### 已完成能力
- **Search**：用 DDGS 做網頁搜尋
- **Extract**：抓單頁內容，輸出 markdown / text / metadata / links / structured
- **Map**：用 BFS 探索站內 URL 結構
- **Crawl**：邊探索邊擷取內容
- **Dual Cache**：request cache + page cache
- **Conditional Revalidation**：支援 ETag / Last-Modified / 304 reuse
- **Browser Fallback**：static 不夠時自動改走 Playwright
- **Structured Extraction v1.1**：article / docs / product / forum
- **Robots Policy v1**：strict / balanced / off
- **Monitor / Diff v1**：baseline snapshot + field diff
- **Sitemap Ingestion v1**：sitemap.xml 發現 URL，與 map/crawl 整合
- **Retry Classification v1**：標準化 retry reason 分類、fetch outcome 追蹤、shell detection 標記
- **Host Policy Memory v1**：每個 host 的 fetch 歷史，動態調整 routing
- **Site-specific Structured Extraction v2**：Docusaurus / MkDocs / GitHub Docs / Changelog 專用 extractors
- **Browser Ops 部署文件**：Playwright 安裝與運維指南
- **Per-domain Rate Limiting**：輕量級並發控制
- **Job Queue / Worker**：crawl job 排程與狀態追蹤
- **Health Endpoint**：production 健康檢查
- **Anti-bot Detection**：403/429 偵測並拋出 ANTI_BOT_BLOCKED 錯誤
- **Proxy Support (schema)**：proxyUrl 參數預留
- **Distributed Crawling**：worker/shard 抽象 + URL 分割
- **Storage Backend**：SQLite + Memory 雙後端支援
- **Proxy Pool**：proxy rotation + health check
- **Advanced Rate Limiting**：per-domain + global + backoff
- **Redis Queue**：多 worker 協調與持久化佇列
- **Anti-bot Evasion**：UA rotation + pacing + block detection

### 目前最適合的用途
- 技術文件站抓取（docs / guides / references）
- blog / article 研究
- 小中型站點內容蒐集
- OpenClaw 研究型 agent 的 web intelligence backend
- 後續變更監控的 baseline 能力

### 目前還不適合的用途
- 大規模 production crawling
- 高頻跨網域分散式抓取
- 重度 anti-bot 對抗
- 需要完整 proxy pool / queue / distributed worker 的場景

> 這些不是「永遠不做」，而是屬於 production capability track。建議先完成 research strengthening，再進入 bridge / production 階段。詳見 [`docs/RESEARCH_TO_PRODUCTION_PLAN.md`](./docs/RESEARCH_TO_PRODUCTION_PLAN.md)。

---

## 運作原理

## 1) Search：先找來源

當你不知道要抓哪幾頁時，先走 search。

```text
query -> DDGS adapter -> ranked results -> agent 選擇候選來源
```

用途：
- 廣搜主題
- 找 docs / blog / issue / changelog
- 幫 extract / crawl 找入口 URL

---

## 2) Extract：對單頁做高品質抽取

`extract()` 的流程是：

```text
request
  -> schema validation
  -> request cache lookup
  -> page cache lookup / revalidation
  -> router decision (static/browser)
  -> fetch
  -> extract pipeline
  -> optional structured extraction
  -> confidence/sourceQuality/fetch metadata
  -> response cache write
```

### Extract 的核心設計

#### A. 不是直接抓 HTML 就結束
它會把頁面轉成：
- `markdown`
- `text`
- `metadata`
- `links`
- `structured`
- `confidence`
- `sourceQuality`
- `fetch decision metadata`

也就是說，輸出是 **給 agent 直接吃的文件物件**，不是單純 raw HTML。

#### B. 先 static，必要時 browser
預設 `renderMode=auto`：
- 先走 static fetch
- 若判斷像 JS shell / noscript shell / thin DOM / low-confidence，就 browser retry

#### C. 保留策略決策資訊
每個 document 都會附帶：
- `fetch.strategy`
- `fetch.initialStrategy`
- `fetch.autoRetried`
- `fetch.retryReason`
- `fetch.fallbackUsed`

這對 debug 與之後做 host policy memory 很重要。

---

## 3) Map：先看網站長什麼樣

`map()` 不抽取完整內容，而是做 **站點結構探索**。

```text
seed URL
  -> scope check
  -> robots check
  -> fetch page
  -> extract links
  -> BFS enqueue
  -> discovered URL list + summary + debug
```

適合用在：
- 先了解 docs site 結構
- 找到 guide / api / reference / blog 分支
- 給後續 crawl 決定抓哪些頁面

---

## 4) Crawl：探索 + 抽取一起做

`crawl()` 是 map 與 extract 的結合：

```text
seed URL
  -> BFS traversal
  -> robots policy
  -> page fetch
  -> shared extract pipeline
  -> document list
  -> crawl summary
```

關鍵點：
- `crawl` 和 `extract` 用同一套 shared extraction pipeline
- 所以單頁抓取與整站抓取的文件格式一致
- 這對 agent 下游非常重要，因為它不用處理兩種不同 document schema

---

## 5) Cache：為什麼要雙層快取

這個專案不是只做一個快取，而是做兩層：

### Request Cache
以「完整 request 參數」為 key。

適合解決：
- 同樣 query / 同樣 extract request 反覆執行
- 直接回應整包結果

### Page Cache
以「URL + 抓取結果」為核心。

適合解決：
- map / crawl / extract 共用同一頁結果
- 支援 ETag / Last-Modified revalidation
- 304 時可直接重用先前 snapshot

### 為什麼這樣拆
因為：
- request cache 解決「同一請求重跑」
- page cache 解決「同一頁被不同流程共用」

這比單一 cache 更接近 crawler / retrieval 實際需求。

---

## 6) Browser fallback：什麼時候會啟用

當 static 抓到的結果可能只是前端殼時，系統會考慮改走 browser。

目前 heuristic v1.1 會看：
- React / Next / Nuxt / Remix 類 marker
- `noscript` 提示要開 JavaScript
- script 過多但內容過薄
- DOM 看起來像 app shell
- 低 confidence 結果

這一層的目標不是「永遠最聰明」，而是：
- 先以低成本 static 為主
- 在高機率失敗頁面再升級到 browser
- 平衡品質與成本

---

## 7) Structured extraction：為什麼不是只有 text

對 agent 來說，純文字常常不夠。

例如：
- article 想知道 author / publish date / section
- docs 想知道 heading tree / code block / TOC / guide vs reference
- product 想知道 price / currency / availability
- forum 想知道 thread title / post count / author count

因此這個專案提供 pluggable structured extractors。

### 目前支援
- `article`
- `docs`
- `product`
- `forum`

### docs v1.1 例子
- `headingTree`
- `codeBlockCount`
- `navLinkCount`
- `hasTableOfContents`
- `sectionCount`
- `wordCount`
- `pathType`

### article v1.1 例子
- `headline`
- `author`
- `publishedAt`
- `updatedAt`
- `section`
- `tagCount`
- 支援 JSON-LD Article

---

## 8) Monitor / Diff：目前做到哪

Monitor v1 已完成。

### 現在能做的事
- 對 target 建立 baseline snapshot
- 後續再次執行時比對差異
- 支援 `extract` / `crawl` 兩種 execution
- 比對欄位：
  - `title`
  - `textHash`
  - `structuredHash`
  - `urlCount`

### 還沒做的事
- recurring schedule
- alerting
- diff history persistence
- severity model

所以目前 monitor 是 **可驗證的 engine**，但還不是完整產品化監控系統。

---

## 如何使用

## 環境需求

- Node.js 18+
- npm
- `ddgs` CLI（搜尋用）
- 若要 browser fetch：Playwright + Chromium binaries

### 安裝

```bash
cd projects/openclaw-web-intelligence
npm install
npx playwright install chromium
```

---

## CLI 用法

## 1. Search

```bash
npm run search -- --query "openclaw browser automation"
npm run search -- --query "web crawler docs" --max-results 5
npm run search -- --query "playwright docs" --exclude-domains=pinterest.com,facebook.com
```

---

## 2. Extract

```bash
# 基本單頁抽取
npm run extract -- --url "https://example.com/docs/getting-started"

# 明確要求 browser
npm run extract -- --url "https://example.com/app" --render-mode=browser

# auto 模式 + structured
npm run extract -- --url "https://example.com/blog/post" --include-structured=true --render-mode=auto

# 限制允許/拒絕網域
npm run extract -- --url "https://example.com/docs" --allow-domains=example.com
npm run extract -- --url "https://example.com" --deny-domains=ads.example.com
```

### 典型輸出欄位
- `markdown`
- `text`
- `metadata`
- `links`
- `structured`
- `confidence`
- `sourceQuality`
- `fetch`
- `cache`

---

## 3. Map

```bash
npm run map -- --url "https://docs.example.com"
npm run map -- --url "https://docs.example.com" --max-depth 2 --limit 50
npm run map -- --url "https://docs.example.com" --robots-mode=strict

# 使用 sitemap 發現 URL（適用於 docs / blog / changelog 站點）
npm run map -- --url "https://docs.example.com" --discover-from-sitemap=true --limit 100
```

### 適合場景
- 先看 docs 站結構
- 想知道有哪些 guide / api / blog 分支
- 幫 crawl 選入口
- 使用 `--discover-from-sitemap=true` 從 sitemap.xml 直接取得 URL，大幅提高 coverage

---

## 4. Crawl

```bash
npm run crawl -- --url "https://docs.example.com"
npm run crawl -- --url "https://docs.example.com" --max-depth 2 --limit 20 --include-structured=true
npm run crawl -- --url "https://docs.example.com" --robots-mode=balanced --include-structured=true

# 使用 sitemap 發現 URL
npm run crawl -- --url "https://docs.example.com" --discover-from-sitemap=true --limit 50
```

### 適合場景
- 整批抓 docs
- 一次拿到多頁 document objects
- 做 agent research corpus

---

## 5. Cache

```bash
npm run cache -- stats
npm run cache -- clear
```

---

## 作為程式庫使用

```ts
import { search, extract, map, crawl, monitor } from './src/api/index.js';

const results = await search({
  query: 'openclaw docs',
  maxResults: 5,
});

const extracted = await extract({
  urls: ['https://example.com/docs/getting-started'],
  renderMode: 'auto',
  includeStructured: true,
  cacheTtlSeconds: 3600,
});

const crawled = await crawl({
  seedUrl: 'https://docs.example.com',
  maxDepth: 2,
  limit: 10,
  includeStructured: true,
  robotsMode: 'balanced',
});

const monitored = await monitor({
  targetType: 'page',
  target: 'https://example.com/changelog',
  schedule: 'every 1h',
  execution: { operation: 'extract' },
});
```

---

## OpenClaw 中怎麼運用

這個專案最適合當成 OpenClaw 的 **web intelligence backend / skill backend**。

### 典型 workflow 1：研究主題
```text
User asks research question
  -> search 找候選來源
  -> extract 抓重要單頁
  -> crawl 抓 docs/blog 補上下文
  -> summarize / synthesize
```

### 典型 workflow 2：技術文件站分析
```text
map 看站點結構
  -> crawl 重要分支
  -> structured docs extraction
  -> output heading tree / code-rich pages / references
```

### 典型 workflow 3：變更監控 baseline
```text
monitor 建 baseline
  -> recurring run（未來）
  -> compare text/structured/urlCount
  -> trigger alert
```

---

## 使用方式

### CLI 指令

```bash
cd ~/projects/openclaw-web-intelligence

# Search - 搜尋候選 URL
npm run search -- --query "React server components"

# Extract - 擷取單一頁面
npm run extract -- --url https://react.dev --include-structured=true

# Map - 探索網站結構
npm run map -- --url https://react.dev --max-depth=2

# Crawl - 爬取多頁面
npm run crawl -- --url https://react.dev --max-depth=2 --limit=50

# Monitor - 建立/檢查變更
npm run monitor -- --url https://react.dev/changelog
```

### 程式化使用 (TypeScript)

```typescript
import { search, extract, crawl, map, monitor } from './src/api/index.js';

// Search
const sources = await search({ query: "TypeScript best practices" });

// Extract
const docs = await extract({
  urls: ["https://www.typescriptlang.org/docs/"],
  includeStructured: true,
});

// Crawl
const corpus = await crawl({
  seedUrl: "https://docs.example.com",
  maxDepth: 2,
  limit: 50,
  robotsMode: "balanced",
});

// Map
const siteMap = await map({
  url: "https://docs.example.com",
  maxDepth: 2,
  limit: 100,
});

// Monitor - 建立 baseline
const baseline = await monitor({
  target: "https://docs.example.com/changelog",
  execution: { operation: "extract" },
});

// Monitor - 檢查變更
const check = await monitor({
  target: "https://docs.example.com/changelog",
  execution: { operation: "extract" },
});
// check.data.changed === true 表示有變更
```

### 主要 API 參數

| 功能 | 參數 | 說明 |
|------|------|------|
| **Extract** | `urls` | 要擷取的 URL 陣列 |
| | `includeStructured` | 開啟結構化欄位提取 |
| | `renderMode` | auto/static/browser |
| **Crawl** | `seedUrl` | 起始 URL |
| | `maxDepth` | 最大爬取深度 |
| | `limit` | 最大頁面數 |
| | `robotsMode` | strict/balanced/off |
| **Map** | `url` | 目標 URL |
| | `maxDepth` | 最大深度 |
| | `limit` | 最大 URL 數 |
| **Monitor** | `target` | 監控目標 |
| | `execution.operation` | extract/crawl |

---

## Repo 內附 Skill

本 repo 已內附一個可直接引用的 skill：

- `skills/openclaw-web-intelligence/SKILL.md`

它的用途是：
- 告訴 OpenClaw 什麼時候該用這個專案
- 提供建議 workflow
- 說明 search / extract / map / crawl / monitor 的使用時機

如果你想把這個 repo 當成 skill 一起分發，直接保留 `skills/` 目錄即可。

---

## 專案結構

```text
openclaw-web-intelligence/
├── src/
│   ├── api/                  # 對外 API export
│   ├── cache/                # request/page cache abstraction
│   ├── engines/
│   │   ├── search/           # DDGS search
│   │   ├── extract/          # extract engine
│   │   └── crawl/            # map / crawl / robots policy
│   ├── extract/              # shared extract pipeline
│   ├── fetch/                # static/browser fetchers + router wrapper
│   ├── monitor/              # monitor / diff v1
│   ├── observability/        # request logging
│   ├── router/               # retrieval routing heuristics
│   ├── scripts/              # CLI entrypoints
│   ├── storage/              # file cache implementation
│   └── types/                # zod schemas / errors / utils
├── tests/
├── docs/
├── skills/
├── artifacts/
├── .cache/
└── logs/
```

---

## 開發與驗證

### 型別檢查
```bash
npm run check
```

### 測試
```bash
npm run test
```

目前測試涵蓋：
- shared extraction pipeline parity
- browser fallback / auto-detection
- robots policy
- conditional cache revalidation
- structured extraction
- monitor / diff

---

## 錯誤處理

常見錯誤碼：

| Code | 說明 |
|------|------|
| `VALIDATION_ERROR` | 請求參數不合法 |
| `DOMAIN_POLICY_DENIED` | 網域政策阻擋 |
| `FETCH_TIMEOUT` | 抓取逾時 |
| `FETCH_HTTP_ERROR` | HTTP 錯誤 |
| `BROWSER_UNAVAILABLE` | Playwright / browser binaries 不可用 |
| `ROBOTS_POLICY_DENIED` | robots 規則拒絕 |
| `INTERNAL_ERROR` | 其他內部錯誤 |

---

## 現在最值得繼續開發的方向

✅ Research Strengthening 與 Bridge Layer 已完成。

下一階段進入 **Production Capability Track**，建議優先順序：
1. Queue / worker abstraction
2. Persistent job orchestration
3. Proxy strategy
4. Anti-bot policy layer
5. Distributed crawling
6. Storage backend upgrade
7. Production observability / health model

完整路線請見 [`docs/RESEARCH_TO_PRODUCTION_PLAN.md`](./docs/RESEARCH_TO_PRODUCTION_PLAN.md)。

---

## 相關文件

- [CURRENT_STATE.md](./docs/CURRENT_STATE.md)
- [ROADMAP.md](./docs/ROADMAP.md)
- [RESEARCH_TO_PRODUCTION_PLAN.md](./docs/RESEARCH_TO_PRODUCTION_PLAN.md)
- [BROWSER_OPS.md](./docs/BROWSER_OPS.md)
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [PRD](./docs/openclaw-web-intelligence-prd.md)
- [SDD](./docs/openclaw-web-intelligence-sdd.md)
- [User Stories](./docs/openclaw-web-intelligence-user-stories.md)
- [API Spec](./docs/openclaw-web-intelligence-api-spec.md)
- [Implementation Plan](./docs/openclaw-web-intelligence-implementation-plan.md)

---

## License

MIT
