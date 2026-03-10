# OpenClaw Web Intelligence Gateway — Implementation Plan

> Goal: turn PRD + SDD + User Stories + API Spec into an executable engineering plan.

---

# 1. Executive Summary

## 1.1 Strategy

建議採用 **4 週 MVP 實作節奏**，先交付高價值且低複雜度的核心：

1. schemas / foundations
2. HTTP extract
3. search integration
4. map / crawl
5. storage / cache / observability
6. OpenClaw integration
7. monitor / diff

### 核心原則
- 先靜態 HTTP path，後 browser path
- 先 contract，後 engine
- 先 bounded crawl，後 advanced scaling
- 先 debugability，後花俏功能

---

# 2. Delivery Scope

## MVP Deliverables
- unified schemas and validators
- HTTP extractor
- search adapter
- map/crawl engine
- SQLite + filesystem artifacts
- cache
- structured logs + basic metrics
- OpenClaw-facing adapter
- basic monitor/diff
- docs + examples

## Deferred
- browser executor
- login session support
- screenshot/download flows
- distributed workers
- multi-provider ranking fusion

---

# 3. Workstreams

## Workstream A — Foundations
**Outputs**
- repo setup
- TypeScript config
- schemas
- validators
- error model

## Workstream B — Retrieval Engines
**Outputs**
- search engine adapter
- HTTP extractor
- crawler engine

## Workstream C — Data & Infra
**Outputs**
- SQLite schema
- artifacts directory management
- cache service
- observability

## Workstream D — OpenClaw Integration
**Outputs**
- adapter interface
- usage docs
- examples
- monitor workflow integration

---

# 4. Week-by-Week Plan

## Week 1 — Foundations + Extract Core

### Objectives
- lock contracts
- create project skeleton
- deliver extract happy path

### Tasks
- [ ] initialize project structure
- [ ] define TypeScript types from API spec
- [ ] implement validators
- [ ] implement error classes and mapper
- [ ] implement request context / trace id plumbing
- [ ] implement HTTP fetch wrapper
- [ ] implement HTML parsing
- [ ] implement markdown normalization
- [ ] implement metadata extraction
- [ ] implement link extraction
- [ ] add unit tests for URL and schema validation

### Exit Criteria
- extract operation works on 5 representative static pages
- response matches v1 schema
- failures return typed errors

## Week 2 — Search + Storage + Cache

### Objectives
- enable search workflows
- persist artifacts and add reuse

### Tasks
- [ ] integrate first search provider
- [ ] normalize search results
- [ ] implement include/exclude domains
- [ ] create SQLite schema
- [ ] persist request logs and page artifacts
- [ ] implement filesystem artifact writer
- [ ] implement cache service
- [ ] add structured logs
- [ ] add metrics for extract/search/cache
- [ ] integration test for search->extract flow

### Exit Criteria
- search works with normalized results
- extract results are stored and cacheable
- logs and metrics show request lifecycle

## Week 3 — Map / Crawl + Safety

### Objectives
- support bounded docs/help-center crawling safely

### Tasks
- [ ] implement frontier queue
- [ ] implement URL normalization / dedupe
- [ ] implement scope evaluator
- [ ] implement map mode
- [ ] implement crawl mode
- [ ] implement crawl report summary
- [ ] implement robots policy evaluator
- [ ] implement domain allowlist / denylist
- [ ] implement log redaction for PII/token-like values
- [ ] add integration tests for docs-site crawling

### Exit Criteria
- can map and crawl bounded scope with limits
- denied URLs fail safely
- crawl report is persisted

## Week 4 — OpenClaw Integration + Monitor/Diff + Hardening

### Objectives
- expose usable MVP to OpenClaw workflows
- add recurring monitoring
- document and stabilize

### Tasks
- [ ] implement OpenClaw-facing adapter methods
- [ ] create examples for research/docs monitoring use cases
- [ ] implement monitor job schema
- [ ] implement baseline snapshot compare
- [ ] implement no-change suppression
- [ ] implement cooldown logic
- [ ] add end-to-end tests for monitor flow
- [ ] write operations documentation
- [ ] performance pass on hot paths
- [ ] release checklist / smoke tests

### Exit Criteria
- OpenClaw adapter can call search/extract/map/crawl
- monitor job can detect meaningful page change
- docs are sufficient for internal use

---

# 5. Dependency Graph

```mermaid
flowchart TD
    A[Schemas & Validators] --> B[Extractor]
    A --> C[Search Adapter]
    A --> D[Crawler Engine]
    A --> E[Storage]

    B --> D
    B --> F[Monitor/Diff]
    E --> F
    C --> G[OpenClaw Adapter]
    B --> G
    D --> G
    F --> G
```

---

# 6. Suggested Task Ordering for Agents / Engineers

## Lane 1 — Contract & Core
- types
- validators
- errors
- request context

## Lane 2 — Extract
- fetch wrapper
- parser
- markdown normalization
- metadata / links

## Lane 3 — Search
- provider adapter
- ranking / dedupe
- search pipeline tests

## Lane 4 — Crawl
- queue
- URL normalization
- scope rules
- crawl report

## Lane 5 — Persistence / Ops
- SQLite
- cache
- logging
- metrics

## Lane 6 — Integration
- OpenClaw adapter
- monitor jobs
- docs/examples

---

# 7. Acceptance Milestones

## Milestone A — Static Retrieval Ready
**Definition**
- extract stable
- schema stable
- basic tests pass

## Milestone B — Research Pipeline Ready
**Definition**
- search + extract end-to-end works
- cache and logs active

## Milestone C — Docs Indexing Ready
**Definition**
- map/crawl bounded docs site
- crawl summary works
- safety controls active

## Milestone D — OpenClaw MVP Ready
**Definition**
- adapter integrated
- monitor/diff basic workflow works
- documentation ready

---

# 8. Risk Register

## Risk 1 — Extract quality too inconsistent
**Mitigation**
- add golden tests for representative sites
- preserve raw artifacts for debugging

## Risk 2 — Crawl complexity expands too quickly
**Mitigation**
- enforce strict MVP limits
- focus on docs/blog/help-center first

## Risk 3 — Schema churn delays implementation
**Mitigation**
- lock API spec before engine expansion
- avoid ad hoc field additions

## Risk 4 — Too much effort spent on browser early
**Mitigation**
- explicitly defer browser executor to post-MVP

## Risk 5 — Monitoring generates noisy alerts
**Mitigation**
- start with hash + field diff
- add cooldown and suppression from day one

---

# 9. Definition of Done (MVP)

A story / module is done only if:

- code implemented
- schema validated
- tests added or updated
- logs/errors observable
- docs updated when interface changed
- no unbounded crawl behavior introduced

---

# 10. Recommended Immediate Next Steps

## Option A — Start coding directly
Use this order:
1. create project skeleton
2. implement schemas and validators
3. implement extractor

## Option B — Delegate via coding agents
Prepare these inputs first:
- PRD
- SDD
- API Spec
- this Implementation Plan
- clear lane assignment per agent

## Option C — Create Jira first
Use `openclaw-web-intelligence-user-stories.md` to generate stories and tasks by epic.

---

# 11. Final Recommendation

如果你要最快進入「可實作」狀態，下一步不是再寫更多概念文件，而是：

1. 建專案骨架
2. 鎖 schema
3. 開始做 extractor

因為 extractor 是整個系統的地基；search、crawl、monitor 最後都會回到 extract output quality。