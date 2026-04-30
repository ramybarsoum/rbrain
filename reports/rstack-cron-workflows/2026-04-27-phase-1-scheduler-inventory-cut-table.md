# Phase 1 Scheduler Inventory + Cut Table — 2026-04-27

Status: completed inventory / RLS fixed / no new jobs registered
Owner: Max
Source request: Cole handoff in RStack HQ `#agent-handoffs`, Phase 1 RStack activation verification.

## Answer-first

Do **not** register new Phase 1 jobs yet. The authoritative scheduler target should be the existing Hermes cron scheduler, but Phase 1 should proceed by **consolidating/updating existing jobs one at a time**, not by adding duplicates.

RLS blocker was fixed after Ramy approval on 2026-04-27:

- Applied:
  ```sql
  ALTER TABLE "public"."code_edges_chunk" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "public"."code_edges_symbol" ENABLE ROW LEVEL SECURITY;
  ```
- Verified: `gbrain doctor --json` now reports `status: "warnings"`, `health_score: 80`, and `rls: ok — RLS enabled on 27/27 public tables`.
- Saved verification output: `reports/weekly-review/2026-04-27-gbrain-doctor-after-rls.json`.

Remaining blockers before Phase 1 job registration:

1. The existing `rbrain-dream-cycle` Hermes cron has a bad `script` field: Hermes treats `script` as a path under `~/.hermes/scripts`, but the job currently stores an inline shell command there. Latest runs show `Script not found: /Users/cole/.hermes/scripts/cd /Users/cole/RBrain ...`.
2. There is already a dense morning cluster at 8–9 AM (`rbrain-daily-briefing`, `daily-digest`, `ai-daily-news-discord`, `daily-content-draft`, `weekly-signal-diff` on Mondays). The new `rstack-morning-briefing` must replace/consolidate, not add another notification.
3. Supabase session pool pressure is real: `~/.gbrain/supervisor.err` shows repeated `EMAXCONNSESSION` and circuit-breaker events; weekly maintenance also reported pool saturation.

## Evidence checked

- RBrain operating files:
  - `/Users/cole/RBrain/SOUL.md`
  - `/Users/cole/RBrain/RESOLVER.md`
  - `/Users/cole/RBrain/skills/RESOLVER.md`
  - `/Users/cole/RBrain/skills/cron-scheduler/SKILL.md`
  - `/Users/cole/RBrain/skills/maintain/SKILL.md`
  - `/Users/cole/RBrain/docs/guides/rls-and-you.md`
- Cole handoff artifacts:
  - `reports/rstack-cron-workflows/2026-04-26-phase-1-activation-manifest.md`
  - `reports/weekly-review/2026-04-27-applied-opportunity-scan.md`
  - `reports/weekly-review/2026-04-27-gbrain-doctor.json`
- Scheduler layers:
  - Hermes cron inventory: 21 jobs
  - Host crontab: no user entries found
  - launchd: `com.gbrain.jobs-supervisor`, `com.gbrain.autopilot`, `ai.rbrain.voice-agent`
  - Processes: `ngrok http 8080`, RBrain voice-agent, system cron
  - Logs: `~/.hermes/cron/output/**`, `~/.gbrain/supervisor.err`, `~/.gbrain/autopilot.err`

## Scheduler target

| Layer | Target decision | Why |
|---|---|---|
| Hermes cron | **Authoritative for Phase 1** | Already has RStack delivery context, local output, pause/update controls, and existing RBrain jobs. Avoid introducing another scheduler. |
| Minions / GBrain supervisor | **Keep as worker substrate, not notification scheduler** | `com.gbrain.jobs-supervisor` is running and supports deterministic handlers. Use it for durable queue work where available, but do not let it duplicate Hermes jobs. |
| Host crontab | **Do not use** | No current entries; adding another layer increases drift. |
| launchd autopilot | **Do not revive blindly** | `com.gbrain.autopilot` is loaded but failing/noisy; logs show git divergence, missing OPENAI_API_KEY in its environment, ON CONFLICT errors, and pool pressure. It overlaps with Hermes live-sync/dream/weekly maintenance. |
| OpenClaw cron | **Do not use for Phase 1** | Not needed while Hermes cron is active. Avoid cross-agent duplicate loops. |

## Active Hermes cron cut table

