# RBrain TODOs

Fork-specific decisions still pending. Keep this file in the fork only ... not for upstream.

---

## 1. Supabase Edge Functions — `supabase/functions/rbrain-mcp/` (9 files, ~1140L total)

### What each file does

| File | Lines | Purpose |
|---|---|---|
| `index.ts` | 82 | Hono + Streamable HTTP MCP transport entry point. The actual server. |
| `engine.ts` | 508 | Deno port of `src/core/postgres-engine.ts`. Exact SQL template literals preserved. |
| `tools.ts` | 208 | Registers 28 RBrain operations as MCP tools on the server. |
| `auth.ts` | 106 | Bearer token auth against `access_tokens` table. |
| `chunker.ts` | 106 | Recursive delimiter-aware chunker. Port of `src/core/chunkers/recursive.ts`. |
| `utils.ts` | 73 | Deno port of `src/core/utils.ts`. Web Crypto instead of node:crypto. |
| `embedding.ts` | 33 | OpenAI embedding wrapper for query-side. |
| `db.ts` | 23 | Postgres connection singleton (npm:postgres for SQL parity with CLI). |
| `deno.json` | 19 | Deno runtime config. |

### What it actually IS

A **complete rewrite of gbrain's MCP server in Deno (Supabase Edge runtime)**. Exposes RBrain's brain via HTTPS to remote agents (Hermes, cole-macbook agents, future agents) using bearer-token auth. Lets remote agents query the brain WITHOUT direct DB credentials.

### Why it exists

The local stdio MCP pattern (`scripts/rbrain-mcp-stdio.sh`) requires DB credentials on every machine that wants brain access. Cole-macbook running Hermes wants brain access too, but you don't want to ship Supabase pooler credentials to that machine. The edge function is a hosted MCP server that any agent can call over HTTPS with a token.

### Recommendation: KEEP

These 9 files together make ONE cohesive product (the hosted MCP server). They're a port, not a fork ... they intentionally mirror `src/core/postgres-engine.ts` and `src/core/operations.ts`. Dropping them means:
- Cole-macbook loses MCP integration
- Hermes can't run remote brain queries
- You'd have to re-implement either direct stdio MCP (with cred sharing) or some other transport

**Optional follow-up (per the rescue-2026-04-24 audit): relocate to a separate `rbrain-edge` repo.** They're an integration, not fork platform code. Out of `RBrain/` makes the fork smaller; into a separate repo makes deploys clearer. **Decision pending. Defer until upstream sync work settles.**

---

## 2. v0_archive migration — move to current schema

### Current state

Per CLAUDE.md, `v0_archive` schema in the same Supabase Postgres holds:
- 9.3k thoughts
- 1.7k learnings
- 1.5k follow-ups
- 1.3k decisions

These are OB-era (Open Brain) records preserved during the v0.20.x cutover. **CLAUDE.md rule: "DO NOT touch v0_archive without explicit instructions."**

### Goal

Migrate the four v0_archive tables into the current `public` schema. Each old type maps to a new shape:

| Old table | Likely new shape | Notes |
|---|---|---|
| `thoughts` (9.3k) | `pages` with `type: 'note'` OR timeline entries on existing pages | Need to inspect to see if they're standalone notes or annotations |
| `learnings` (1.7k) | `pages` with `type: 'concept'` or `'guide'` | Likely worth promoting to first-class pages |
| `follow_ups` (1.5k) | Could go to `daily-task-manager` queue (if structured) OR timeline entries | Depends on structure |
| `decisions` (1.3k) | `pages` with `type: 'decision'` (matches global CLAUDE.md decision journal pattern) | Strong fit |

### Action plan (use parallel subagents)

1. **Subagent A**: Inspect `thoughts` table schema + sample 20 rows → propose mapping to `pages`/`timeline` → output JSON migration spec
2. **Subagent B**: Same for `learnings`
3. **Subagent C**: Same for `follow_ups`
4. **Subagent D**: Same for `decisions`
5. **Aggregator**: Review the four specs, identify cross-table foreign keys (do follow-ups reference thoughts?), produce unified migration script
6. **Then**: write migration v28+ with handler that does the data move (deterministic, idempotent, dry-run-able)

