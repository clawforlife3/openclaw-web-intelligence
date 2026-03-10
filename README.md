# OpenClaw Web Intelligence Gateway 🕸️

> 為 OpenClaw Agent 打造的網頁資料獲取工具，支援搜尋、擷取、網站地圖建構、爬蟲與快取。

## 功能特色

- **🔍 搜尋（Search）**：整合 DDGS 搜尋引擎，可依關鍵字搜尋網頁結果
- **📄 擷取（Extract）**：對單一 URL 進行 HTTP 請求，取得 Markdown/Text 格式內容
- **🗺️ 網站地圖（Map）**：BFS 演算法探索網站結構，回傳所有發現的頁面
- **🕷️ 爬蟲（Crawl）**：結合網站探索與內容擷取，一次完成發現 + 擷取
- **💾 快取（Cache）**：內建 JSON 檔案快取，支援 TTL 過期與命中/未命中統計
- **📊 監控（Monitor）**：頁面變更偵測與差異比對（Post-MVP）

## 快速開始

### 安裝依賴

```bash
cd projects/openclaw-web-intelligence
npm install
```

### 環境需求

- Node.js 18+
- npm
- [ddgs CLI](https://github.com/BugDownLoad/ddgs)（用於搜尋功能）

## CLI 命令

### 1. 搜尋（Search）

根據關鍵字搜尋網頁：

```bash
# 基本搜尋
npm run search -- --query "web scraping 教學"

# 限制回傳數量
npm run search -- --query "openclaw" --max-results 5

# 排除特定網域
npm run search -- --query "python" --exclude-domains=pinterest.com,facebook.com
```

**輸出範例：**

```json
{
  "success": true,
  "data": {
    "query": "web scraping 教學",
    "results": [
      {
        "url": "https://example.com/article",
        "title": "網頁爬蟲完整教學",
        "snippet": "從基礎到進階的網頁爬蟲技術...",
        "rank": 1,
        "domain": "example.com"
      }
    ],
    "provider": "ddgs"
  },
  "meta": {
    "requestId": "req_abc123",
    "traceId": "trace_xyz789",
    "tookMs": 1500,
    "schemaVersion": "v1"
  }
}
```

---

### 2. 擷取（Extract）

從單一 URL 擷取內容：

```bash
# 基本擷取
npm run extract -- --url "https://www.octoparse.com/blog/top-10-most-scraped-websites"

# 只允許特定網域
npm run extract -- --url "https://example.com/docs" --allow-domains=example.com

# 封鎖特定網域
npm run extract -- --url "https://example.com" --deny-domains=ads.example.com
```

**輸出欄位說明：**
| 欄位 | 說明 |
|------|------|
| `url` | 原始請求 URL |
| `finalUrl` | 最終 URL（可能因轉址而不同） |
| `title` | 頁面標題 |
| `markdown` | HTML 轉 Markdown 格式 |
| `text` | 純文字內容 |
| `metadata` | 包含 description、canonical、language 等 |
| `links` | 頁面中所有連結 |
| `confidence` | 擷取品質分數（0-1） |
| `sourceQuality` | 來源品質分數（0-1） |

---

### 3. 網站地圖（Map）

探索網站結構，回傳所有發現的頁面：

```bash
# 基本探索
npm run map -- --url "https://docs.example.com"

# 限制深度與頁數
npm run map -- --url "https://example.com" --max-depth 2 --limit 50
```

**輸出範例：**

```json
{
  "success": true,
  "data": {
    "seedUrl": "https://docs.example.com",
    "urls": [
      { "url": "https://docs.example.com", "depth": 0 },
      { "url": "https://docs.example.com/guide", "depth": 1, "discoveredFrom": "https://docs.example.com" }
    ],
    "summary": {
      "visited": 15,
      "discovered": 42,
      "excluded": 3,
      "stoppedReason": "limit_reached"
    }
  }
}
```

---

### 4. 爬蟲（Crawl）

結合網站探索與內容擷取：

```bash
# 基本爬蟲
npm run crawl -- --url "https://docs.example.com"

# 限制深度與頁數
npm run crawl -- --url "https://example.com/blog" --max-depth 3 --limit 20
```

**輸出範例：**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "seedUrl": "https://docs.example.com",
    "documents": [
      {
        "url": "https://docs.example.com/getting-started",
        "title": "快速開始",
        "markdown": "# 快速開始...",
        "confidence": 0.85,
        "sourceQuality": 0.95
      }
    ],
    "summary": {
      "visited": 10,
      "extracted": 10,
      "skipped": 0,
      "errors": 0,
      "stoppedReason": "limit_reached"
    }
  }
}
```

---

### 5. 快取（Cache）

管理請求快取：

```bash
# 查看快取統計
npm run cache -- stats