| Job | Current schedule | State | Disposition | Action before/after Phase 1 |
|---|---:|---|---|---|
| `rbrain-circleback-sync` | every 120m | enabled | **KEEP** | Keep as canonical Circleback sync. When Phase 2 `rstack-meeting-ingestion` is ready, consolidate with this job instead of adding a duplicate. |
| `rbrain-live-sync` | `*/15 * * * *` | enabled | **KEEP / RETARGET** | Keep the existing job; retarget later to `5,20,35,50 * * * *` plus active-hours/quiet-hours behavior if supported. Do not register a second live sync. |
| `rbrain-daily-briefing` | `0 8 * * *` | enabled | **CONSOLIDATE** | Replace/merge into `rstack-morning-briefing` at `55 7 * * 1-5`; do not run both. |
| `daily-digest` | `0 8 * * *` | enabled | **CONSOLIDATE** | Fold useful RBrain activity into one 07:55 cockpit packet. Current 8:00 collision should be removed or paused after replacement passes dry-run. |
| `rbrain-daily-task-prep` | `15 6 * * 1-5` | enabled | **CONSOLIDATE** | Too early for quiet-hours policy. Fold into 07:55 morning briefing. |
| `ai-daily-news-discord` | `0 8 * * *` | enabled | **COLE REVIEW / CONSOLIDATE** | Human-facing news digest; keep only if Cole confirms signal. Should not collide with cockpit packet. |
| `weekly-signal-diff` | `0 9 * * 1` | enabled | **COLE REVIEW** | Keep as a reviewed human-facing signal job or fold into weekly cockpit; do not productize further without taste gate. |
| `daily-content-draft` | `0 9 * * *` | enabled | **COLE REVIEW** | Human-facing content draft. Keep draft-only, but not part of Phase 1 operating spine. |
| `content-mine` | `5 19 * * 1,4` | enabled | **COLE REVIEW / TIMEBOX** | Interactive/content job; keep separate only if Ramy still wants it. Not Phase 1 infra. |
| `ai-scribe-clinical-notes-digest` | `0 7 * * 2,5` | enabled | **COLE REVIEW** | Human-facing market digest. Keep only if useful; not a blocker for RStack operating spine. |
| `rbrain-dream-cycle` | `0 2 * * *` | enabled | **CUT OR REPAIR** | Do not mark green. Clear invalid `script` field or replace with a real `~/.hermes/scripts/...` helper, then dry-run after RLS fix. Stagger to `10 2 * * *`. |
| `rbrain-weekly-maintenance` | `0 5 * * 1` | enabled | **KEEP / RETARGET AFTER RLS** | Existing weekly maintenance found the same RLS issue and pool saturation. Keep paused/unchanged until RLS is fixed; then retarget to approved Sunday 09:30 or Monday 05:00 if Ramy prefers silent pre-work. |
| `nightly-learnings-collector` | `0 1 * * *` | enabled | **KEEP** | Max-owned learning extraction. Monitor for DRY resolver warning, but not a Phase 1 duplicate. |
| `rbrain-citation-fixer` | `0 6 * * 0` | enabled | **KEEP / POSSIBLY FOLD** | Keep for now. It may become a sub-step of weekly maintenance after weekly job is repaired. |
| `rbrain-x-collector` | `0 */6 * * *` | enabled | **KEEP AS COLLECTOR ONLY** | Deterministic collector only. No interpretation/writeback expansion until sample quality gates pass. |
| `rbrain-x-signal-review` | `30 */6 * * *` | paused | **KEEP PAUSED** | Requires Cole taste/detection gate before activation. |
| `rbrain-x-query-learning` | `20 6 * * *` | paused | **KEEP PAUSED** | Run manually first; do not resume as part of Phase 1. |
| `rbrain-ngrok-watchdog` | `*/5 * * * *` | enabled | **DELAY / AUDIT NEED** | Currently watching ngrok for Hermes gateway on port 8080. Voice-to-Brain uses Cloudflared → port 3001, not ngrok. Keep until Ramy confirms ngrok dependency; do not expand. |
| `friday-cpo-operating-review` | `0 23 * * 5` | enabled | **KEEP / QUIET-HOURS REVIEW** | Existing reminder; 23:00 violates quiet-hours default unless intentionally late. Review separately. |
| `phase-5-rbrain-reminder` | `0 9 * * 5` | enabled | **TIMEBOX / CUT AFTER OBSOLETE** | Reminder job; remove after Phase 5 decision is no longer relevant. |
| `phase-5-rbrain-reminder-midweek` | `0 9 * * 3` | enabled | **TIMEBOX / CUT AFTER OBSOLETE** | Same as above. |

