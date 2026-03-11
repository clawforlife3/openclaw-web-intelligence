# OpenClaw Web Intelligence Gateway — Roadmap

> 本文件定義專案的長期發展路線圖，分為 MVP 與後續演進階段。

---

## 📍 當前狀態

| 版本 | 狀態 | 日期 |
|------|------|------|
| MVP 1.0 | ✅ 已完成 | 2026-03-10 |
| MVP 2.0 | 🚧 進行中（多個 phase 已有第一版） | 2026-03-11 |

現況總覽請參考 [CURRENT_STATE.md](./CURRENT_STATE.md)。

---

## 🗺️ 總體規劃

```mermaid
flowchart LR
    A[MVP 1.0] --> B[MVP 2.0]
    B --> C[Research Crawler]
    C --> D[Production Crawler]
    
    B --> B1[Phase 1: 補齊]
    B --> B2[Phase 4: robots]
    C --> C1[Phase 2: browser]
    C --> C2[Phase 3: structured]
    D --> D1[Phase 5: proxy]
    D --> D2[Phase 6: distributed]
```

---

## 📦 版本規劃

### MVP 1.0 ✅（當前）

**目標**：基本功能可用

**已完成功能**：
- 🔍 搜尋（DDGS adapter）
- 📄 擷取（HTTP fetch + Cheerio）
- 🗺️ 網站地圖（BFS 探索）
- 🕷️ 爬蟲（探索 + 擷取）
- 💾 快取（JSON 檔案快取）
- 📊 API 規格符合度 95%

**限制**：
- 僅支援靜態 HTML
- 無 robots.txt 解析
- 無 structured extraction
- 單機同步執行

---

### MVP 2.0（下一版本）

**目標**：把現在的 MVP 補到實用等級

**預計時間**：2-3 週

| Phase | 內容 | 優先級 |
|-------|------|--------|
| Phase 1 | 統一 extraction pipeline + 雙層快取 | 🔴 高 |
| Phase 4 | robots.txt 解析與策略 | 🔴 高 |
| Phase 3 | Structured extraction（三層設計） | 🟡 中 |
| Phase 2 | Headless browser fallback | 🟡 中 |

**詳細內容**：

#### Phase 1：統一 extraction pipeline + 雙層快取
- [x] 重構 httpExtractor 與 crawler 共用抽取邏輯
- [x] 實作雙層快取基礎（request cache + page cache）
- [x] 加入 ETag/Last-Modified 支援
- [ ] 加入 per-URL TTL

> 備註：2026-03-11 已完成 Phase 1 第一版骨架，後續可在此基礎上接 browser / structured / robots。

#### Phase 4：robots.txt 解析
- [x] 解析各主機的 robots.txt 政策
- [x] 實作 strict/balanced/off 三種模式
- [x] 在 frontier enqueue 前檢查
- [ ] 補 crawl report / debug metadata 中的 robots decision trace

#### Phase 3：Structured extraction
- [x] 三層設計中的第一版站型 structured extraction 骨架
- [x] Pluggable extractor 架構（article/docs/product/forum 基礎版）
- [x] docs/article coverage 第一輪擴充（JSON-LD article、TOC/section/pathType 等）
- [ ] 強化更多 site-specific extractor 與 schema normalization

#### Phase 2：Headless browser
- [x] Playwright fetcher 第一版
- [x] fetchRouter / routing skeleton
- [x] browser fallback skeleton（router + fetcher + fallback wiring）
- [x] 自動 fallback（static → browser）第一版，已支援 extract / crawl
- [x] heuristics v1.1：JS shell / noscript shell / thin DOM detection
- [ ] host-specific heuristics / retry classification 正式版（持續調優）
- [ ] browser binaries 安裝與運維文件

> 備註：2026-03-11 已完成 Phase 2 第一版，可執行 browser fetch；部署端仍需確保 Playwright Chromium binaries 可用。

---

### Research Crawler（研究型爬蟲）

**目標**：能穩定擷取 docs/blog/article 網站

**預計時間**：4-6 週

| Phase | 內容 |
|-------|------|
| Phase 2 | Headless browser rendering |
| Phase 3 | Structured extraction |
| - | Fallback render strategy |
| - | Host policy memory |
| - | Sitemap ingestion |
| - | Retry classification |

---

### Production Crawler（生產型爬蟲）

**目標**：可規模化、可分散式

**預計時間**：8-12 週

| Phase | 內容 |
|-------|------|
| Phase 5 | Proxy pool + anti-bot |
| Phase 6 | 分散式 queue + worker |
| - | Redis queue |
| - | Multi-worker crawl |
| - | Recrawl / change detection |

---

## ✅ 優先執行順序

根據成本效益分析：

| 優先 | 階段 | 理由 |
|------|------|------|
| 1 | Phase 1 | 立即可做，回報大 |
| 2 | Phase 4 | 降低倫理風險 |
| 3 | Phase 3 | 核心能力 |
| 4 | Phase 2 | JS-heavy 網站支援 |
| 5 | Phase 5 | 長期需要 |
| 6 | Phase 6 | 規模化後再說 |

---

## 📊 功能對照表

| 功能 | MVP 1.0 | MVP 2.0 | Research | Production |
|------|---------|----------|----------|------------|
| 靜態 HTTP fetch | ✅ | ✅ | ✅ | ✅ |
| Headless browser | ❌ | 🔄 | ✅ | ✅ |
| Structured extraction | ❌ | 🔄 | ✅ | ✅ |
| robots.txt | ❌ | 🔄 | ✅ | ✅ |
| Proxy routing | ❌ | ❌ | 🔄 | ✅ |
| 分散式 | ❌ | ❌ | ❌ | 🔄 |
| Monitor/Diff | ❌ | ✅ v1 | 🔄 | ✅ |

---

## 🔗 相關文件

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 詳細架構說明
- [README.md](./README.md) - 專案說明與快速開始
- [Implementation Plan](./docs/openclaw-web-intelligence-implementation-plan.md) - MVP 2.0 細部規劃
- [API Spec](./docs/openclaw-web-intelligence-api-spec.md) - API 規格
