---
name: openclaw-web-intelligence
description: Use this skill when you need high-quality web intelligence for research, documentation analysis, structured extraction, website mapping, crawling, or baseline change detection with monitor/diff.
---

# OpenClaw Web Intelligence Skill

## What this skill is for

This skill wraps the `openclaw-web-intelligence` project as a reusable capability for OpenClaw agents.

Use it when you need to:
- turn a natural-language topic into a research task
- search the web for candidate sources
- extract a single page into agent-friendly content
- map a documentation or website structure
- crawl a small-to-medium site for research
- get structured fields from article/docs/product/forum pages
- establish a baseline and compare future page/site changes

Do **not** use it as your first choice for:
- large-scale production crawling
- anti-bot heavy targets
- distributed crawling jobs with strict SLOs (use Redis worker + cluster coordinator baseline for that)
- browser interaction workflows requiring clicks/forms/login (use browser automation tooling for that)

---

## Core mental model

Choose the highest-level operation that answers the question:

1. **research_topic**
   - Use when the user gives a topic, not URLs.
   - Best for market scans, competitor research, trend snapshots, and initial evidence collection.

2. **crawl_domain**
   - Use when the user wants one domain mapped and categorized.
   - Best for docs/product/blog sites where you want recommended extraction targets.

3. **monitor_topic**
   - Use when the user wants recurring monitoring across domains or a theme.

4. **search**
   - Use when you need candidate URLs.
   - Good for topic discovery and source finding.

5. **extract**
   - Use when you already know the URL and want the content.
   - Best for one page, docs page, article, changelog, release notes, blog post.

6. **map**
   - Use when you need to understand a site structure before crawling.
   - Best for docs sites, help centers, knowledge bases.

7. **crawl**
   - Use when you need multiple pages from one site.
   - Best for building a research corpus from a constrained scope.

8. **monitor**
   - Use when you need a baseline snapshot and later diff checks.
   - Good for changelogs, docs sections, pricing pages, status pages.

---

## How to use from OpenClaw Agent

### Method 1: CLI (直接執行)

```bash
# 進入專案目錄
cd ~/projects/openclaw-web-intelligence

# Search - 搜尋候選 URL
npm run search -- --query "React server components"

# Research Topic - 輸入 topic 直接建立研究任務
npm run research -- --topic "台灣 CRM 市場" --goal=compare --region=台灣 --time-range=近三年

# Crawl Domain - domain 級探索
npm run crawl-domain -- --domain react.dev --goal="analyze docs"

# Monitor Topic - topic 級監控
npm run monitor-topic -- --topic "品牌負評" --watch-domains=forum.example.com,news.example.com

# Extract - 擷取單一頁面
npm run extract -- --url https://react.dev --include-structured=true

# Map - 探索網站結構
npm run map -- --url https://react.dev --max-depth=2

# Crawl - 爬取多頁面
npm run crawl -- --url https://react.dev --max-depth=2 --limit=50

# Monitor - 建立 baseline 並比對變更
npm run monitor -- --url https://react.dev/changelog

# Dashboard - 觀測摘要
npm run dashboard
```

### Method 2: Import as Module (在 code 中使用)

```typescript
import { researchTopic, crawlDomain, monitorTopic, search, extract, crawl, map, monitor, ClusterCoordinator } from './src/api/index.js';

// Search
const searchResult = await search({ query: "TypeScript best practices" });

// Extract
const extractResult = await extract({
  urls: ["https://www.typescriptlang.org/docs/"],
  includeStructured: true,
});

// Crawl
const crawlResult = await crawl({
  seedUrl: "https://docs.example.com",
  maxDepth: 2,
  limit: 50,
});

// Map
const mapResult = await map({
  url: "https://docs.example.com",
  maxDepth: 2,
  limit: 100,
});

// Monitor (建立 baseline)
const baseline = await monitor({
  target: "https://docs.example.com/changelog",
  execution: { operation: "extract" },
});

// Monitor (檢查變更)
const check = await monitor({
  target: "https://docs.example.com/changelog",
  execution: { operation: "extract" },
});
// check.data.changed === true 表示有變更
```

### Method 3: As OpenClaw MCP/Worker

可以將此專案包裝為 MCP server 或 worker，讓 OpenClaw agent 透過 API 調用。

---

## Suggested workflow patterns

### Pattern A: Topic research

```
search → extract top sources → crawl one authoritative site → synthesize
```

Use this for:
- market scans
- technical validation
- competitor/product/docs analysis

### Pattern B: Documentation analysis

```
map → crawl → structured docs extraction → summarize
```

Use this for:
- reading unfamiliar product docs
- understanding API or SDK surface area
- comparing documentation quality across products

### Pattern C: Change detection baseline

```
monitor(create baseline) → rerun monitor later → compare
```

Use this for:
- changelog pages
- pricing pages
- release docs
- policy pages

---

## Key API Options

### Extract
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `urls` | string[] | required | URLs to extract |
| `includeStructured` | boolean | false | 結構化欄位提取 |
| `renderMode` | auto/static/browser | auto | 渲染模式 |
| `allowDomains` | string[] | [] | 允許的網域 |
| `denyDomains` | string[] | [] | 拒絕的網域 |

### Crawl
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `seedUrl` | string | required | 起始 URL |
| `maxDepth` | number | 2 | 最大深度 |
| `limit` | number | 100 | 最大頁面數 |
| `robotsMode` | strict/balanced/off | balanced | robots.txt 策略 |

### Map
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | required | 目標 URL |
| `maxDepth` | number | 2 | 最大深度 |
| `limit` | number | 100 | 最大 URL 數 |

### Monitor
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | string | required | 監控目標 URL |
| `execution.operation` | extract/crawl | required | 執行操作 |
| `schedule` | string | - | 排程 (如 "every 1h") |
| `notifyPolicy` | object | - | 通知策略 |

---

## Output expectations

When using this skill, prefer outputs that include:
- executive summary first
- clear source URLs
- what was extracted vs inferred
- confidence caveats when content looks thin or JS-heavy

For docs crawling, call out:
- heading structure
- code-heavy pages
- guide vs reference split
- any browser-required pages

---

## Repo references

- Project: `projects/openclaw-web-intelligence/`
- README: `projects/openclaw-web-intelligence/README.md`
- Current state: `projects/openclaw-web-intelligence/docs/CURRENT_STATE.md`

---

## 已實現的功能 (2026-03-11)

✅ Sitemap ingestion  
✅ Retry classification  
✅ Host policy memory  
✅ Site-specific structured extraction (Docusaurus/MkDocs/GitHub Docs/Changelog)  
✅ Browser ops 部署文件  
✅ Per-domain rate limiting  
✅ Monitor scheduling + alerting  
✅ Job queue / worker  
✅ Health endpoint  
✅ Anti-bot detection (403/429)  
✅ Distributed crawling (worker/shard)  
✅ Storage backend (SQLite + memory)
✅ Session persistence / cookie jar baseline
✅ Challenge detection / manual escalation baseline
✅ Cluster coordinator / namespace isolation baseline

---

## Current limitations

- 大規模分散式爬蟲需要外部 worker 協調
- 複雜 anti-bot 網站需要自定義策略
- Redis / proxy integration tests 在受限環境下會走 env-gated harness
