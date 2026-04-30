---
name: nightly-learnings-collector
version: 1.1.0
description: |
  Nightly automated skill that scans the day's Hermes sessions and Claude Code
  activity, extracts non-obvious learnings, decisions, debugging insights, and
  workflow patterns, then feeds them back into RBrain pages and skills. Runs at
  1:00 AM daily via cron. This is the autonomous counterpart to claudeception
  (which is manual/on-demand).
triggers:
  - "nightly learnings"
  - "collect today's learnings"
  - "what did I learn today"
  - "extract daily insights"
tools:
  - search
  - query
  - get_page
  - put_page
  - add_timeline_entry
  - add_link
  - add_tag
  - sync_brain
mutating: true
chains_from:
  - claudeception
  - signal-detector
---

# Nightly Learnings Collector

> **Filing rule:** Read `skills/_brain-filing-rules.md` before writing any page.
> **Identity:** Read `get_page("soul-ramy-barsoum")` before analyzing. SOUL.md has context.
> **Relationship to claudeception:** Claudeception is manual, triggered during or after a session. This skill is automated, runs nightly, and covers ALL sessions from the past 24 hours.

## Contract

This skill guarantees:
- Scans all Hermes sessions and cron job outputs from the past 24 hours.
- Extracts only non-obvious, durable learnings (not routine operations).
- Every learning is tied to a concrete RBrain landing spot (existing page, new page, skill update, or timeline entry).
- Deduplicates against existing brain content before writing.
- Produces a nightly learnings digest delivered to Discord.
- Improves RBrain skills over time by detecting patterns across sessions.
- Falls back cleanly to the local `~/RBrain/skills/nightly-learnings-collector/SKILL.md` copy when the Hermes skill registry cannot load this skill.
- Uses live RBrain CLI access when MCP brain tools are unavailable, sourcing `~/RBrain/.env` first so the active Supabase credentials are loaded.
- Prefers the repo-local CLI (`cd ~/RBrain && bun src/cli.ts ...`) over the PATH `gbrain` binary in this environment, because the global install can lag far behind the checked-out repo and leave migrations half-applied.
- If brain writes fail on missing `source_id` / missing `sources`, repair the schema before continuing: run repo-local `bun src/cli.ts init --migrate-only`; if schema bootstrap still aborts, do the smallest additive repair (`sources`, `pages.source_id`, `files.source_id`, `files.page_id`) and rerun the repo-local migrate-only path before any `put`/`report` calls.

## Phases

### Phase 1: Gather raw session data

Scan the day's activity from these sources:

1. **Hermes sessions** (primary):
   ```bash
   # Find today's session files
   find /Users/cole/.hermes/sessions/ -name "session_$(date +%Y%m%d)_*.json" -type f
   ```
   For each session file, read the JSON and extract `messages` array. Focus on:
   - User messages (what Ramy asked, decided, or corrected)
   - Assistant messages with tool calls (what was built, debugged, or discovered)
   - Error patterns and their resolutions

2. **Cron job outputs** (secondary):
   ```bash
   ls /Users/cole/.hermes/cron/output/
   ```
   Check for today's cron outputs. Flag any failures or unexpected results.

3. **Claude Code sessions** (if accessible):
   ```bash
   # Check for recent Claude Code project activity
   find /Users/cole/.claude/projects/ -name "*.md" -newer /tmp/nightly-learnings-last-run 2>/dev/null
   ```

After gathering, touch the marker file:
```bash
touch /tmp/nightly-learnings-last-run
```

### Phase 2: Extract candidate learnings

For each session, apply these extraction filters:

**Include (high signal):**
- Decisions Ramy made and the reasoning behind them
- Corrections Ramy gave ("no, do it this way", "stop doing X")
- Debugging breakthroughs (error message to root cause)
- Tool/API discoveries (undocumented behavior, workarounds)
- Architecture or design choices with trade-offs discussed
- New integrations or workflows established
- Skill gaps identified (things Ramy asked about for the first time)
- Failed approaches and why they failed

