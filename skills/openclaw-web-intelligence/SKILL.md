---
name: openclaw-web-intelligence
description: Use this skill when you need high-quality web intelligence for research, documentation analysis, structured extraction, website mapping, crawling, or baseline change detection with monitor/diff.
---

# OpenClaw Web Intelligence Skill

## What this skill is for

This skill wraps the `openclaw-web-intelligence` project as a reusable capability for OpenClaw agents.

Use it when you need to:
- search the web for candidate sources
- extract a single page into agent-friendly content
- map a documentation or website structure
- crawl a small-to-medium site for research
- get structured fields from article/docs/product/forum pages
- establish a baseline and compare future page/site changes

Do **not** use it as your first choice for:
- large-scale production crawling
- anti-bot heavy targets
- distributed crawling jobs
- browser interaction workflows requiring clicks/forms/login (use browser automation tooling for that)

---

## Core mental model

Choose the smallest operation that answers the question:

1. **search**
   - Use when you need candidate URLs.
   - Good for topic discovery and source finding.

2. **extract**
   - Use when you already know the URL and want the content.
   - Best for one page, docs page, article, changelog, release notes, blog post.

3. **map**
   - Use when you need to understand a site structure before crawling.
   - Best for docs sites, help centers, knowledge bases.

4. **crawl**
   - Use when you need multiple pages from one site.
   - Best for building a research corpus from a constrained scope.

5. **monitor**
   - Use when you need a baseline snapshot and later diff checks.
   - Good for changelogs, docs sections, pricing pages, status pages.

---

## Suggested workflow patterns

### Pattern A: Topic research

```text
search -> extract top sources -> crawl one authoritative site -> synthesize
```

Use this for:
- market scans
- technical validation
- competitor/product/docs analysis

### Pattern B: Documentation analysis

```text
map -> crawl -> structured docs extraction -> summarize architecture / setup / API surface
```

Use this for:
- reading unfamiliar product docs
- understanding API or SDK surface area
- comparing documentation quality across products

### Pattern C: Change detection baseline

```text
monitor(create baseline) -> rerun monitor later -> compare title/text/structured/urlCount
```

Use this for:
- changelog pages
- pricing pages
- release docs
- policy pages

---

## Practical usage notes

### Search
Use search first when the target URL is not known.

### Extract
Prefer `renderMode=auto` unless you already know the site needs browser rendering.
Turn on `includeStructured=true` when the page is likely an article/docs/product/forum page.

### Map
Use before crawl if the site is unfamiliar or you want to inspect scope first.

### Crawl
Keep the scope constrained:
- low `maxDepth`
- reasonable `limit`
- respect robots mode

### Monitor
Current monitor is **engine-level v1**:
- baseline snapshot
- field diff
- no recurring scheduler/alerting built in yet

---

## Output expectations

When using this skill, prefer outputs that include:
- executive summary first
- clear source URLs
- what was extracted vs inferred
- confidence caveats when content looks thin or JS-heavy

For docs crawling, call out:
- heading structure
- code-heavy pages
- guide vs reference split
- any browser-required pages

---

## Repo-local references

- Project root: `projects/openclaw-web-intelligence/`
- README: `projects/openclaw-web-intelligence/README.md`
- Current state: `projects/openclaw-web-intelligence/docs/CURRENT_STATE.md`
- Roadmap: `projects/openclaw-web-intelligence/docs/ROADMAP.md`

---

## Current limitations

- no sitemap ingestion yet
- no host policy memory yet
- no per-domain rate limiting yet
- no recurring monitor scheduler/alerting yet
- not intended for massive distributed crawling

---

## Recommended next evolution

For stronger research crawler behavior, prioritize:
1. sitemap ingestion
2. retry classification / host policy memory
3. richer site-specific structured extraction
4. browser ops / deployment guidance
5. rate limiting
