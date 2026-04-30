# Applied Opportunity Scan — 2026-04-27

Source: Ramy asked Cole to apply the Apr 27 weekly opportunity scan in `#weekly-review`.

## Applied now

### 1. RStack operating spine moved from scan → execution queue

Decision applied: activate the operating spine before any scout layer.

Execution queue:
1. `rstack-morning-briefing` — daily 07:55 PT, short, decision/blocker focused.
2. `rstack-eod-recap` — weekday 17:55 PT, only if meaningful.
3. `rbrain-dream-cycle` — silent nightly infra, reports only unless failure/surprising signal.
4. `rbrain-weekly-maintenance` — silent weekly doctor/embed/citation/backlink/lint check.
5. `rbrain-update-relevance-check` — notify only for relevant upstream improvements.

Guardrail retained: do **not** activate market/content/social scout crons until manual pilots prove signal.

Current activation blocker: `reports/rstack-cron-workflows/2026-04-26-phase-1-activation-manifest.md` still says not to register actual scheduler entries until Max completes authoritative inventory/cut table and confirms scheduler target/dependencies. This prevents duplicate cron spam.

### 2. Content lane test queued with drafts

Drafted the first two operator POV posts from the expanded content lanes:
- `drafts/content/2026-04-27-contact-data-is-ops-truth.md`
- `drafts/content/2026-04-27-a-queue-is-not-an-owner.md`

Rules applied:
- Keep as drafts only.
- No external posting without Ramy approval.
- Voice: operator-first, concrete, anti-hype, no WIP overclaiming.

### 3. Meeting ingestion dry-run package prepared

Prepared the dry-run shape for one recent meeting before cron activation:
- `reports/weekly-review/2026-04-27-meeting-ingestion-dry-run-template.md`

Activation rule: one meeting must be processed manually into decisions, action items, risks, and proposed RBrain updates before enabling a recurring ingestion job. Max should hard-gate durable decision writes.

### 4. RBrain reliability lane made explicit

Immediate reliability actions queued:
1. Run `gbrain doctor --json` before enabling dream/weekly maintenance.
2. Keep Circleback as canonical meeting source.
3. Treat `embed --stale` pool exhaustion as retryable unless repeated.
4. Keep MCP/tool governance and audit-trail work in the weekly watchlist because it directly affects Hermes/RBrain trust.

## Next concrete moves

1. Ask/route Max for the scheduler inventory/cut-table verification needed to unblock actual cron registration.
2. Run one meeting ingestion dry run using Circleback/source notes.
3. Review the two content drafts in `#cockpit`; publish nowhere until Ramy approves.
4. After Max verifies scheduler target, register Phase 1 jobs one at a time with dry-runs and rollback notes.

## Verification run — `gbrain doctor --json`

Saved: `reports/weekly-review/2026-04-27-gbrain-doctor.json`

Result: unhealthy, health score 60.

Key findings:
- RLS failure: `code_edges_chunk` and `code_edges_symbol` do not have Row Level Security enabled.
- Embeddings are healthy: 100% coverage, 0 missing.
- Supervisor, connection, pgvector, schema version, queue health, markdown completeness are OK.
- Warnings: resolver overlap / DRY warnings, graph coverage 97% entity links but 2% timeline, brain score 47/100, one double-encoded `files.metadata` row.

Action implication:
- Do not enable weekly maintenance/dream-cycle as “green” until Max verifies/fixes the RLS issue or explicitly marks those tables exempt per `docs/guides/rls-and-you.md`.
- Embedding refresh does not look blocked right now.
