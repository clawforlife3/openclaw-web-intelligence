# OpenClaw Autonomous Web Research Skill — Current State

> Snapshot date: 2026-03-11
> Canonical product/spec documents:
> - [openclaw-web-intelligence-prd.md](./openclaw-web-intelligence-prd.md)
> - [openclaw-web-intelligence-sdd.md](./openclaw-web-intelligence-sdd.md)
> - [openclaw-web-intelligence-user-stories.md](./openclaw-web-intelligence-user-stories.md)

## Executive Summary

專案目前應被視為：

- 底層 `retrieval / crawl / anti-bot / queue / observability` 基礎已相對成熟
- 上層 `autonomous research orchestration` 已有可用 baseline，但仍未完成
- 產品已從 `web crawler gateway` 轉向 `OpenClaw autonomous web research skill`

目前已落地的主線能力：

- `research_topic` task-level gateway baseline
- `crawl_domain` task-level gateway baseline
- `monitor_topic` recurring baseline
- topic planner / query generation baseline
- search-driven discovery baseline
- extraction-backed normalized research documents
- corpus scoring / dedup / domain diversity baseline
- structured research analysis reports
- monitor-to-research orchestration baseline
- research task persistence / resume baseline

## Completion Estimate

### New Product Definition

若依據最新 `PRD / SDD / User Stories` 的產品範圍評估：

- **Autonomous Web Research Skill 整體完成度：約 55%–65%**
- 建議對外溝通時以 **約 60%** 作為目前整體進度

### Split View

- **底層 Web Intelligence / Retrieval Infrastructure：約 85%–95%**
- **上層 Autonomous Research Skill Productization：約 55%–65%**

> 先前文件中的 `95%–98%` 比較接近底層 crawler / retrieval hardening，不適合作為目前產品整體完成度。

## Progress by Epic

| Epic | Scope | Estimated Progress | Current State |
|------|-------|--------------------|---------------|
| Epic 1 | Skill Gateway and Task Lifecycle | 80% | `research_topic` / `crawl_domain` / `monitor_topic` 已有 baseline，含 `get/list/resume/rerun` |
| Epic 2 | Planning and Query Generation | 70% | planner 已能依 topic/goal 產生 queries、source types、stop conditions |
| Epic 3 | Discovery and Candidate URL Collection | 55% | 已有 search harvesting；monitor 也已接 planner + search；sitemap / domain expansion 尚未進 research 主路徑 |
| Epic 4 | Retrieval and Fetch Strategy | 85% | static/browser/proxy/session/challenge/rate limit 基礎已相對完整 |
| Epic 5 | Extraction and Document Normalization | 70% | 已產出 normalized research documents，但 research-first schema normalization 尚未完全深化 |
| Epic 6 | Corpus Processing | 60% | 已有 exact dedup / ranking / diversity baseline；near-dedup / spam filtering / canonical clustering 仍不足 |
| Epic 7 | Analysis and Reporting | 65% | 已有 structured report / evidence / clusters / comparison baseline；trend / contradiction / richer comparison 尚缺 |
| Epic 8 | Monitoring and Recurring Intelligence | 65% | recurring baseline 已完成，且會關聯 research report；run-to-run diff/trend report 尚未完成 |
| Epic 9 | Reliability, Checkpointing, and Operations | 75% | queue/checkpoint/metrics/health 基線已具備；真正長時 recurring orchestration 還未完整打通 |

## Implemented Capability Snapshot

### 1. Skill Gateway

已完成：

- `research_topic`
- `crawl_domain`
- `monitor_topic`
- research task `get/list/resume`
- monitor task `get/list/rerun`

目前狀態：

- 已有 task-level API 形狀
- 已有 task persistence baseline
- 尚未做統一 task registry / cross-task orchestration model

### 2. Planning

已完成：

- topic-first request schema
- goal-aware query generation
- source type generation
- stop condition / quality threshold baseline

目前狀態：

- planner 可支援 `summary / compare / track / monitor / explore_domain`
- 尚未做 domain hypotheses、budget adaptation、host learning feedback loop

### 3. Discovery

已完成：

- search harvesting baseline
- monitor auto-watchlist generation via planner + search
- domain crawl baseline through `crawl_domain`

