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
- sitemap ingestion v1（sitemap.xml discovery + map/crawl integration）
- retry classification v1（standardized retry reasons + outcome tracking + shell detection）
- host policy memory v1（per-host fetch history + dynamic routing adjustment）
- site-specific structured extraction v2（Docusaurus/MkDocs/GitHub Docs/Changelog 專用 extractors）
- browser ops 部署文件
- lightweight per-domain rate limiting

## Completion Estimate

### Research Crawler Ready
- **完成度：約 95%–98%**
- Near-term 全部完成 🎉

### Production Crawler
- **完成度：約 95%–98%**
- 已實作：queue/worker abstraction、job status tracking、proxy pool、advanced rate limiting、redis queue、anti-bot evasion、proxyUrl schema、anti-bot detection (ANTI_BOT_BLOCKED)、health endpoint、distributed crawling (worker/shard)、storage backend (SQLite + memory)

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
| Sitemap | research | ✅ v1 sitemap.xml discovery + map/crawl |
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
   - ✅ recurring schedule（scheduler.ts）
   - ✅ alerting 機制（alerting.ts: Console/Webhook）

5. **Productionization**
   - ✅ per-domain rate limiting
   - ✅ proxy schema 預留（proxyUrl）
   - ✅ metrics + health endpoint
   - ✅ job queue / status tracking

## Recommended Next Steps

> 詳細兩階段演進請見 [RESEARCH_TO_PRODUCTION_PLAN.md](./RESEARCH_TO_PRODUCTION_PLAN.md)

### Near-term（Research Strengthening）
1. ~~補 sitemap ingestion~~ ✅ 已完成
2. ~~補 retry classification~~ ✅ 已完成
3. ~~補 host policy memory~~ ✅ 已完成
4. ~~擴 site-specific structured extraction coverage~~ ✅ 已完成
5. ~~寫 browser ops / deployment 文件~~ ✅ 已完成
6. ~~補 lightweight per-domain rate limiting~~ ✅ 已完成

🎉 **Near-term 全部完成！**

### Mid-term（Bridge Layer）
7. ~~新增 recurring schedule~~ ✅ 已完成
8. ~~補 alerting abstraction~~ ✅ 已完成
9. ~~補 monitor / crawl persistence baseline~~ ✅ 已完成
10. ~~補 observability baseline~~ ✅ 已完成
11. ~~補 governance baseline~~ ✅ 已完成

🎯 **Bridge Layer 已完成，準備進入 Production Capability Track**
