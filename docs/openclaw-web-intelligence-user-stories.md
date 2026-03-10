# OpenClaw Web Intelligence Gateway — User Stories & Epics

> This document includes both **Epics** and **User Stories** to avoid over-splitting files in the early implementation phase.

---

# 1. Executive Summary

本文件將 PRD 與 SDD 轉成可執行 backlog，方便：

- 建立 Jira / Linear tickets
- 排 sprint
- 分派給 agent / 工程師
- 做 MVP scope control

---

# 2. Epic Overview

## Epic 1 — Platform Foundations
建立專案骨架、schema、錯誤模型、設定與基礎模組。

## Epic 2 — Search & Source Discovery
提供搜尋能力與來源正規化。

## Epic 3 — Extract & Normalization
提供單頁抽取、內容清洗與統一輸出。

## Epic 4 — Map & Crawl Engine
提供網站探索與有限範圍 crawl。

## Epic 5 — Storage, Cache & Observability
提供持久化、快取與基礎可觀測性。

## Epic 6 — Safety & Guardrails
提供 domain policy、robots、PII redaction、風險控制。

## Epic 7 — OpenClaw Integration
把能力包成 OpenClaw 可直接調用的介面。

## Epic 8 — Monitor & Diff
提供網站變更監控與通知。

## Epic 9 — Post-MVP Browser Interaction
提供登入、點擊、輸入、等待、下載等互動式流程。

---

# 3. User Stories by Epic

## Epic 1 — Platform Foundations

### Story 1.1 — Define core response schema
**As a** developer  
**I want** all operations to return a unified schema  
**So that** downstream agents and workflows can consume results consistently.

**Acceptance Criteria**
- search / extract / map / crawl response schema are documented
- all schemas are versioned
- validation failure returns explicit error object

### Story 1.2 — Define error taxonomy
**As a** developer  
**I want** a standard error model  
**So that** retries, logs, and alerts behave predictably.

**Acceptance Criteria**
- retryable vs non-retryable errors are identified
- all error codes are documented
- adapter maps internal errors to external response shape

### Story 1.3 — Bootstrap project structure
**As a** developer  
**I want** a modular codebase skeleton  
**So that** teams can build engines independently.

**Acceptance Criteria**
- repo folder structure matches SDD
- modules compile in TypeScript
- lint/test baseline passes

---

## Epic 2 — Search & Source Discovery

### Story 2.1 — Integrate initial search provider
**As an** OpenClaw user  
**I want** to search the web from one interface  
**So that** research tasks start with quality sources.

**Acceptance Criteria**
- query input returns normalized result list
- provider timeouts are handled
- results include title, url, snippet, rank

### Story 2.2 — Support include/exclude domains
**As a** researcher  
**I want** to constrain domains  
**So that** I can limit results to trusted or target sources.

**Acceptance Criteria**
- include_domains works
- exclude_domains works
- invalid domain filters fail validation

### Story 2.3 — Result dedupe and ranking
**As a** user  
**I want** duplicate search hits removed  
**So that** results are cleaner and cheaper to process.

**Acceptance Criteria**
- duplicate URLs collapse deterministically
- canonical-equivalent results are merged when possible
- score/rank field is preserved

### Story 2.4 — Search-to-extract pipeline
**As an** OpenClaw agent  
**I want** to search and immediately extract top results  
**So that** research workflows require fewer separate calls.

**Acceptance Criteria**
- search results can trigger optional extract pipeline
- extracted results preserve original search ranking context
- pipeline can cap number of extracted URLs

---

## Epic 3 — Extract & Normalization

### Story 3.1 — Fetch and parse static pages
**As a** developer  
**I want** to fetch HTML and parse content  
**So that** static pages can be extracted cheaply.

**Acceptance Criteria**
- supports text/html and basic JSON pages
- redirects are tracked
- non-supported content types return explicit error or fallback metadata

### Story 3.2 — Extract main content
**As an** agent  
**I want** the main page content instead of noisy boilerplate  
**So that** downstream reasoning is cleaner.

