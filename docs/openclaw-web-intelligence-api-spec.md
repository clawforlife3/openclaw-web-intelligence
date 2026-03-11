# OpenClaw Web Intelligence Gateway — API Spec

> This file remains a low-level API/reference contract for existing engines.
> It is no longer the primary product entrypoint definition.
> Canonical top-level skill interfaces now live in:
> - [openclaw-web-intelligence-prd.md](./openclaw-web-intelligence-prd.md)
> - [openclaw-web-intelligence-sdd.md](./openclaw-web-intelligence-sdd.md)

> API style: internal service / library contract first, HTTP transport optional.

> **注意**：本文件描述現有 engine 的低階 API 規格。較高層的產品與系統定義請參考 PRD 與 SDD。

---

# 1. Executive Summary

本文件定義 MVP 與 post-MVP 的 API / contract，讓工程實作、測試、OpenClaw adapter 與未來服務化部署可以共用同一套介面語意。

---

# 2. Common Conventions

## 2.1 Common Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_123",
    "traceId": "trace_123",
    "cached": false,
    "tookMs": 1420,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 2.2 Error Envelope

```json
{
  "success": false,
  "data": null,
  "meta": {
    "requestId": "req_123",
    "traceId": "trace_123",
    "cached": false,
    "tookMs": 51,
    "schemaVersion": "v1"
  },
  "error": {
    "code": "FETCH_TIMEOUT",
    "message": "Timed out while fetching target URL.",
    "retryable": true,
    "details": {
      "url": "https://example.com"
    }
  }
}
```

## 2.3 Shared Types

### UrlTarget
```json
{
  "url": "https://example.com/docs",
  "label": "optional"
}
```

### CacheMeta
```json
{
  "hit": false,
  "ttlSeconds": 3600,
  "key": "extract:sha256:..."
}
```

### ContentMetadata
```json
{
  "title": "Example",
  "description": "...",
  "canonical": "https://example.com/docs",
  "publishedAt": null,
  "language": "en",
  "statusCode": 200,
  "contentType": "text/html"
}
```

### ExtractedDocument
```json
{
  "url": "https://example.com/docs",
  "finalUrl": "https://example.com/docs",
  "title": "Example",
  "markdown": "# Example",
  "text": "Example",
  "html": null,
  "metadata": {},
  "structured": {
    "kind": "docs",
    "headingTree": ["Getting Started", "Install"],
    "codeBlockCount": 2,
    "navLinkCount": 8
  },
  "links": [],
  "confidence": 0.91,
  "sourceQuality": 0.84,
  "untrusted": true,
  "cache": {
    "hit": false,
    "ttlSeconds": 3600,
    "key": "extract:sha256:..."
  },
  "fetch": {
    "strategy": "browser",
    "initialStrategy": "static",
    "autoRetried": true,
    "retryReason": "js_app_shell_detected"
  },
  "extractedAt": "2026-03-10T06:00:00Z"
}
```

### Crawl / Map Debug Metadata
```json
{
  "debug": {
    "robots": {
      "decisions": [
        {
          "url": "https://example.com/docs",
          "phase": "seed",
          "allowed": true,
          "reason": "allowed",
          "robotsUrl": "https://example.com/robots.txt"
        }
      ],
      "blockedCount": 0,
      "unavailableCount": 0
    }
  }
}
```

---

# 3. Operation: search

## 3.1 Request

```json
{
  "query": "best open source web crawler for docs indexing",
  "includeDomains": ["github.com", "docs.example.com"],
  "excludeDomains": ["pinterest.com"],
  "topic": "general",
  "maxResults": 5,
  "freshness": "any",
  "includeExtract": false,
  "cacheTtlSeconds": 600
}
```

## 3.2 Fields

- `query`: string, required
- `includeDomains`: string[], optional
- `excludeDomains`: string[], optional
- `topic`: `general | news | docs`, optional, default `general`
- `maxResults`: number, optional, default `5`
- `freshness`: `day | week | month | year | any`, optional
- `includeExtract`: boolean, optional
- `cacheTtlSeconds`: number, optional

## 3.3 Response

