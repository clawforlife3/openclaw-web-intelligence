# OpenClaw Autonomous Web Research Skill — Current State

> Snapshot date: 2026-03-11
> Canonical product/spec documents:
> - [openclaw-web-intelligence-prd.md](./openclaw-web-intelligence-prd.md)
> - [openclaw-web-intelligence-sdd.md](./openclaw-web-intelligence-sdd.md)
> - [openclaw-web-intelligence-user-stories.md](./openclaw-web-intelligence-user-stories.md)

## Executive Summary

專案目前應被視為：

- 底層 `retrieval / crawl / anti-bot / queue / observability` 基礎已相對成熟
- 上層 `autonomous research orchestration` 已有可用的 single-agent baseline
- 產品已從 `web crawler gateway` 轉向 `OpenClaw autonomous web research skill`

目前已落地的主線能力：

- `research_topic` task-level gateway baseline
- `crawl_domain` task-level gateway baseline
- `monitor_topic` recurring baseline
- topic planner / query generation baseline
- search-driven discovery + promising domain expansion baseline
- extraction-backed normalized research documents
- corpus scoring / near-dedup / thin filtering / domain diversity baseline
- structured research analysis reports + coverage/trend signals
- monitor-to-research orchestration + run history/trend baseline
- research task persistence / resume baseline

## Completion Estimate

### New Product Definition

若依據最新 `PRD / SDD / User Stories` 的產品範圍評估：

- **Autonomous Web Research Skill 整體完成度：約 65%–75%**
- 建議對外溝通時以 **約 70%** 作為目前整體進度

### Split View

- **底層 Web Intelligence / Retrieval Infrastructure：約 85%–95%**
- **上層 Autonomous Research Skill Productization：約 65%–75%**

> 先前文件中的 `95%–98%` 比較接近底層 crawler / retrieval hardening，不適合作為目前產品整體完成度。

## Progress by Epic

| Epic | Scope | Estimated Progress | Current State |
|------|-------|--------------------|---------------|
| Epic 1 | Skill Gateway and Task Lifecycle | 82% | `research_topic` / `crawl_domain` / `monitor_topic` 已有 baseline，含 `get/list/resume/rerun` |
| Epic 2 | Planning and Query Generation | 72% | planner 已能依 topic/goal 產生 queries、source types、stop conditions |
| Epic 3 | Discovery and Candidate URL Collection | 70% | 已有 search harvesting，`research_topic` 已接 promising domain expansion 與 sitemap-aware map baseline |
| Epic 4 | Retrieval and Fetch Strategy | 85% | static/browser/proxy/session/challenge/rate limit 基礎已相對完整 |
| Epic 5 | Extraction and Document Normalization | 72% | 已產出 normalized research documents，但 research-first schema normalization 尚未完全深化 |
| Epic 6 | Corpus Processing | 70% | 已有 exact dedup / near-dedup / thin-content filtering / diversity baseline；canonical clustering 仍不足 |
| Epic 7 | Analysis and Reporting | 72% | 已有 structured report / coverage / trend signals / comparison baseline；contradiction 與更深 timeline 尚缺 |
| Epic 8 | Monitoring and Recurring Intelligence | 75% | recurring baseline、run history、run-to-run diff/trend report、關聯 research report 已完成 |
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
- `research_topic` promising domain expansion + sitemap-aware map baseline

目前狀態：

- 研究主流程仍以 search-first 為主，但已可擴展進高價值 domain
- feed discovery 尚未完整併入 `research_topic`

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
- near-dedup baseline
- thin-content filtering baseline
- domain diversity boost

目前狀態：

- spam filtering 仍偏弱
- canonical clustering 尚未完成

### 7. Analysis and Reporting

已完成：

- executive summary baseline
- coverage summary baseline
- findings / evidence / confidence notes
- document clustering
- comparison row baseline
- trend signal baseline
- citation packaging

目前狀態：

- 已從「搜尋結果摘要」提升到「document-based structured report」
- contradiction detection / stronger comparison output / deeper timeline synthesis 尚未完成

### 8. Monitoring

已完成：

- recurring monitor task baseline
- task persistence
- planner/search-driven target refresh baseline
- monitor task 關聯 research report baseline
- run history + new/persistent/dropped signal reporting baseline

目前狀態：

- 已不只是 page diff，而是 recurring topic intelligence baseline
- 尚缺更產品化的 digest / alert packaging

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
- `f24ba4c` Add monitoring trend and run history reporting
- `651a603` Strengthen single-agent research discovery and reporting

## Main Gaps

1. **Research discovery depth**
   - `research_topic` 已接入 promising domain expansion，但仍未完整吃到 feed discovery
   - candidate frontier persistence 仍偏薄

2. **Corpus quality**
   - spam / thin-content filtering 仍需更強品質訊號
   - canonical clustering 尚未完成

3. **Reporting quality**
   - comparison 報告已可用，但仍偏 baseline
   - contradiction / deeper timeline analysis 尚未完成
   - report 還缺更產品化的 digest / sectioning

4. **Monitoring maturity**
   - monitor 已形成 `new findings / persistent signals / dropped signals` baseline
   - 尚未形成更高階的 digest / alert routing

5. **Operations completeness**
   - 真 Redis / proxy integration 仍需在完整環境驗證
   - recurring orchestration 的 soak test 尚未完成

## Recommended Next Steps

> 詳細產品方向請見 PRD / SDD / User Stories。

### Current Priority

1. richer contradiction / agreement detection
2. stronger structured extraction normalization
3. recurring topic intelligence alerts / digests
4. recurring research orchestration 的長時驗證
5. 統一 task registry / cross-task orchestration model

### Later-phase Work

6. multi-agent split

## Bottom Line

如果從新產品定義來看，專案已經跨過「只是 crawler」的階段，進入了可用的 single-agent research skill baseline。

它仍然不是完成品，但在 multi-agent 之前最重要的單代理主路徑已經大致成形。

最準確的描述是：

- **底層抓取與運維基礎已接近成熟**
- **上層 autonomous research product 層已進入 pre-multi-agent 階段**
- **整體已從 baseline 邁向可持續擴展的 research system**
