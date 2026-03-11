# OpenClaw Autonomous Web Research Skill — SDD

> Canonical technical design as of 2026-03-11.
> This document defines the target software design for the autonomous research system described in the PRD.

## 1. Scope

This design covers the end-to-end research system:

```text
Intent
  -> Planner
  -> Discovery
  -> Retrieval
  -> Extraction
  -> Corpus Processing
  -> Analysis
  -> Report
```

The system remains Node.js + TypeScript based and keeps the existing retrieval/crawl foundations, but re-centers them inside a research orchestration architecture.

## 2. Architecture Overview

### 2.1 High-level Modules

1. `Skill Gateway`
   - entrypoint for OpenClaw skill invocations
   - validates task schema
   - creates task IDs
   - reports progress and status

2. `Planner`
   - turns natural-language topics into executable research plans
   - generates queries, source hypotheses, budgets, and stop conditions

3. `Discovery Engine`
   - collects candidate URLs from search, sitemap, domain expansion, and crawl

4. `Retrieval Engine`
   - fetches pages with static/browser/proxy/session/challenge handling

5. `Extraction Engine`
   - produces normalized research-ready documents

6. `Corpus Engine`
   - deduplicates, clusters, ranks, and filters retrieved documents

7. `Analysis Engine`
   - generates summaries, comparisons, trends, evidence sets, and report outputs

8. `Storage / Queue / Monitoring`
   - supports long-running operation, retries, checkpoints, metrics, and recurring jobs

## 3. Layer Responsibilities

### 3.1 Skill Gateway

Public tool surface:

- `research_topic`
- `crawl_domain`
- `monitor_topic`

Responsibilities:

- schema validation
- task creation
- status updates
- task cancellation and resume
- result packaging for OpenClaw

### 3.2 Planner

Inputs:

- topic
- goal
- time range
- region
- language
- source preferences
- runtime/page budget

Outputs:

- query list
- source strategy
- crawl targets
- stop conditions
- ranking hints

Planner subfunctions:

- query generation
- domain hypothesis generation
- source type selection
- budget planning
- plan normalization

### 3.3 Discovery Engine

Sources:

- search results
- sitemaps
- BFS/DFS crawl seeds
- tag/category/index pages
- RSS/news feeds
- domain expansion heuristics

Core responsibilities:

- candidate URL collection
- normalization
- priority scoring
- domain clustering
- frontier persistence

### 3.4 Retrieval Engine

Core responsibilities:

- static fetch first
- shell detection
- browser fallback
- proxy selection
- session reuse
- challenge classification
- rate limiting
- retry policy
- cache / revalidation

Design rule:

> Prefer the lowest-cost path that still produces usable content.

### 3.5 Extraction Engine

Output contract for normalized documents:

- URL
- canonical URL
- source domain
- title
- main text
- markdown
- metadata
- structured fields
- confidence
- source quality
- outbound links
- fetch metadata
- timestamps

Optional enrichments:

- FAQ extraction
- price/spec extraction
- table extraction
- entity hints
- review sentiment hints

### 3.6 Corpus Engine

Mandatory responsibilities:

- exact dedup
- near dedup
- canonical clustering
- topical relevance scoring
- spam / thin content filtering
- source quality ranking
- domain diversity control

Output:

- normalized corpus
- cluster metadata
- dedup statistics
- relevance-ranked evidence candidates

### 3.7 Analysis Engine

Intermediate processing:

- chunking
- topical clustering
- entity aggregation
- timeline extraction
- contradiction detection
- agreement / disagreement analysis
- evidence selection

Final outputs:

- executive summary
- findings list
- comparison tables
- timeline or trend synthesis
- evidence snippets
- confidence notes
- citations

## 4. Canonical Data Model

### 4.1 Research Task

`ResearchTask`

- `taskId`
- `taskType` (`research_topic`, `crawl_domain`, `monitor_topic`)
- `status`
- `input`
- `createdAt`
- `updatedAt`
- `startedAt`
- `completedAt`
- `checkpoint`
- `budget`
- `resultRef`
- `error`

### 4.2 Research Plan

`ResearchPlan`

- `planId`
- `taskId`
- `goal`
- `queries`
- `timeRange`
- `region`
- `language`
- `sourceTypes`
- `domainHypotheses`
- `stopConditions`
- `qualityThresholds`

### 4.3 Candidate URL

`CandidateUrl`

- `taskId`
- `url`
- `normalizedUrl`
- `source`
- `sourceQuery`
- `domain`
- `discoveredAt`
- `priorityScore`
- `discoveryReason`
- `status`

### 4.4 Retrieved Page

`RetrievedPage`

