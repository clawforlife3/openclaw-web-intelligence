# OpenClaw Web Intelligence Gateway — Current State

> Snapshot date: 2026-03-11

## Executive Summary

專案已經超出原始 MVP 1.0，現況更接近 **MVP 2.0 多個 phase 的 first-usable version**。

目前已落地：
- unified extraction pipeline
- request/page dual cache
- conditional cache revalidation
- Playwright browser fetcher v1
- extract / crawl browser auto-detection v1
- robots policy v1
- structured extraction v1
- crawl/map debug metadata（robots decision trace）
- monitor/diff v1（baseline snapshot + field diff）
- stronger research-crawler heuristics v1.1（JS shell / noscript shell / thin DOM detection）
- richer structured extraction v1.1（docs/article coverage expanded）

## Completion Estimate

### Research Crawler Ready
- **完成度：約 78%–85%**
- 尚缺：browser ops 文件、site-specific structured coverage、sitemap ingestion、retry classification

### Production Crawler
- **完成度：約 35%–45%**
- 尚缺：rate limiting、proxy strategy、persistent storage/ops、distributed queue、monitor/diff、更完整 observability

## Implemented vs Planned

| Area | Planned | Current State |
|------|---------|---------------|
| Search | DDGS search | ✅ 已完成 |
| Extract | static extract | ✅ + browser fallback + structured |
| Map | BFS map | ✅ + robots trace |
| Crawl | BFS crawl | ✅ + robots + auto-detection + structured |
| Cache | basic cache | ✅ dual cache + conditional revalidation |
| Browser | planned | ✅ v1 Playwright fetcher |
| Structured extraction | planned | ✅ v1.1 article/docs/product/forum（coverage expanded） |
| Robots | planned | ✅ strict/balanced/off v1 |
| Monitor/Diff | post-MVP | ✅ v1 baseline + field diff |
| Distributed/proxy | long-term | ❌ 尚未實作 |

## Main Gaps

1. **Ops completeness**
   - Playwright browser binaries 安裝/部署文件仍不足
   - runtime prerequisites 尚未完整文件化

2. **Heuristics quality**
   - auto-detection 已強化到 v1.1（JS shell / noscript shell / thin DOM）
   - 尚未做更細的 host-specific confidence / DOM scoring

3. **Structured depth**
   - 已有 pluggable extractors，docs/article 欄位覆蓋率已提升
   - 仍缺少更細 site-specific extractors 與 schema normalization

4. **Monitoring / Diff**
   - ✅ v1 已完成並通過測試（2026-03-11）
   - 首次建立 baseline snapshot
   - title / text / structured / urlCount 差異偵測
   - 尚缺：recurring schedule、alerting 機制

5. **Productionization**
   - 缺 per-domain rate limiting
   - 缺 proxy/distributed execution
   - 缺更完整 metrics / persistence

## Recommended Next Steps

1. ~~實作 monitor/diff 第一版~~ ✅ 已完成
2. 寫 browser ops / deployment 文件
3. 補 sitemap ingestion
4. 補 retry classification / host policy memory
5. 擴 site-specific structured extraction coverage
6. 補 per-domain rate limiting
7. 新增 recurring schedule + alerting 機制