## launchd / process cut table

| Item | Status | Disposition | Evidence / action |
|---|---|---|---|
| `com.gbrain.jobs-supervisor` | running, pid 79670 | **KEEP** | Doctor reports supervisor healthy; launchctl shows running. Logs still show pool-pressure health errors, so avoid adding more concurrent DB jobs. |
| `com.gbrain.autopilot` | loaded but exit code 126 | **CUT OR REPAIR, do not revive blindly** | Overlaps with Hermes maintenance. `~/.gbrain/autopilot.err` shows git pull divergence, ON CONFLICT errors, missing `OPENAI_API_KEY` in launchd env, and embedding failures. |
| `ai.rbrain.voice-agent` | running | **KEEP** | Independent Voice-to-Brain launchd service. Do not touch. |
| `ngrok http 8080` | running | **AUDIT DEPENDENCY** | Existing watchdog keeps it up for Hermes gateway/API; not used by Voice-to-Brain. Do not kill/restart port 8080. |
| user crontab | empty | **KEEP EMPTY** | No user crontab entries found. |

## Phase 1 registration plan — one at a time

Register/update in this order only after the blocker conditions are satisfied:

1. **Fix RLS** for `code_edges_chunk` and `code_edges_symbol`, then rerun `gbrain doctor --json`.
2. **Repair existing `rbrain-dream-cycle`**, do not add a new dream job. Remove the invalid inline `script` field or replace it with a real script file. Dry-run once and save output.
3. **Consolidate morning jobs** into `rstack-morning-briefing` at `55 7 * * 1-5`; pause/retire `rbrain-daily-briefing`, `daily-digest`, and `rbrain-daily-task-prep` only after the new packet produces one acceptable dry-run.
4. **Register `rstack-eod-recap`** at `55 17 * * 1-5`, with meaningful-output-only behavior.
5. **Retarget `rbrain-live-sync`** if/when active-hours gating exists. Until then, keep the existing single live-sync job and do not duplicate it.
6. **Repair/retarget weekly maintenance** after RLS is green and dream-cycle is stable.
7. **Add `rbrain-update-relevance-check`** last; it is non-critical and should notify only on meaningful upstream changes.

## RLS diagnosis

Live doctor command run on 2026-04-27:

```bash
cd /Users/cole/RBrain
set -o allexport; source .env; set +o allexport
bun run src/cli.ts doctor --json
```

Result:

- status: `unhealthy`
- health_score: `60`
- RLS: `fail`
- failing tables: `code_edges_chunk`, `code_edges_symbol`
- schema: `Version 28 (latest: 28)`
- embeddings: `100% coverage, 0 missing`

Database inspection:

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       COALESCE(obj_description(c.oid,'pg_class'),'') AS comment,
       pg_total_relation_size(c.oid) AS bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('code_edges_chunk','code_edges_symbol');
```

Observed:

| table | relrowsecurity | force RLS | comment | size |
|---|---:|---:|---|---:|
| `code_edges_chunk` | false | false | empty | 49152 bytes |
| `code_edges_symbol` | false | false | empty | 40960 bytes |

`current_user` is `postgres` and has `rolbypassrls = true`, so enabling RLS should not break RBrain's service-role access. The repo schema already expects these two tables to have RLS enabled (`src/schema.sql` lines 654–657). There is no exemption comment.

Recommended fix, pending approval because this is a DB permission change:

```sql
ALTER TABLE "public"."code_edges_chunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."code_edges_symbol" ENABLE ROW LEVEL SECURITY;
```

Then rerun:

```bash
cd /Users/cole/RBrain && set -o allexport; source .env; set +o allexport; bun run src/cli.ts doctor --json
```

## Final cut/keep position

- **Scheduler target confirmed:** Hermes cron, with GBrain/Minions as worker substrate where applicable.
- **Registration stance:** update/consolidate existing jobs; do not register duplicate Phase 1 jobs.
- **Maintenance green?** No. RLS must be fixed or explicitly exempted before weekly/dream maintenance can be called green.
- **Autopilot stance:** do not revive until a separate decision chooses Hermes cron vs GBrain autopilot as the single maintenance owner.