### When to do this

NOT NOW. Real engineering project (~10-20 hours). Prerequisites:
- Upstream PRs #410/411/412 land or are clearly stale (so we know what fork-platform divergence remains)
- A clean conversation with focus on this migration
- Subagents dispatched in parallel (per item 5 above)

### Open questions

- Should this migration be a fork-only one-off, or should it ship as an upstream-relevant migration tool? Upstream gbrain doesn't have v0_archive to migrate, but the *pattern* (transform-old-schema-to-new) could be a reusable utility.
- What happens to old IDs? Preserve as a column? Generate stable slugs from the old content?

---

## 3. `scripts/skillify-nightly.ts` — quality assessment

### Current state

- **245 lines**, has tests at `test/skillify-nightly.test.ts` (23 expects)
- Top-level docstring documents purpose + CLI flags
- Self-validates: ran cleanly with "✓ All skills healthy — no errors."
- Composes with upstream API (calls `checkResolvable` from `src/core/check-resolvable.ts`)
- JSON + human-readable output modes
- Exit 0 healthy / exit 1 issues found (CI-friendly)

### Quality bar against the 6 Shippable Standard gates

| Gate | Pass? | Notes |
|---|---|---|
| CONTRACT | ✓ | Has `CliArgs` interface, structured JSON output (though no `schema_version` on the output). Add `schema_version: '1'` for full compliance |
| IDEMPOTENCY | ✓ | Read-only script; running N times = same output |
| OBSERVABILITY | ✓ | Both human + JSON modes; clear exit codes |
| INTEGRATION | ✓ | Uses `checkResolvable` (the upstream-published API). Doesn't bypass anything |
| PROOF | ✓ | Tested end-to-end on the live RBrain skills directory; passes |
| SCOPE | ✓ | Docstring matches behavior. No over-claims |

### Recommendation: KEEP

It's well-built fork-original tooling. **Could even be upstream-PR-able** if Garry's interested in nightly resolver health monitoring — the script is generic enough.

### Action items

- [ ] Add `schema_version: '1'` to the JSON output for full CONTRACT gate compliance
- [ ] Optionally: open upstream PR proposing it as a stock skill-quality monitor
- [ ] Wire into your nightly cron (if not already) — currently only invokable manually

---

## 4. ~~`skills/conventions/router-pattern.md`~~ — DROPPED 2026-04-25

### Resolution

**File deleted.** It was a 120L doc describing how AGENTS.md / RESOLVER.md / skills reference each other. Realized it's just describing what the structure already is ... not a rule that adds value, just words about a self-evident pattern. Garry's gbrain works this way; the structure speaks for itself. Documenting it was redundant fork bloat.

### What got removed

- `skills/conventions/router-pattern.md` (file deleted)
- `skills/RESOLVER.md` lead-in paragraph that pointed at it (NON-NEGOTIABLE callout removed)

### Lesson preserved

Future fork-conventions: ask "is this rule self-evident from the structure / from existing docs (AGENTS.md, RESOLVER.md, skill template)?" If yes, do NOT codify it as a separate convention file. Conventions are for rules that are NOT self-evident (e.g., `quality.md` notability gate, `cron-via-minions.md` invocation pattern). The structure-describes-itself rule belongs in the structure, not in a parallel doc.

---

## Meta-priorities

| Item | Effort | Risk | Priority |
|---|---|---|---|
| #1 Supabase edge functions | Decision only (relocate to separate repo? defer.) | Low | Low |
| #2 v0_archive migration | 10-20h engineering with subagents | Medium | **High eventually**, defer until upstream sync settles |
| #3 skillify-nightly add schema_version | 30 min | Low | Low (quick win) |
| ~~#4 router-pattern.md~~ | ~~Resolved 2026-04-25~~ | — | — |

**Suggested next step (when this conversation's context is rescued and resumed):** start with item #2 (v0_archive migration), since it's the highest-value engineering work and benefits from a fresh focused conversation.