**Acceptance Criteria**
- title extracted when available
- main body is cleaner than raw HTML dump
- nav/footer noise reduced for common docs/blog pages

### Story 3.3 — Normalize to markdown
**As an** OpenClaw workflow  
**I want** extracted content in markdown  
**So that** it is token-efficient and readable.

**Acceptance Criteria**
- headings, links, lists preserved reasonably
- empty markdown is flagged
- markdown path stored in artifacts when persistence enabled

### Story 3.4 — Extract metadata and links
**As a** user  
**I want** metadata and discovered links  
**So that** I can assess source quality and expand crawl scope.

**Acceptance Criteria**
- metadata includes title, canonical, description when available
- links array is returned
- internal/external link classification available in normalized form

### Story 3.5 — Structured extraction v1
**As a** workflow builder  
**I want** a place for structured fields  
**So that** targeted data like price or publish date can be captured.

**Acceptance Criteria**
- structured object present in schema
- basic field extraction supported for common fields
- missing fields do not fail the request

---

## Epic 4 — Map & Crawl Engine

### Story 4.1 — Map a site
**As a** user  
**I want** to discover site URLs without extracting all pages  
**So that** I can inspect scope before a crawl.

**Acceptance Criteria**
- map returns URL list
- max_depth and limit enforced
- off-scope URLs excluded

### Story 4.2 — Normalize and dedupe URLs
**As a** crawler engine  
**I want** canonical URL handling  
**So that** duplicate fetches are minimized.

**Acceptance Criteria**
- trailing slash normalization documented
- fragment removal handled
- duplicate enqueue prevented

### Story 4.3 — Crawl limited site scope
**As a** user  
**I want** to crawl a domain/path with limits  
**So that** I can collect a bounded dataset safely.

**Acceptance Criteria**
- depth / breadth / page limit enforced
- discovered pages stored in crawl report
- crawl stops cleanly on reaching limits

### Story 4.4 — Honor robots policy
**As an** operator  
**I want** configurable robots handling  
**So that** crawling behavior follows deployment policy.

**Acceptance Criteria**
- strict / balanced / off modes exist
- robots-denied pages are logged
- policy mode is visible in request metadata

### Story 4.5 — Crawl report generation
**As a** user  
**I want** a crawl summary  
**So that** I can understand what happened without reading every page result.

**Acceptance Criteria**
- report includes pages visited, pages skipped, errors, discovered links count
- report includes stop reason
- report is persisted when storage is enabled

---

## Epic 5 — Storage, Cache & Observability

### Story 5.1 — Persist page artifacts
**As a** developer  
**I want** raw and normalized outputs saved  
**So that** failed or surprising extractions can be debugged.

**Acceptance Criteria**
- raw artifact path stored
- normalized markdown/text path stored
- metadata persisted in SQLite

### Story 5.2 — Add cache for extract/search
**As a** system operator  
**I want** repeat requests to hit cache  
**So that** latency and cost are reduced.

**Acceptance Criteria**
- cache lookup happens before external execution
- cache hit metadata returned
- TTL configurable by operation

### Story 5.3 — Structured logs
**As a** maintainer  
**I want** structured logs for requests/jobs  
**So that** failures are traceable.

**Acceptance Criteria**
- trace id included
- operation type included
- status / latency / retries logged

### Story 5.4 — Basic metrics
**As an** operator  
**I want** key service metrics  
**So that** I can monitor system health.

**Acceptance Criteria**
- success rate measurable
- retry count measurable
- cache hit rate measurable
- latency by operation measurable

---

## Epic 6 — Safety & Guardrails

### Story 6.1 — Domain allow/deny policies
**As an** operator  
**I want** to control allowed targets  
**So that** scraping stays within intended boundaries.

**Acceptance Criteria**
- allowlist mode supported
- denylist supported
- denied requests return explicit error

### Story 6.2 — PII redaction in logs
**As an** operator  
**I want** sensitive values removed from logs  
**So that** diagnostics do not leak secrets.

