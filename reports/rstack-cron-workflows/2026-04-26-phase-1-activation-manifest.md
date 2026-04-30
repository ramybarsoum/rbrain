# RStack Cron Workflows — Phase 1 Activation Manifest

Date: 2026-04-26
Status: Ramy approved execution direction on 2026-04-27 / not yet registered with scheduler
Source basis: RBrain `HEARTBEAT.md`, GBrain cron docs, Max execution plan, Cole usefulness review.

## Rules

- Quiet hours: 23:00–08:00 America/Los_Angeles unless Ramy is active.
- Deep work: 09:00–12:00; suppress non-urgent notifications.
- No “nothing to report” messages.
- Notification jobs must write held output during quiet hours and fold it into morning briefing.
- Deterministic work should run as shell/Minions where possible; LLM judgment jobs stay as agent jobs.
- Every active job needs an owner, output destination, verification, and rollback.

## Phase 1 jobs

| Job | Schedule | Owner | Type | Output | Register now? | Notes |
|---|---:|---|---|---|---|---|
| `rbrain-live-sync` | `5,20,35,50 * * * *` active hours | Max | deterministic infra | silent unless failure | yes after scheduler check | Current HEARTBEAT already specifies this cadence. |
| `rstack-morning-briefing` | `55 7 * * 1-5` | Cole draft / Max verify | agent judgment | Discord `#cockpit` thread/top-level per cron policy | yes | Must be short: commitments, top 3 actions, blockers, compliance signoffs. |
| `rstack-eod-recap` | `55 17 * * 1-5` | Cole draft / Max verify | agent judgment | Discord `#cockpit` only if meaningful | yes | Include blind-spot guardrail if triggered. |
| `rbrain-dream-cycle` | `10 2 * * *` | Max | infra + memory | reports only; notify on failure/meaningful signal | yes after dry-run | Prefer `gbrain dream` / maintenance cycle. |
| `rbrain-weekly-maintenance` | `30 9 * * 0` | Max | deterministic + audit | report; notify only on issue | yes after doctor check | `doctor`, stale embeds, citations, backlinks, lint. |
| `rbrain-update-relevance-check` | `30 11 * * 1-5` | Cole summarize / Max safety | deterministic + judgment | notify only if worth pulling | yes | Run `gbrain check-update --json`; no auto-install. |

## Dependency-gated Phase 2 jobs

| Job | Dependency | Owner | Activation condition |
|---|---|---|---|
| `rstack-meeting-ingestion` | meeting source access / transcript source | Cole extract / Max durable writes | one manual meeting successfully processed with no false decisions |
| `rstack-email-triage` | email integration + read-only auth | Cole triage / Max memory updates | 5-email read-only test with correct links and no PHI leakage |
| `rstack-calendar-contact-sync` | calendar/contact integration | Max | verifies attendee enrichment and no duplicate people pages |

## Taste-gated Phase 3 jobs

| Job | Owner | Activation condition |
|---|---|---|
| `rstack-market-radar` | Cole | 2–3 manual runs produce actionable AllCare/AI Concierge implications |
| `rstack-content-opportunity-mining` | Cole draft / Max voice check | weekly pilot yields at least 2 usable Ramy POV drafts |
| `rstack-social-signal-collection` | Cole | source/API available and strict relevance filters proven |

## First verification checklist

1. Confirm scheduler mechanism: OpenClaw cron vs host crontab vs Minions.
2. Dry-run each notification job with quiet-hours gate forced on; verify output is held.
3. Dry-run morning briefing; verify it picks up held messages.
4. Run `gbrain doctor --json` before enabling dream/weekly maintenance.
5. Register one job at a time; observe one successful fire before enabling next.
6. Record active jobs and rollback steps in the final activation report.

## Rollback

- Disable scheduler entry for the job.
- Keep generated reports for audit unless Ramy asks for cleanup.
- If a job wrote bad RBrain state, Max owns citation-backed revert/repair.

## Current blocker

Ramy approved applying the Phase 1 direction on 2026-04-27. Max completed the authoritative scheduler inventory/cut table and confirmed Hermes cron as the scheduler target. The RLS blocker was fixed after Ramy approval: `gbrain doctor --json` now reports `status: "warnings"`, `health_score: 80`, and `rls: ok — RLS enabled on 27/27 public tables`.

Actual Phase 1 registration should still wait until these remaining blockers are cleared:

1. Existing scheduler entries must be consolidated/updated, not duplicated. In particular, the morning briefing must replace the existing 8 AM cluster.
2. The existing `rbrain-dream-cycle` must be repaired rather than re-created; it currently has an invalid inline shell command in its `script` field.
3. Supabase session pool pressure should be reduced by staggering/consolidating DB-heavy jobs.

See `reports/rstack-cron-workflows/2026-04-27-phase-1-scheduler-inventory-cut-table.md` and `reports/weekly-review/2026-04-27-gbrain-doctor-after-rls.json`.

## Applied artifacts

- `reports/rstack-cron-workflows/2026-04-27-phase-1-scheduler-inventory-cut-table.md`
- `reports/weekly-review/2026-04-27-gbrain-doctor-after-rls.json`
- `reports/weekly-review/2026-04-27-applied-opportunity-scan.md`
- `reports/weekly-review/2026-04-27-meeting-ingestion-dry-run-template.md`
- `drafts/content/2026-04-27-contact-data-is-ops-truth.md`
- `drafts/content/2026-04-27-a-queue-is-not-an-owner.md`