目前狀態：

- 研究主流程仍以 search-first 為主
- sitemap / domain expansion / feed discovery 尚未完整併入 `research_topic`

### 4. Retrieval

已完成：

- static fetch + browser fallback
- shell detection / retry classification
- proxy routing baseline
- session persistence / cookie jar baseline
- challenge / CAPTCHA detection baseline
- rate limiting / host policy memory baseline

目前狀態：

- 這是目前最成熟的系統層
- 真 Redis / proxy integration 仍需在可開 socket 的環境驗證

### 5. Extraction

已完成：

- normalized extracted document output
- structured extraction baseline
- site-specific extractors baseline

目前狀態：

- research documents 已可由 extraction pipeline 產生
- 更細的 structured field normalization 仍不足

### 6. Corpus

已完成：

- source ranking
- evidence scoring
- exact dedup baseline
- domain diversity boost

目前狀態：

- near-duplicate detection 尚未做
- spam / thin-content filtering 仍偏弱
- canonical clustering 尚未完成

### 7. Analysis and Reporting

已完成：

- executive summary baseline
- findings / evidence / confidence notes
- document clustering
- comparison row baseline
- citation packaging

目前狀態：

- 已從「搜尋結果摘要」提升到「document-based structured report」
- trend analysis / contradiction detection / stronger comparison output 尚未完成

### 8. Monitoring

已完成：

- recurring monitor task baseline
- task persistence
- planner/search-driven target refresh baseline
- monitor task 關聯 research report baseline

目前狀態：

- 已不只是 page diff，而是 recurring topic intelligence baseline
- 尚未有多次 run 之間的 trend / delta synthesis

### 9. Reliability / Ops

已完成：

- queue / retry / dead-letter baseline
- observability / metrics / health baseline
- cluster coordinator baseline
- browser ops 文件

目前狀態：

- 長時間自動 recurring research orchestration 還未完整驗證
- integration harness 已有，但受限於環境

## Recent Milestones

近期已完成並提交的里程碑：

- `e3762b3` Consolidate docs into canonical product specs
- `6a7f42a` Add research topic pipeline baseline
- `f99f442` Complete task-level research gateways and lifecycle
- `bb520a3` Add structured research analysis reports
- `e87abfd` Add recurring topic monitoring baseline
- `43fac01` Improve topic monitoring discovery planning
- `235bc87` Connect topic monitoring to research reports

## Main Gaps

1. **Research discovery depth**
   - `research_topic` 尚未完整吃到 sitemap / domain expansion / feed discovery
   - candidate frontier persistence 仍偏薄

2. **Corpus quality**
   - near-dedup 尚未完成
   - spam / thin-content filtering 不夠強
   - canonical clustering 尚未完成

3. **Reporting quality**
   - comparison 報告仍偏 baseline
   - trend / timeline / contradiction analysis 尚未完成
   - report 還沒有更產品化的 sectioning 與 delta synthesis

4. **Monitoring maturity**
   - monitor 雖已能關聯 research report
   - 但尚未形成 `new findings / persistent signals / dropped signals / trend changes` 的 run-to-run report

5. **Operations completeness**
   - 真 Redis / proxy integration 仍需在完整環境驗證
   - recurring orchestration 的 soak test 尚未完成

## Recommended Next Steps

> 詳細產品方向請見 PRD / SDD / User Stories。

### Current Priority

1. 補 `monitor_topic` 的 run-to-run diff / trend report
2. 強化 document-level corpus engine
3. 擴 comparison-oriented report generation
4. 把 sitemap / domain expansion 正式接進 `research_topic`
5. 補 recurring research orchestration 的長時驗證

### Later-phase Work

6. richer contradiction / agreement detection
7. stronger structured extraction normalization
8. recurring topic intelligence alerts / digests
9. multi-agent split

## Bottom Line

如果從新產品定義來看，專案已經跨過「只是 crawler」的階段，進入了可用的 research skill baseline。

但它還不是完成品。

最準確的描述是：

- **底層抓取與運維基礎已接近成熟**
- **上層 autonomous research product 層正在快速成形**
- **整體仍處於從 baseline 走向完整 research system 的中段**
