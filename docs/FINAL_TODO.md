# FINAL_TODO.md

## OpenClaw Web Intelligence — Final Hardening Checklist

更新時間：2026-03-11

---

## Executive Summary

專案目前已完成：
- Research crawler 核心能力
- Bridge layer
- Production wiring v1

目前缺的不是大功能，而是 **production hardening / validation / ops maturity**。

建議優先順序：
1. Redis / worker 真整合測試
2. Job lifecycle 完整化（retry / DLQ / timeout / reclaim）
3. Proxy integration tests
4. Rate limiter stress tests
5. Structured logging + traceId
6. Metrics / dashboard

---

## P0 — 必做

### 1. Redis Integration Tests
**目標**：驗證 queue / worker 在真 Redis 環境下可正確運作。

**工作項目**
- [x] 新增 Redis test environment（docker compose harness + env-gated integration）
- [x] 測試 enqueue → dequeue → complete
- [x] 測試 enqueue → dequeue → fail
- [x] 測試 heartbeat 註冊 / 更新
- [x] 測試 reclaimStaleJobs
- [x] 測試多 worker 不重複處理同一 job

**驗收標準**
- Redis queue lifecycle 有自動化測試覆蓋
- 至少 1 個多 worker scenario 通過
- reclaim stale job 有明確測試案例

**預估工時**：1–2 天

---

### 2. Job Lifecycle 完整化
**目標**：讓 Redis queue 從「可跑」提升為「可靠 job system」。

**工作項目**
- [x] 在 job schema 增加 retryCount
- [x] 增加 maxRetries 設定
- [x] 增加 dead-letter queue
- [x] 增加 job timeout / visibility timeout baseline
- [x] 增加 graceful shutdown 行為
- [x] 增加 worker crash recovery baseline（stale reclaim）

**驗收標準**
- failed job 可自動 retry
- 超過 maxRetries 會進 dead-letter queue
- worker crash 後不會永久卡 processing

**預估工時**：1–2 天

---

### 3. Proxy Integration Tests
**目標**：驗證 proxy pool 是真的 work，不只是 wiring。

**工作項目**
- [x] 建立可測 proxy 測試環境（env-gated local proxy harness）
- [x] 驗證 request 真正走 proxy
- [x] 驗證 fail 後 proxy 健康值下降
- [x] 驗證 unhealthy proxy 不再被選用
- [x] 驗證 proxy 恢復行為

**驗收標準**
- 至少有 1 組 test 能驗證 outbound 經過 proxy
- health / selection / failover 都有測試

**預估工時**：0.5–1 天

---

### 4. Rate Limiter Stress Tests
**目標**：驗證 advanced limiter 在真併發下不會失真。

**工作項目**
- [x] 多 domain acquire/release 測試
- [x] global concurrency 測試
- [x] cooldown/backoff 測試
- [x] starvation / fairness 檢查
- [x] 長時間運作穩定性測試（repeated acquire/release drift guard）

**驗收標準**
- 無 double charge / token drift
- global concurrency 永不超上限
- cooldown domain 不會提前放行

**預估工時**：0.5–1 天

---

## P1 — 建議做

### 5. Structured Logging + Trace ID
**目標**：讓 queue / worker / fetch / crawl 全鏈路可追蹤。

**工作項目**
- [x] 統一 log format（json / key-value）
- [x] 為 job、fetch、retry、proxy、worker 加 traceId baseline
- [x] 區分 info / warn / error
- [x] 記錄 domain / proxyId / workerId / retryReason / outcome baseline

**驗收標準**
- 任一 job 可以追到完整生命週期
- error log 能直接定位模組與上下文

**預估工時**：0.5–1 天

---

### 6. Metrics / Dashboard
**目標**：讓系統可持續營運，而不是出錯才看 log。

**工作項目**
- [x] per-domain success rate
- [x] per-domain block rate
- [x] avg latency
- [x] queue depth
- [x] worker alive count
- [x] proxy health summary
- [x] browser fallback rate
- [x] retry distribution

**驗收標準**
- health 以外有至少一組可讀 metrics 輸出
- 可快速看出哪個 domain / proxy 有問題

**預估工時**：1 天

---

### 7. Browser / Static Fetch Policy 對齊
**目標**：避免 static/browser 兩條路徑規則不同步。

**工作項目**
- [x] 統一 timeout policy
- [x] 統一 retry policy
- [x] 統一 block detection policy
- [x] 統一 proxy selection 行為
- [x] 統一 outcome / observability fields

**驗收標準**
- static/browser 在同一 domain 的行為可預期
- docs 與實作一致

**預估工時**：0.5–1 天

---

### 8. 文件對齊
**目標**：避免 README / SKILL / CURRENT_STATE 說法不一致。

**工作項目**
- [x] README 更新成熟度說明
- [x] SKILL.md 更新最佳使用情境
- [x] CURRENT_STATE / PLAN / FINAL_TODO 三份對齊
- [x] 補一張簡單架構圖

**驗收標準**
- 文件不再出現互相矛盾描述

**預估工時**：0.5 天

---

## P2 — 可選做

### 9. Session Persistence / Cookie Jar
**目標**：提高 anti-bot 對抗能力。

**工作項目**
- [x] domain-level cookie jar
- [x] session reuse
- [x] browser context persistence
- [x] session TTL / rotation

**驗收標準**
- 同一 domain 請求有 session continuity

**預估工時**：1–2 天

---

### 10. CAPTCHA / Challenge Handling
**目標**：處理更強防護網站。

**工作項目**
- [x] challenge page detection
- [x] CAPTCHA provider adapter interface
- [x] fallback / escalate policy
- [x] manual approval path

**驗收標準**
- 遇到 challenge 時不會無聲失敗
- 能明確標記需要人工或 solver

**預估工時**：2–3 天

---

### 11. Multi-cluster Orchestration
**目標**：支援更大規模水平擴展。

**工作項目**
- [x] cluster-aware scheduling
- [x] queue namespace isolation
- [x] regional workers
- [x] external coordinator / supervisor
- [x] cross-node metrics aggregation baseline

**驗收標準**
- 可以跨多個 worker pool 安全分派工作

**預估工時**：2–4 天

---

## 建議執行順序

### Phase 1
- [x] Redis integration tests
- [x] Job lifecycle 完整化（baseline）
- [x] Proxy integration tests
- [x] Rate limiter stress tests

### Phase 2
- [x] Structured logging + traceId
- [x] Metrics / dashboard
- [x] Browser/static policy 對齊
- [x] 文件對齊

### Phase 3
- [x] Session persistence
- [x] CAPTCHA / challenge handling
- [x] Multi-cluster orchestration

---

## 最小可接受完成條件（Production-ready baseline）

當以下項目完成時，可視為較可靠的 production-ready baseline：

- [x] Redis integration tests 完成
- [x] Job retry / DLQ / reclaim 完成
- [x] Proxy integration tests 完成
- [x] Rate limiter stress tests 完成
- [x] Structured logging + traceId 完成
- [x] 基本 metrics 完成

---

## One-line Summary

**現在功能已齊，下一步是把正確性、可靠性、可觀測性補齊。**
