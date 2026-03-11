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
- [ ] 新增 Redis test environment（docker / testcontainer / CI service）
- [ ] 測試 enqueue → dequeue → complete
- [ ] 測試 enqueue → dequeue → fail
- [ ] 測試 heartbeat 註冊 / 更新
- [ ] 測試 reclaimStaleJobs
- [ ] 測試多 worker 不重複處理同一 job

**驗收標準**
- Redis queue lifecycle 有自動化測試覆蓋
- 至少 1 個多 worker scenario 通過
- reclaim stale job 有明確測試案例

**預估工時**：1–2 天

---

### 2. Job Lifecycle 完整化
**目標**：讓 Redis queue 從「可跑」提升為「可靠 job system」。

**工作項目**
- [ ] 在 job schema 增加 retryCount
- [ ] 增加 maxRetries 設定
- [ ] 增加 dead-letter queue
- [ ] 增加 job timeout / visibility timeout
- [ ] 增加 graceful shutdown 行為
- [ ] 增加 worker crash recovery

**驗收標準**
- failed job 可自動 retry
- 超過 maxRetries 會進 dead-letter queue
- worker crash 後不會永久卡 processing

**預估工時**：1–2 天

---

### 3. Proxy Integration Tests
**目標**：驗證 proxy pool 是真的 work，不只是 wiring。

**工作項目**
- [ ] 建立可測 proxy 測試環境（mock proxy / local proxy）
- [ ] 驗證 request 真正走 proxy
- [ ] 驗證 fail 後 proxy 健康值下降
- [ ] 驗證 unhealthy proxy 不再被選用
- [ ] 驗證 proxy 恢復行為

**驗收標準**
- 至少有 1 組 test 能驗證 outbound 經過 proxy
- health / selection / failover 都有測試

**預估工時**：0.5–1 天

---

### 4. Rate Limiter Stress Tests
**目標**：驗證 advanced limiter 在真併發下不會失真。

**工作項目**
- [ ] 多 domain acquire/release 測試
- [ ] global concurrency 測試
- [ ] cooldown/backoff 測試
- [ ] starvation / fairness 檢查
- [ ] 長時間運作穩定性測試

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
- [ ] 統一 log format（json / key-value）
- [ ] 為 job、fetch、retry、proxy、worker 加 traceId
- [ ] 區分 info / warn / error
- [ ] 記錄 domain / proxyId / workerId / retryReason / outcome

**驗收標準**
- 任一 job 可以追到完整生命週期
- error log 能直接定位模組與上下文

**預估工時**：0.5–1 天

---

### 6. Metrics / Dashboard
**目標**：讓系統可持續營運，而不是出錯才看 log。

**工作項目**
- [ ] per-domain success rate
- [ ] per-domain block rate
- [ ] avg latency
- [ ] queue depth
- [ ] worker alive count
- [ ] proxy health summary
- [ ] browser fallback rate
- [ ] retry distribution

**驗收標準**
- health 以外有至少一組可讀 metrics 輸出
- 可快速看出哪個 domain / proxy 有問題

**預估工時**：1 天

---

### 7. Browser / Static Fetch Policy 對齊
**目標**：避免 static/browser 兩條路徑規則不同步。

**工作項目**
- [ ] 統一 timeout policy
- [ ] 統一 retry policy
- [ ] 統一 block detection policy
- [ ] 統一 proxy selection 行為
- [ ] 統一 outcome / observability fields

**驗收標準**
- static/browser 在同一 domain 的行為可預期
- docs 與實作一致

**預估工時**：0.5–1 天

---

### 8. 文件對齊
**目標**：避免 README / SKILL / CURRENT_STATE 說法不一致。

**工作項目**
- [ ] README 更新成熟度說明
- [ ] SKILL.md 更新最佳使用情境
- [ ] CURRENT_STATE / PLAN / FINAL_TODO 三份對齊
- [ ] 補一張簡單架構圖

**驗收標準**
- 文件不再出現互相矛盾描述

**預估工時**：0.5 天

---

## P2 — 可選做

### 9. Session Persistence / Cookie Jar
**目標**：提高 anti-bot 對抗能力。

**工作項目**
- [ ] domain-level cookie jar
- [ ] session reuse
- [ ] browser context persistence
- [ ] session TTL / rotation

**驗收標準**
- 同一 domain 請求有 session continuity

**預估工時**：1–2 天

---

### 10. CAPTCHA / Challenge Handling
**目標**：處理更強防護網站。

**工作項目**
- [ ] challenge page detection
- [ ] CAPTCHA provider adapter
- [ ] fallback / escalate policy
- [ ] manual approval path

**驗收標準**
- 遇到 challenge 時不會無聲失敗
- 能明確標記需要人工或 solver

**預估工時**：2–3 天

---

### 11. Multi-cluster Orchestration
**目標**：支援更大規模水平擴展。

**工作項目**
- [ ] cluster-aware scheduling
- [ ] queue namespace isolation
- [ ] regional workers
- [ ] external coordinator / supervisor
- [ ] cross-node metrics aggregation

**驗收標準**
- 可以跨多個 worker pool 安全分派工作

**預估工時**：2–4 天

---

## 建議執行順序

### Phase 1
- [ ] Redis integration tests
- [ ] Job lifecycle 完整化
- [ ] Proxy integration tests
- [ ] Rate limiter stress tests

### Phase 2
- [ ] Structured logging + traceId
- [ ] Metrics / dashboard
- [ ] Browser/static policy 對齊
- [ ] 文件對齊

### Phase 3
- [ ] Session persistence
- [ ] CAPTCHA / challenge handling
- [ ] Multi-cluster orchestration

---

## 最小可接受完成條件（Production-ready baseline）

當以下項目完成時，可視為較可靠的 production-ready baseline：

- [ ] Redis integration tests 完成
- [ ] Job retry / DLQ / reclaim 完成
- [ ] Proxy integration tests 完成
- [ ] Rate limiter stress tests 完成
- [ ] Structured logging + traceId 完成
- [ ] 基本 metrics 完成

---

## One-line Summary

**現在功能已齊，下一步是把正確性、可靠性、可觀測性補齊。**
