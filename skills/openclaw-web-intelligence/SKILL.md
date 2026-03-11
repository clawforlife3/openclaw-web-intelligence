---
name: openclaw-web-intelligence
description: Use this skill when an OpenClaw agent needs autonomous web research from a natural-language topic, domain-focused site analysis, or recurring topic monitoring. Use it to run research_topic, crawl_domain, and monitor_topic workflows through this repo's CLI/API instead of treating the project as a low-level crawler.
---

# OpenClaw Web Intelligence

This skill exposes `openclaw-web-intelligence` as a task-level research backend.

Use it when the user asks for:
- topic research from a natural-language request
- one-domain mapping or deeper source collection
- recurring monitoring of a topic, brand, tool, or domain
- high-JS or login-required research targets that may need remote CDP browser attach

Do not treat this skill as a generic "crawl any URL" wrapper first. Choose the highest-level task that matches the user intent.

## Choose The Right Entry Point

### `research_topic`

Use when the user gives a topic instead of URLs.

Typical requests:
- 研究台灣 CRM 市場
- 比較英國 CS conversion 碩士
- 蒐集最近半年 AI SEO 工具趨勢

What it does now:
- topic -> plan
- query generation
- web discovery
- top-source extraction
- corpus scoring / dedup / clustering
- sectioned report with evidence, agreements, contradictions, and uncertainties

Preferred CLI:

```bash
npm run research -- --topic "台灣 CRM 市場" --goal compare
```

### `crawl_domain`

Use when the user wants one site or one domain explored in more detail.

Typical requests:
- 把這個 docs 站整理出主要功能
- 掃這個產品網站的 pricing / product / blog 區
- 分析某家公司官網的資訊架構

Preferred CLI:

```bash
npm run crawl-domain -- --domain example.com --goal "map product and blog"
```

### `monitor_topic`

Use when the user wants recurring monitoring, new findings, or trend changes over time.

Typical requests:
- 持續追蹤某品牌負評
- 監控某產業新工具
- 追蹤某競品近期更新

Preferred CLI:

```bash
npm run monitor-topic -- --topic "某品牌 負評"
npm run monitor-cycle
```

## Supporting Commands

Use these to inspect results instead of rerunning blindly:

```bash
npm run task-registry
npm run briefing -- --task-id=<task-id>
npm run briefing -- --topic="台灣 CRM 市場"
npm run frontier -- --task-id=<task-id>
```

Use this before high-JS or logged-in targets:

```bash
npm run browser-runtime
```

## High-JS And Login-Required Sites

If the target needs browser rendering, login reuse, or desktop profile state:

```bash
export OPENCLAW_BROWSER_REMOTE_CDP_URL=http://127.0.0.1:9222
export OPENCLAW_BROWSER_ATTACH_ONLY=true
export OPENCLAW_BROWSER_PROFILE_NAME=windows-default
```

Then probe and run the task:

```bash
npm run browser-runtime
npm run research -- --topic "會員限定內容研究"
```

If browser fetch fails with challenge/login hints, prefer remote CDP attach instead of retrying the same local browser mode.

## OpenClaw Agent Guidance

This skill is currently a **single-agent research backend**.

That means:
- OpenClaw can use it as a task-level tool backend now
- do not assume automatic subagent spawning exists yet
- use `research_topic`, `crawl_domain`, and `monitor_topic` as the primary interface
- keep lower-level `search`, `extract`, `map`, `crawl`, and `monitor` as secondary tools for debugging or narrow workflows

If you later add multi-agent orchestration, keep the current task-level tools as the stable public interface and treat planner/discovery/analysis subagents as internal orchestration.

## Output Expectations

Expect outputs shaped around:
- `plan`
- `sources`
- `documents`
- `summary`
- `findings`
- `evidence`
- `report`

The report currently includes:
- sectioned report content
- markdown report text
- comparisons
- agreements
- contradictions
- uncertainties

## Repo References

Open these when you need implementation truth instead of paraphrasing:
- `README.md`
- `docs/CURRENT_STATE.md`
- `docs/openclaw-web-intelligence-prd.md`
- `docs/openclaw-web-intelligence-sdd.md`
- `docs/openclaw-web-intelligence-api-spec.md`
