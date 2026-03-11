# OpenClaw Autonomous Web Research Skill — PRD

> Canonical product document as of 2026-03-11.
> This replaces older "web crawler gateway" framing as the primary product definition.

## 1. Product Summary

### 1.1 One-line Definition

`openclaw-web-intelligence` is not just a crawler. It is the **autonomous web research infrastructure and skill layer for OpenClaw**.

Its job is to take a natural-language research intent and turn it into:

```text
Topic
  -> Research Plan
  -> Web Discovery
  -> Fetch / Render
  -> Extraction
  -> Dedup / Rank
  -> Analysis
  -> Evidence-backed Report
```

### 1.2 Problem Statement

Current crawler-style tools are insufficient for the actual OpenClaw use case:

- users provide a topic, not a URL
- the agent must choose search and crawl strategy autonomously
- the system must run for long periods with checkpoints and recovery
- the output must be a usable research result, not raw pages
- the top-level interface must feel like a skill, not a low-level scraping API

### 1.3 Product Positioning

This system is a:

- research planner
- web discovery orchestrator
- retrieval engine
- extraction engine
- corpus processing engine
- analysis and reporting pipeline

It is **not** primarily a generic browser automation tool, nor a generic large-scale scraping platform.

## 2. Target User Jobs

Users ask for research goals such as:

- "幫我研究台灣近三年 AI SEO 工具市場"
- "追蹤某品牌最近的負評與社群討論"
- "蒐集英國 CS conversion 碩士資訊並比較"

The system must translate that into machine-executable research work.

Primary user jobs:

1. Explore a topic and summarize the landscape.
2. Collect and compare options, products, or institutions.
3. Track a topic, brand, or market over time.
4. Deep-crawl a target domain for focused analysis.
5. Produce evidence-backed findings with source coverage and confidence notes.

## 3. Product Goals

### 3.1 Core Goals

1. Accept natural-language research requests as the primary input.
2. Autonomously plan queries, sources, budgets, and stop conditions.
3. Collect broad, high-quality web evidence with robust retrieval behavior.
4. Build a clean research corpus through dedup, filtering, and ranking.
5. Produce structured, evidence-backed outputs useful to OpenClaw agents and end users.
6. Support long-running, resumable, observable research jobs.

### 3.2 Non-goals

- Full browser RPA for clicks/forms/login-heavy workflows.
- Massive generic internet indexing at search-engine scale.
- Arbitrary CAPTCHA solving as a first-class built-in capability.
- Replacing every low-level web tool in the stack.

## 4. Product Principles

1. `Intent-first`: external interfaces express research intent, not crawler parameters.
2. `Evidence over volume`: better corpus quality beats raw page count.
3. `Cheap path first`: prefer low-cost retrieval before escalating to browser/proxy/session paths.
4. `Recoverable by default`: long jobs must checkpoint and resume.
5. `Traceable outputs`: reports should be backed by sources, evidence snippets, and confidence notes.
6. `Operationally sane`: queueing, retries, budgets, metrics, and DLQ are product requirements, not infra afterthoughts.

## 5. Primary Product Surface

The top-level skill interface should expose task-level capabilities, not only low-level utilities.

### 5.1 `research_topic`

Primary entrypoint for most users.

Input:

- `topic`
- `goal`
- `time_range`
- `region`
- `language`
- `source_preferences`
- `freshness`
- `max_budget_pages`
- `max_runtime_minutes`
- `output_format`

Output:

- research summary
- structured findings
- collected sources
- evidence snippets
- confidence notes
- execution stats

### 5.2 `crawl_domain`

Focused domain exploration for engineering or analyst workflows.

Input:

- `domain`
- `goal`
- `patterns`
- `depth`
- `max_pages`

Output:

- mapped URLs
- categorized URLs
- recommended extraction targets
- crawl stats

### 5.3 `monitor_topic`

Persistent monitoring for recurring intelligence work.

Input:

- `topic`
- `watch_domains`
- `query_templates`
- `schedule`
- `diff_mode`

Output:

- new findings
- changed pages
- alerts
- updated summary

### 5.4 Internal-but-important Capability

`collect_corpus` may remain an internal orchestration primitive or an advanced tool.

Input:

- `queries`
- `domains`
- `source_types`
- `max_docs`

