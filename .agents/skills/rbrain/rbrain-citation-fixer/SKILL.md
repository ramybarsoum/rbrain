---
name: rbrain-citation-fixer
version: 1.0.0
description: |
  Run the citation-fixer skill from RBrain against the live brain.
  Scans all non-system pages for citation format compliance, fixes issues,
  and reports counts. Designed to run unattended via cron.
triggers:
  - "fix citations"
  - "citation audit"
  - "check citations"
  - scheduled citation-fixer cron
tools:
  - terminal
  - execute_code
---

# RBrain Citation Fixer

## Prerequisites

The `gbrain` CLI must be installed and the RBrain repo at `~/RBrain` must have a valid `.env` with database credentials.

## Citation Standard (from `~/RBrain/skills/conventions/quality.md`)

Every fact must carry an inline `[Source: ...]` citation:

| Source type | Format |
|-------------|--------|
| User statements | `[Source: User, {context}, YYYY-MM-DD]` |
| Meeting data | `[Source: Meeting "{title}", YYYY-MM-DD]` |
| Email/message | `[Source: email from {name} re: {subject}, YYYY-MM-DD]` |
| Web content | `[Source: {publication}, {URL}, YYYY-MM-DD]` |
| Social media | `[Source: X/@handle, YYYY-MM-DD](URL)` |
| Synthesis | `[Source: compiled from {sources}]` |

## Execution Phases

### Phase 1: Scan

1. List pages: `cd ~/RBrain && source .env 2>/dev/null; gbrain list -n 500`
2. Filter out system pages: `test/*`, `skills/migrations/*`
3. Read each page: `gbrain get "{slug}"`
4. Detect issues:
   - Lowercase `[source:` → should be `[Source:`
   - Missing date (`YYYY-MM-DD`) in citations that require one
   - Non-standard format (e.g., compiled truth without "compiled from" phrasing)

### Phase 2: Fix

1. For each issue, build the corrected citation string
2. **Write-back pattern** — shell quoting breaks with complex markdown. Use temp file:
   ```
   write_file("/tmp/citation_fix_{slug}.md", fixed_content)
   gbrain put "{slug}" < /tmp/citation_fix_{slug}.md
   ```
3. Verify the write succeeded (status: `created_or_updated`)

### Phase 3: Report

```
Citation Audit Report
=====================
Pages scanned: N
Citations found: N
Issues fixed: N
Remaining gaps: N (pages with uncitable facts)
```

## Pitfalls

1. **Shell quoting with `gbrain put`** — `echo '...' | gbrain put` breaks on special chars, quotes, newlines. Always use the temp-file pipe pattern: `gbrain put "{slug}" < /tmp/file.md`
2. **Smart quotes / curly apostrophes** — content may contain `\u2019` etc. Use regex instead of exact string matching when searching for citations to fix:
   ```python
   # BAD — fails if content has smart quotes
   old in content
   
   # GOOD — regex handles character variants
   import re
   pattern = r'\[Source: X/@Av1dlive, [^\]]*https://x\.com/...'
   re.search(pattern, content)
   ```
3. **Skill docs aren't factual claims** — `skills/*/skill` pages contain `[Source: ...]` as instructional examples. Don't "fix" these — they're documentation, not claims.
4. **Synthesis citations don't need dates** — `[Source: compiled from {sources}]` is valid without a date per convention.
5. **Never fabricate citations** — if a fact has no source, flag it. Don't invent one.
6. **Never delete uncited facts** — flag them as remaining gaps instead.