```json
{
  "success": true,
  "data": {
    "query": "best open source web crawler for docs indexing",
    "results": [
      {
        "url": "https://example.com/article",
        "title": "Example Article",
        "snippet": "A review of crawlers...",
        "rank": 1,
        "sourceQuality": 0.82,
        "publishedAt": null,
        "domain": "example.com"
      }
    ],
    "provider": "provider-v1"
  },
  "meta": {
    "requestId": "req_1",
    "traceId": "trace_1",
    "cached": false,
    "tookMs": 320,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 3.4 Errors
- `VALIDATION_ERROR`
- `SEARCH_PROVIDER_ERROR`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

---

# 4. Operation: extract

## 4.1 Request

```json
{
  "urls": [
    "https://example.com/docs/getting-started"
  ],
  "formats": ["markdown", "text"],
  "includeHtml": false,
  "includeLinks": true,
  "includeStructured": true,
  "renderMode": "auto",
  "cacheTtlSeconds": 3600,
  "timeoutMs": 15000,
  "safetyMode": "balanced"
}
```

## 4.2 Fields
- `urls`: string[] required, 1..N
- `formats`: `markdown | text | html`[] optional
- `includeHtml`: boolean optional
- `includeLinks`: boolean optional
- `includeStructured`: boolean optional
- `renderMode`: `auto | static | browser`, optional, default `auto`
  - `auto`: 預設先走 static，保留 browser fallback 路徑
  - `browser`: 明確要求 browser；若 Playwright 套件或 browser binaries 不可用，回傳 `BROWSER_UNAVAILABLE`
- `cacheTtlSeconds`: number optional
- `timeoutMs`: number optional
- `safetyMode`: `strict | balanced | off`, optional

## 4.3 Response

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "url": "https://example.com/docs/getting-started",
        "finalUrl": "https://example.com/docs/getting-started",
        "title": "Getting Started",
        "markdown": "# Getting Started\n...",
        "text": "Getting Started ...",
        "html": null,
        "metadata": {
          "title": "Getting Started",
          "description": "Learn the basics",
          "canonical": "https://example.com/docs/getting-started",
          "publishedAt": null,
          "language": "en",
          "statusCode": 200,
          "contentType": "text/html"
        },
        "structured": {},
        "links": ["https://example.com/docs/install"],
        "confidence": 0.93,
        "sourceQuality": 0.87,
        "untrusted": true,
        "cache": {
          "hit": false,
          "ttlSeconds": 3600,
          "key": "extract:sha256:abc"
        },
        "extractedAt": "2026-03-10T06:00:00Z"
      }
    ]
  },
  "meta": {
    "requestId": "req_2",
    "traceId": "trace_2",
    "cached": false,
    "tookMs": 812,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 4.4 Errors
- `VALIDATION_ERROR`
- `DOMAIN_POLICY_DENIED`
- `ROBOTS_POLICY_DENIED`
- `FETCH_TIMEOUT`
- `FETCH_HTTP_ERROR`
- `PARSE_ERROR`
- `EXTRACTION_EMPTY_CONTENT`
- `INTERNAL_ERROR`

---

# 5. Operation: map

## 5.1 Request

```json
{
  "url": "https://docs.example.com",
  "maxDepth": 2,
  "maxBreadth": 20,
  "limit": 100,
  "includeDomains": ["docs.example.com"],
  "excludePaths": ["/changelog"],
  "robotsMode": "balanced",
  "cacheTtlSeconds": 1800
}
```

## 5.2 Response

```json
{
  "success": true,
  "data": {
    "seedUrl": "https://docs.example.com",
    "urls": [
      {
        "url": "https://docs.example.com",
        "depth": 0,
        "discoveredFrom": null
      },
      {
        "url": "https://docs.example.com/getting-started",
        "depth": 1,
        "discoveredFrom": "https://docs.example.com"
      }
    ],
    "summary": {
      "visited": 12,
      "discovered": 33,
      "excluded": 4,
      "stoppedReason": "limit_reached"
    }
  },
  "meta": {
    "requestId": "req_3",
    "traceId": "trace_3",
    "cached": false,
    "tookMs": 1270,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 5.3 Errors
- `VALIDATION_ERROR`
- `DOMAIN_POLICY_DENIED`
- `ROBOTS_POLICY_DENIED`
- `CRAWL_SCOPE_EXCEEDED`
- `FETCH_TIMEOUT`
- `INTERNAL_ERROR`

---

# 6. Operation: crawl

## 6.1 Request

```json
{
  "seedUrl": "https://docs.example.com",
  "maxDepth": 2,
  "maxBreadth": 20,
  "limit": 50,
  "includeDomains": ["docs.example.com"],
  "excludePaths": ["/legal"],
  "formats": ["markdown", "text"],
  "includeLinks": true,
  "includeStructured": false,
  "robotsMode": "balanced",
  "cacheTtlSeconds": 1800
}
```

## 6.2 Response

```json
{
  "success": true,
  "data": {
    "jobId": "crawl_123",
    "seedUrl": "https://docs.example.com",
    "documents": [
      {
        "url": "https://docs.example.com/getting-started",
        "finalUrl": "https://docs.example.com/getting-started",
        "title": "Getting Started",
        "markdown": "# Getting Started",
        "text": "Getting Started",
        "html": null,
        "metadata": {},
        "structured": {},
        "links": [],
        "confidence": 0.9,
        "sourceQuality": 0.85,
        "untrusted": true,
        "cache": {
          "hit": false,
          "ttlSeconds": 1800,
          "key": "extract:sha256:def"
        },
        "extractedAt": "2026-03-10T06:00:00Z"
      }
    ],
    "summary": {
      "visited": 20,
      "extracted": 15,
      "skipped": 5,
      "errors": 1,
      "stoppedReason": "limit_reached"
    }
  },
  "meta": {
    "requestId": "req_4",
    "traceId": "trace_4",
    "cached": false,
    "tookMs": 9120,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 6.3 Errors
- `VALIDATION_ERROR`
- `DOMAIN_POLICY_DENIED`
- `ROBOTS_POLICY_DENIED`
- `CRAWL_SCOPE_EXCEEDED`
- `FETCH_TIMEOUT`
- `STORAGE_ERROR`
- `INTERNAL_ERROR`

---

# 7. Operation: monitor

## 7.1 Request

```json
{
  "targetType": "page",
  "target": "https://example.com/pricing",
  "schedule": "every 6h",
  "diffPolicy": {
    "mode": "field",
    "fields": ["title", "structured.price", "markdown"]
  },
  "notifyPolicy": {
    "cooldownMinutes": 180,
    "onlyOnChange": true
  },
  "execution": {
    "operation": "extract",
    "options": {
      "formats": ["markdown", "text"]
    }
  }
}
```

## 7.2 Response

```json
{
  "success": true,
  "data": {
    "monitorJobId": "mon_123",
    "status": "created"
  },
  "meta": {
    "requestId": "req_5",
    "traceId": "trace_5",
    "cached": false,
    "tookMs": 45,
    "schemaVersion": "v1"
  },
  "error": null
}
```

## 7.3 Errors
- `VALIDATION_ERROR`
- `STORAGE_ERROR`
- `INTERNAL_ERROR`

---

# 8. Operation: interact (Post-MVP)

## 8.1 Request

```json
{
  "url": "https://app.example.com/login",
  "actions": [
    { "kind": "type", "selector": "#email", "text": "user@example.com" },
    { "kind": "type", "selector": "#password", "text": "secret" },
    { "kind": "click", "selector": "button[type=submit]" },
    { "kind": "wait", "timeMs": 3000 }
  ],
  "extractAfter": true,
  "formats": ["markdown", "text"],
  "timeoutMs": 30000
}
```

---

# 9. Validation Rules

## 9.1 URL validation
- must be http/https
- no empty hostname
- no localhost/private network by default unless explicitly allowed

## 9.2 Domain filters
- domains must be normalized lowercase
- wildcard policy reserved for future version

## 9.3 Limits
- `maxResults <= 20` in MVP
- `limit <= 200` in MVP crawl/map
- `maxDepth <= 5` in MVP

---

# 10. Cache Key Strategy

## 10.1 Search
`search:{normalized-query}:{domains}:{topic}:{maxResults}`

## 10.2 Extract
`extract:{normalized-url}:{formats}:{renderMode}:{safetyMode}`

## 10.3 Map
`map:{seed-url}:{scope}:{limits}:{robotsMode}`

## 10.4 Crawl
`crawl:{seed-url}:{scope}:{limits}:{formats}:{robotsMode}`

---

# 11. Versioning Strategy

- schema version starts at `v1`
- breaking field changes require version bump
- additive optional fields allowed within same version

---

# 12. Final Recommendation

實作時優先把這份 API Spec 當作 **contract-first source of truth**：

1. 先寫 TypeScript types
2. 再寫 validators
3. 再寫 adapter
4. 最後寫 engines

這樣最能避免模組各做各的，後面大改 schema。