Output:

- normalized document set
- dedup stats
- relevance scores

## 6. End-to-end Product Flow

### 6.1 Planning

The system converts a user topic into:

- query strategy
- seed keywords
- target source types
- domain hypotheses
- crawl depth and budget
- stop conditions
- quality thresholds

Example:

```text
User intent:
  研究台灣中小企業在用哪些 CRM

Planner output:
  queries:
    - 台灣 CRM 中小企業
    - 台灣 CRM 導入案例
    - 台灣 CRM 比較
    - 台灣 客戶關係管理 軟體 推薦
  source types:
    - SaaS 官網
    - 媒體評測
    - 比較文
    - 論壇 / 社群
  extraction targets:
    - 產品頁
    - 定價頁
    - 客戶案例
    - 評測頁
  output goals:
    - 常見品牌
    - 功能比較
    - 價格區間
    - 使用情境
```

### 6.2 Discovery

Discovery builds the candidate URL pool through:

- search engine harvesting
- sitemap discovery
- domain expansion
- site crawl
- RSS / feed discovery
- category/tag/index page discovery
- API endpoint hints when relevant

### 6.3 Retrieval

Retrieval decides:

- static fetch vs browser
- fallback and retry
- proxy/session strategy
- rate limiting and cooldown
- cache reuse and revalidation
- anti-bot and challenge classification

### 6.4 Extraction

Extraction outputs research-ready documents with:

- URL and canonical URL
- title
- main content
- publish date
- author / organization
- source domain
- language
- content type
- quality score
- extraction confidence
- structured fields
- outbound links
- fetched_at

### 6.5 Corpus Processing

This is mandatory for product value.

The system must control:

- exact dedup
- near dedup
- canonical clustering
- domain diversity
- spam / thin content filtering
- source quality ranking
- topical relevance scoring

### 6.6 Analysis

Analysis should not start from "all pages into LLM".

The system should first do:

- chunking
- clustering
- entity aggregation
- timeline extraction
- contradiction detection
- source agreement / disagreement
- evidence selection

Then produce:

- topic summary
- comparison tables
- trend analysis
- controversy and disagreement summary
- confidence notes
- citations / evidence packaging

## 7. Long-running Research Requirements

### 7.1 Job Lifecycle

Every research task should move through explicit states:

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

### 7.2 Checkpoint / Resume

The system must persist:

- completed URLs
- frontier URLs
- fetched documents
- dedup fingerprints
- analysis progress
- stage-level status

### 7.3 Budget Controls

Each task must support bounds for:

- max pages
- max domains
- max runtime
- max browser renders
- max retries per host
- max analysis token budget

### 7.4 Observability

Operators must be able to see:

- fetch success rate
- browser fallback rate
- robots denied count
- anti-bot hit rate
- average cost per document
- extraction confidence
- duplicate ratio
- domain coverage
- time per pipeline stage

## 8. Success Metrics

### 8.1 Product Metrics

- user can start a research task with a topic-only prompt
- system returns evidence-backed findings, not raw crawl dumps
- reports include domain diversity and confidence notes
- recurring monitoring produces meaningful diffs and alerts

### 8.2 Operational Metrics

- stable long-running queue execution
- bounded retry and DLQ behavior
- checkpoint-based recovery
- measurable corpus dedup ratio
- measurable relevance yield per query batch

## 9. Roadmap

### Phase 1: Topic Research Skill

Deliver:

- topic input
- autonomous query generation
- search + discovery collection
- 50 to 300 document corpus assembly
- dedup / rank / filter
- summary + insights + sources

### Phase 2: Deep Domain Research

Deliver:

- domain-focused planning
- sitemap + BFS + pattern rules
- page-type classification
- richer structured extraction

### Phase 3: Persistent Monitoring

Deliver:

- topic watch
- domain watch
- scheduled recrawl
- change detection
- alert summary

### Phase 4: Multi-agent Research

Deliver:

- planner agent
- discovery agent
- retrieval agent
- analysis agent
- report agent

## 10. Canonical Scope Boundary

The canonical product story is now:

> OpenClaw uses this project as an autonomous web research skill and infrastructure layer.

Low-level `search`, `extract`, `map`, and `crawl` remain necessary building blocks, but they are no longer the primary product identity.