**Exclude (noise):**
- Routine code edits with no learning value
- Status checks, progress updates
- Cron job runs that completed normally with no surprises
- Repeated questions already captured in previous runs
- Small talk, acknowledgments, clarifying Q&A

For each candidate, score it:

| Field | Values |
|-------|--------|
| Signal strength | high / medium / low |
| Durability | permanent / seasonal / ephemeral |
| Landing type | new-page / timeline-entry / skill-update / skill-new |
| Landing spot | specific slug, skill path, or page name |

Drop anything scored low signal or ephemeral durability.

### Phase 3: Deduplicate against RBrain

For each surviving candidate:

1. `mcp_rbrain_search` with keywords from the learning
2. `mcp_rbrain_query` with the core concept
3. If a matching page or timeline entry exists with the same insight, skip it
4. If a partial match exists, plan a timeline append or state rewrite instead of a new page

### Phase 4: Write to RBrain

For each unique learning, execute the appropriate action:

**New page** (rare, only for genuinely new entities or concepts):
- Use `mcp_rbrain_put_page` with compiled-truth-plus-timeline format
- Add `[Source: Nightly learnings collector, YYYY-MM-DD]` citation
- Add links to related pages via `mcp_rbrain_add_link`
- Add tags via `mcp_rbrain_add_tag`

**Timeline entry** (most common):
- Use `mcp_rbrain_add_timeline_entry` on the relevant existing page
- Include date, what was learned, and source session reference

**Skill update** (when a pattern repeats or a better approach is confirmed):
- Read the existing skill file
- Propose specific additions (new anti-pattern, new trigger condition, refined phase)
- Write the update to the skill file on disk
- Bump the version in frontmatter

**Skill creation** (rare, only when claudeception criteria are met):
- Follow the claudeception extraction process
- Save to `~/RBrain/skills/{skill-name}/SKILL.md`
- Update manifest.json and RESOLVER.md

After all writes, call `mcp_rbrain_sync_brain` to commit.

### Phase 5: Generate nightly digest

Compose a Discord-formatted summary (under 2000 chars):

```markdown
**Nightly Learnings -- [date]**

**Sessions scanned**: N
**Learnings extracted**: N (of M candidates)

**New insights**:
- [learning 1] -> [landing spot]
- [learning 2] -> [landing spot]

**Skills improved**:
- [skill name]: [what changed]

**Patterns detected**:
- [recurring theme across sessions, if any]

**Tomorrow's seeds**:
- [anything that looks like it will matter soon but isn't actionable yet]
```

If nothing notable happened, output:
```
**Nightly Learnings -- [date]**
Quiet day. No new learnings extracted from N sessions.
```

## Pattern Detection (the compounding part)

Over multiple runs, this skill should detect:

1. **Recurring corrections**: If Ramy corrects the same behavior 3+ times across sessions, that's a skill update or a new anti-pattern to codify.
2. **Tool friction**: If multiple sessions show the same tool/API causing trouble, create or update a domain skill.
3. **Decision drift**: If Ramy's decisions on a topic shift over time, update the compiled truth on the relevant page.
4. **Knowledge gaps closing**: If Ramy stops asking about a topic he used to ask about, the learning system is working.

Track patterns in a dedicated RBrain page: `digests/nightly-learnings-patterns`

## Output Format

The final response is the Discord digest from Phase 5. Keep it scannable. Morning Ramy should glance at it in 10 seconds and know whether his brain got smarter overnight.

## Anti-Patterns

> **Filing rule:** `skills/_brain-filing-rules.md` remains the source of truth for the notability gate; these are operational reminders only.

- Extracting routine operations as "learnings" (noise pollution)
- Creating junk pages that fail the notability gate
- Duplicating insights already captured by dream-cycle or daily-digest
- Modifying skills without bumping the version
- Writing vague learnings with no concrete landing spot
- Exceeding 2000 characters in the Discord digest
- Treating every debugging session as a skill candidate (most are one-offs)
- Logging session content verbatim instead of distilling the insight
