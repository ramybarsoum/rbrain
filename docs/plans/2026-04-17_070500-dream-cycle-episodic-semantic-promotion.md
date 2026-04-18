# Dream Cycle Episodic-to-Semantic Promotion Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a real nightly dream-cycle execution path that detects recurring patterns in recent evidence, promotes durable patterns into semantic memory, and can run safely from cron.

**Architecture:** Introduce a dedicated `gbrain dream-cycle` command instead of burying the logic inside docs or ad hoc shell scripts. Put the promotion logic in a small core module that scores candidate patterns from recent timeline entries and ingest logs, then writes conservative updates through existing engine operations. Keep promotion deterministic first. LLM synthesis is optional later, not phase 1.

**Tech Stack:** Bun, TypeScript, existing `BrainEngine` operations, current CLI command structure under `src/commands/`, existing docs under `docs/guides/`.

---

## Current Context / Assumptions

- RBrain already has docs describing the dream cycle, but no first-class executable `dream-cycle` command.
- The existing autopilot loop (`src/commands/autopilot.ts`) runs `sync -> extract -> embed`, but not semantic promotion.
- Timeline entries are already stored and queryable. `log_ingest` also exists and can provide structured evidence.
- Ramy approved episodic-to-semantic promotion with a conservative threshold: recurring, medium+ salience, no unresolved conflicts.
- This should remain safe in a regulated environment. No PHI inference, no broad autonomous rewriting of important pages without explicit promotion rules.

## Proposed Approach

Build this as a dedicated command and core module, then wire cron to call that command nightly.

Why this approach:
- easier to test than a shell script
- reusable from cron, autopilot, and manual CLI runs
- keeps promotion logic in typed code instead of scattered docs
- makes dry-run and JSON output straightforward

### Proposed runtime shape

```bash
gbrain dream-cycle --repo ~/RBrain --json
```

Phases inside the command:
1. collect candidate evidence from recent timeline entries and ingest log rows
2. group evidence into recurring patterns
3. score each pattern by recurrence, recency, and source quality
4. reject conflicted or low-signal patterns
5. promote approved patterns into semantic memory targets
6. emit a structured report
7. optionally run `embed --stale`

## Files Likely to Change

### New files
- Create: `src/commands/dream-cycle.ts`
- Create: `src/core/promotion.ts`
- Create: `test/dream-cycle.test.ts`
- Create: `test/promotion.test.ts`

### Modify
- Modify: `src/cli.ts` or command registration entrypoint that wires commands
- Modify: `src/commands/autopilot.ts` to optionally call `dream-cycle` instead of only sync/extract/embed
- Modify: `docs/guides/cron-schedule.md`
- Modify: `docs/guides/operational-disciplines.md`
- Modify: `CLAUDE.md` if command inventory changes materially

## Data Model and Safety Rules

### Candidate pattern inputs
- timeline entries from the last 14 days
- recent ingest log entries tagged by source_type
- optional page metadata (type, tags, recency)

### Promotion target
Phase 1 should promote only into one of these:
- existing page `compiled_truth` when the pattern is clearly page-local
- a dedicated semantic concept page when the pattern is cross-cutting
- a dry-run report only when ambiguity remains

### Hard safety rules
- do not promote anything with PHI-like payloads
- do not rewrite pages with conflicting evidence automatically
- do not delete timeline entries
- do not overwrite semantic memory when the pattern is below threshold
- do not create more than N promotions per run in phase 1 (suggestion: 10)

## Task Breakdown

### Task 1: Add failing tests for the promotion scorer

**Objective:** Define what counts as a promotable recurring pattern before implementation.

**Files:**
- Create: `test/promotion.test.ts`
- Modify: none

**Step 1: Write failing tests**

Cover at least:
- recurring entries across 3+ timeline events become candidates
- one-off entries do not become candidates
- stale old entries decay below threshold
- conflicted entries are rejected
- PHI-like text is rejected

**Step 2: Run test to verify failure**

Run:
```bash
bun test test/promotion.test.ts
```
Expected: FAIL — module or functions not found.

**Step 3: Write minimal implementation scaffold**

Create `src/core/promotion.ts` with placeholder exports like:
- `collectPromotionCandidates()`
- `scoreCandidate()`
- `shouldPromote()`

**Step 4: Run test to verify pass**

Run:
```bash
bun test test/promotion.test.ts
```
Expected: PASS

### Task 2: Build deterministic promotion logic

**Objective:** Implement grouping and scoring without LLM dependencies.

**Files:**
- Modify: `src/core/promotion.ts`
- Test: `test/promotion.test.ts`

**Step 1: Write next failing test**

Add a test for grouping repeated timeline summaries into one pattern bucket.

**Step 2: Run test to verify failure**

Run:
```bash
bun test test/promotion.test.ts
```
Expected: FAIL — grouping behavior incorrect.

**Step 3: Write minimal implementation**

Implement:
- normalized summary grouping
- recurrence count
- recency weighting
- source-quality weighting
- conflict detection hook

**Step 4: Run test to verify pass**

Run:
```bash
bun test test/promotion.test.ts
```
Expected: PASS

### Task 3: Add the `gbrain dream-cycle` command

