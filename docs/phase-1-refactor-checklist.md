# Phase 1 Refactor Checklist

> Goal: unify extraction pipeline, introduce dual cache foundations, and prepare routing/fetch layers for Phase 2/3.

## Scope
- [x] Define Phase 1 target architecture
- [x] Extract shared static fetcher
- [x] Extract shared page extraction pipeline
- [x] Reuse shared pipeline from `extract`
- [x] Reuse shared pipeline from `crawl`
- [x] Add dual cache foundation (`request` + `page`)
- [x] Add parity/integration tests for shared pipeline
- [x] Update README / implementation docs

## Architecture Decisions
- Shared modules:
  - `src/fetch/staticFetcher.ts`
  - `src/extract/extractPipeline.ts`
  - `src/cache/{cacheKeys,pageCache,requestCache}.ts`
- `httpExtractor.ts` becomes orchestration layer
- `crawler.ts` becomes crawl orchestration + shared extraction consumer
- Router remains lightweight in Phase 1, but future strategy-based routing is documented

## Follow-up for next phases
- [x] Add `browserFetcher.ts` skeleton
- [x] Upgrade `retrievalRouter` to strategy-based skeleton
- [ ] Replace browser placeholder with Playwright implementation
- [x] Add robots policy evaluator
- [x] Add structured extractor plugins
- [x] Add ETag / Last-Modified persistence to page cache
- [ ] Add per-domain rate limit / host policy memory