- `taskId`
- `url`
- `finalUrl`
- `fetchStrategy`
- `statusCode`
- `proxyId`
- `sessionId`
- `challengeType`
- `retryCount`
- `fetchedAt`
- `rawContentRef`

### 4.5 Extracted Document

`ResearchDocument`

- `docId`
- `taskId`
- `url`
- `canonicalUrl`
- `domain`
- `title`
- `text`
- `markdown`
- `metadata`
- `structured`
- `language`
- `contentType`
- `qualityScore`
- `confidence`
- `clusterId`
- `fingerprints`
- `evidenceScore`

### 4.6 Report

`ResearchReport`

- `reportId`
- `taskId`
- `summary`
- `findings`
- `comparisons`
- `timeline`
- `evidence`
- `sourceCoverage`
- `confidenceNotes`
- `generatedAt`

## 5. Task State Machine

Canonical states:

- `pending`
- `planning`
- `discovering`
- `fetching`
- `extracting`
- `processing_corpus`
- `analyzing`
- `reporting`
- `completed`
- `failed`
- `partial`

Transition rules:

1. Every transition must be persisted.
2. Every stage must emit checkpoint metadata.
3. Failed tasks must either retry the stage or move to `partial` / `failed`.
4. Long-running tasks must be resumable from the last durable checkpoint.

## 6. Checkpoint and Resume Design

### 6.1 Checkpoint Contents

Each task checkpoint should store:

- current stage
- completed URL set
- pending frontier
- per-domain rate-limit state where applicable
- fetched page references
- extracted document references
- dedup fingerprints
- partial analysis outputs

### 6.2 Resume Rules

- re-run only incomplete work
- do not lose evidence already collected
- preserve retry budget and per-host history
- preserve partial analysis outputs if still valid

## 7. Budget and Guardrail Model

### 7.1 Budget Dimensions

- `maxPages`
- `maxDomains`
- `maxRuntimeMinutes`
- `maxBrowserRenders`
- `maxRetriesPerHost`
- `maxAnalysisTokens`

### 7.2 Stop Conditions

Examples:

- enough high-quality evidence collected
- budget exhausted
- time exhausted
- discovery quality dropped below threshold
- too many duplicate/low-value pages

## 8. Tool and API Schema Direction

### 8.1 `research_topic`

Request:

- `topic`
- `goal`
- `timeRange`
- `region`
- `language`
- `sourcePreferences`
- `freshness`
- `maxBudgetPages`
- `maxRuntimeMinutes`
- `outputFormat`

Response:

- `taskId`
- `status`
- `summary`
- `findings`
- `sources`
- `evidence`
- `confidenceNotes`
- `stats`

### 8.2 `crawl_domain`

Request:

- `domain`
- `goal`
- `patterns`
- `depth`
- `maxPages`

Response:

- `taskId`
- `mappedUrls`
- `categorizedUrls`
- `recommendedTargets`
- `stats`

### 8.3 `monitor_topic`

Request:

- `topic`
- `watchDomains`
- `queryTemplates`
- `schedule`
- `diffMode`

Response:

- `taskId`
- `status`
- `newFindings`
- `changedPages`
- `alerts`
- `updatedSummary`

## 9. Operational Design

### 9.1 Queueing

Every research task is a queue-backed job.

Required features:

- retries
- visibility timeout
- DLQ
- heartbeat
- reclaim
- progress metadata

### 9.2 Observability

Required telemetry:

- stage duration
- fetch success rate
- browser fallback rate
- anti-bot hit rate
- challenge rate
- duplicate ratio
- source diversity
- report generation latency

### 9.3 Monitoring

The system should support:

- recurring task schedules
- changed corpus alerts
- domain watch and topic watch
- task health dashboards

## 10. Module Mapping to Repo

Near-term module mapping:

- `src/skill/*` or equivalent
  - gateway adapters
  - task schemas
- `src/planner/*`
  - plan generation
  - query expansion
- `src/discovery/*`
  - search harvesting
  - sitemap/domain expansion
- existing retrieval modules remain under `src/fetch`, `src/proxy`, `src/ratelimit`, `src/anti-bot`
- existing extraction modules remain under `src/extract`, `src/engines/extract`
- `src/corpus/*`
  - dedup
  - ranking
  - clustering
- `src/analysis/*`
  - report synthesis
  - evidence packaging

## 11. Design Risks

1. Over-investing in retrieval while under-building planning/corpus/report layers.
2. Letting the top-level API leak low-level crawler parameters.
3. Running long tasks without durable checkpoints.
4. Sending noisy, duplicate corpora into analysis.
5. Treating observability as optional instead of required system behavior.

## 12. Canonical Design Decision

The system should be designed as:

> `Autonomous web research infrastructure for OpenClaw`

The crawler remains an important subsystem, but it is no longer the system boundary.