**Objective:** Create a real executable command for nightly cron use.

**Files:**
- Create: `src/commands/dream-cycle.ts`
- Modify: CLI registration file
- Test: `test/dream-cycle.test.ts`

**Step 1: Write failing tests**

Tests should cover:
- command runs in dry-run mode
- command returns JSON summary
- command respects 14-day window default
- command skips promotion on empty input

**Step 2: Run test to verify failure**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: FAIL — command missing.

**Step 3: Write minimal implementation**

Implement command flow:
- load recent evidence
- build candidates
- score and filter
- return dry-run output

**Step 4: Run test to verify pass**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: PASS

### Task 4: Wire real writes conservatively

**Objective:** Apply promotions through existing engine methods.

**Files:**
- Modify: `src/commands/dream-cycle.ts`
- Modify: `src/core/promotion.ts`
- Test: `test/dream-cycle.test.ts`

**Step 1: Write failing test**

Test that a promotable pattern updates the expected target page only when not in dry-run mode.

**Step 2: Run test to verify failure**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: FAIL — no write occurs.

**Step 3: Write minimal implementation**

Use existing engine APIs to:
- read target page
- append or merge promoted semantic content deterministically
- add a timeline entry documenting the promotion
- emit promotion report rows

**Step 4: Run test to verify pass**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: PASS

### Task 5: Integrate with autopilot and cron docs

**Objective:** Make the command schedulable and discoverable.

**Files:**
- Modify: `src/commands/autopilot.ts`
- Modify: `docs/guides/cron-schedule.md`
- Modify: `docs/guides/operational-disciplines.md`
- Modify: `CLAUDE.md` if command list changes

**Step 1: Write failing test**

Add a test that verifies autopilot can call dream-cycle in the expected sequence or behind a flag.

**Step 2: Run test to verify failure**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: FAIL — integration absent.

**Step 3: Write minimal implementation**

Recommendation:
- add `--dream-cycle` or nightly-only path to autopilot
- document cron invocation explicitly:

```bash
0 2 * * * cd ~/RBrain && bun run src/cli.ts dream-cycle --repo ~/RBrain >> /tmp/dream-cycle.log 2>&1
```

**Step 4: Run test to verify pass**

Run:
```bash
bun test test/dream-cycle.test.ts
```
Expected: PASS

### Task 6: Full validation

**Objective:** Prove the command is safe enough for nightly use.

**Files:**
- Test: `test/promotion.test.ts`
- Test: `test/dream-cycle.test.ts`
- Test: any existing engine tests impacted

**Step 1: Run focused tests**

```bash
bun test test/promotion.test.ts test/dream-cycle.test.ts test/pglite-engine.test.ts
```
Expected: PASS

**Step 2: Run broader regression set**

```bash
bun test test/markdown.test.ts test/cli.test.ts test/config.test.ts
```
Expected: PASS

**Step 3: Manual dry-run verification**

```bash
bun run src/cli.ts dream-cycle --repo ~/RBrain --dry-run --json
```
Expected:
- zero crashes
- structured candidate list
- explicit promoted/skipped counts
- no writes in dry-run

## Suggested Initial Thresholds

Start conservative:
- recurrence >= 3
- evidence window = 14 days
- max promotions per run = 10
- skip any candidate with conflicting sources
- skip any candidate touching PHI-like strings
- skip any candidate with only one source type

## Risks and Tradeoffs

### Risk: false promotions
Mitigation:
- dry-run mode first
- conservative thresholds
- conflict rejection
- promotion cap per run

### Risk: semantic memory pollution
Mitigation:
- target only explicit concept pages or reviewed page-local merges
- add timeline entry for every promotion
- keep deterministic merge rules simple

### Risk: hidden behavior in cron
Mitigation:
- always emit JSON and log summaries
- write promotion report to disk or ingest log
- support `--dry-run` and `--no-embed`

### Risk: over-engineering
Mitigation:
- phase 1 deterministic only
- no embeddings or LLM summarization required for first ship
- defer cross-page synthesis until phase 2

## Verification Checklist

- [ ] `gbrain dream-cycle` exists as a first-class command
- [ ] promotion scoring is unit tested
- [ ] dry-run mode works and makes no writes
- [ ] real mode only promotes threshold-qualified patterns
- [ ] every promotion is auditable
- [ ] cron docs point at the real command, not a placeholder script
- [ ] autopilot integration is explicit and test-covered

## Recommended Execution Order

1. tests for promotion scorer
2. promotion core module
3. dream-cycle command scaffold
4. write path for promotions
5. autopilot integration
6. docs and cron invocation
7. focused test pass

## Open Questions

- Should page-local promotion write into `compiled_truth` directly in phase 1, or only create/update dedicated semantic concept pages?
- Should ingest log entries get salience fields first, or should phase 1 rely only on timeline evidence?
- Should autopilot call dream-cycle every loop, or should dream-cycle remain a separate nightly cron command only?

## Recommendation

Implement `gbrain dream-cycle` as a separate nightly command first. Do not bury it in autopilot’s main loop yet. That keeps the behavior auditable, schedulable, and easy to dry-run. Once stable, autopilot can optionally invoke it in a scheduled path.