# 清除所有快取
npm run cache -- clear

# 使用快取擷取
npm run cache -- extract --url "https://example.com"

# 不使用快取（直接請求）
npm run cache -- extract --url "https://example.com" --no-cache
```

---

## 開發與測試

### 類型檢查

```bash
npm run check
```

### 執行測試

```bash
npm run test
```

### OpenClaw Skill

本專案亦包裝為 OpenClaw Skill，可直接在其他 OpenClaw 專案中引用：

- **Skill 位置**：`../skills/openclaw-web-intelligence/`
- **引用方式**：參考 `SKILL.md` 文件

---

## API 規格符合度

本實作完全符合 `openclaw-web-intelligence-api-spec.md` 文件定義的 v1 API 規格。

### 已實作功能

| 功能         | API 規格欄位                                | 狀態 |
| ------------ | ------------------------------------------- | ---- |
| 請求追蹤 ID  | `meta.requestId`, `meta.traceId`            | ✅   |
| 執行時間     | `meta.tookMs`                               | ✅   |
| Schema 版本  | `meta.schemaVersion`                        | ✅   |
| 信心分數     | `document.confidence`                       | ✅   |
| 來源品質     | `document.sourceQuality`                    | ✅   |
| 結構化資料   | `document.structured`                       | ✅   |
| 快取中繼資料 | `document.cache`                            | ✅   |
| 不可信標記   | `document.untrusted`                        | ✅   |
| 網站地圖摘要 | `summary.excluded`, `summary.stoppedReason` | ✅   |
| 爬蟲摘要     | `summary.skipped`, `jobId`                  | ✅   |
| 搜尋排名     | `result.rank`, `result.domain`              | ✅   |

---

## 錯誤處理

所有 CLI 命令都會回傳結構化錯誤：

```json
{
  "success": false,
  "error": {
    "code": "FETCH_TIMEOUT",
    "message": "請求超時",
    "retryable": true,
    "details": {
      "url": "https://example.com",
      "timeoutMs": 15000
    }
  }
}
```

### 錯誤碼說明

| 錯誤碼                 | 說明                     | 可重試 |
| ---------------------- | ------------------------ | ------ |
| `VALIDATION_ERROR`     | 參數驗證失敗             | ❌     |
| `DOMAIN_POLICY_DENIED` | 網域被政策拒絕           | ❌     |
| `FETCH_TIMEOUT`        | 請求超時                 | ✅     |
| `FETCH_HTTP_ERROR`     | HTTP 錯誤（如 404、500） | ✅     |
| `PARSE_ERROR`          | HTML 解析失敗            | ❌     |
| `SEARCH_ERROR`         | 搜尋引擎錯誤             | ✅     |
| `INTERNAL_ERROR`       | 內部錯誤                 | ✅     |

---

## 專案結構

```
openclaw-web-intelligence/
├── src/
│   ├── api/                    # 公開 API 匯出
│   ├── engines/
│   │   ├── extract/           # HTTP 擷取引擎
│   │   ├── search/            # 搜尋引擎 adapter
│   │   └── crawl/             # 爬蟲引擎
│   ├── router/                # 檢索路由
│   ├── types/
│   │   ├── schemas.ts         # Zod API 規格
│   │   ├── errors.ts          # 錯誤類別
│   │   └── utils.ts           # ID 生成工具
│   ├── observability/         # 請求日誌
│   ├── storage/               # 快取實作
│   └── scripts/               # CLI 入口點
├── tests/                     # 測試檔案
├── .cache/                    # 快取目錄（自動生成）
└── logs/                      # 日誌目錄（自動生成）
```

---

## 技術棧

- **語言**：TypeScript + Node.js（ESM）
- **驗證**：Zod
- **HTML 解析**：Cheerio
- **搜尋引擎**：DDGS CLI
- **測試框架**：Vitest

---

## 授權

MIT License

---

## 相關文件

本專案包含以下文件：

| 文件                                                                           | 說明                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [PRD](./docs/openclaw-web-intelligence-prd.md)                                 | 產品需求文件 - 定義產品目標、功能範圍與成功指標          |
| [SDD](./docs/openclaw-web-intelligence-sdd.md)                                 | 技術架構文件 - 系統架構、模組設計與技術決策              |
| [User Stories](./docs/openclaw-web-intelligence-user-stories.md)               | 使用者故事 - 以使用者角度描述功能需求                    |
| [API Spec](./docs/openclaw-web-intelligence-api-spec.md)                       | API 規格文件 - 所有 Operation 的 Request/Response Schema |
| [Implementation Plan](./docs/openclaw-web-intelligence-implementation-plan.md) | 實作計畫 - 4 週 MVP 開發路線圖                           |

所有文件皆存放於 `docs/` 目錄下。