**Acceptance Criteria**
- email / phone / token-like strings redacted in logs
- raw artifacts are not emitted into logs
- redaction behavior documented

### Story 6.3 — Untrusted content annotations
**As an** agent integrator  
**I want** extracted web content marked untrusted  
**So that** prompt injection risk is reduced.

**Acceptance Criteria**
- response metadata can mark content as untrusted
- suspicious prompt-like fragments may be annotated
- annotations do not corrupt normal extraction output

---

## Epic 7 — OpenClaw Integration

### Story 7.1 — Expose search/extract/map/crawl through OpenClaw-facing interface
**As an** OpenClaw agent  
**I want** a stable interface  
**So that** I can use the gateway without custom wrappers per flow.

**Acceptance Criteria**
- adapter methods exist for MVP operations
- input validation occurs before execution
- errors are returned in consistent schema

### Story 7.2 — Document usage contract
**As a** workflow builder  
**I want** examples and usage guidance  
**So that** I can apply the tool correctly.

**Acceptance Criteria**
- examples for research, docs indexing, monitoring exist
- operation selection guidance exists
- common pitfalls documented

### Story 7.3 — Integrate with cron/webhook flows
**As a** user  
**I want** scheduled or event-driven runs  
**So that** the tool supports automation, not just one-off retrieval.

**Acceptance Criteria**
- monitor jobs can be triggered by scheduler/webhook
- outputs can be formatted for downstream notification flows
- run records are persisted

---

## Epic 8 — Monitor & Diff

### Story 8.1 — Create monitor jobs
**As a** user  
**I want** to define recurring checks on targets  
**So that** I can track changes over time.

**Acceptance Criteria**
- monitor job schema defined
- schedule and diff policy configurable
- job can target page or crawl scope

### Story 8.2 — Compare against baseline
**As a** monitoring workflow  
**I want** to compare current and previous states  
**So that** only meaningful changes surface.

**Acceptance Criteria**
- content hash diff supported
- field diff supported for selected fields
- no-change runs do not trigger alerts

### Story 8.3 — Cooldown and dedupe alerts
**As a** user  
**I want** repeated identical changes suppressed  
**So that** I am not spammed.

**Acceptance Criteria**
- cooldown window configurable
- duplicate same-state alerts suppressed
- alert reason visible in metadata

---

## Epic 9 — Post-MVP Browser Interaction

### Story 9.1 — Execute scripted browser actions
**As a** workflow builder  
**I want** to run click/type/wait/scroll actions  
**So that** JS-heavy pages become extractable.

### Story 9.2 — Isolate browser sessions
**As an** operator  
**I want** session isolation  
**So that** cookies and credentials do not bleed across jobs.

### Story 9.3 — Capture artifacts on failure
**As a** maintainer  
**I want** screenshots and HTML snapshots on browser failure  
**So that** broken flows are debuggable.

---

# 4. MVP Sprint Recommendation

## Sprint 1
- Epic 1
- Story 3.1, 3.2, 3.3, 3.4

## Sprint 2
- Epic 2
- Story 5.1, 5.2, 5.3

## Sprint 3
- Epic 4
- Story 6.1, 6.2, 6.3

## Sprint 4
- Epic 7
- Story 8.1, 8.2, 8.3

---

# 5. Story Prioritization

## Must Have (MVP)
- 1.1, 1.2, 1.3
- 2.1, 2.2, 2.3
- 3.1, 3.2, 3.3, 3.4
- 4.1, 4.2, 4.3, 4.4, 4.5
- 5.1, 5.2, 5.3, 5.4
- 6.1, 6.2, 6.3
- 7.1, 7.2
- 8.1, 8.2

## Should Have
- 2.4
- 3.5
- 7.3
- 8.3

## Could Have
- Epic 9 all stories

---

# 6. Final Note

這份 backlog 已經足夠直接轉進 Jira / Linear。若下一步要丟給 coding agent 實作，建議再搭配：

- `openclaw-web-intelligence-api-spec.md`
- `openclaw-web-intelligence-implementation-plan.md`

一起使用。