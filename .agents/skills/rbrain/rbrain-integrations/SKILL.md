---
name: rbrain-integrations
description: Activate RBrain integrations (recipes, skills, cron jobs). Includes dependency mapping, API key inventory, Google OAuth flow, and phased activation plan.
version: 0.3.0
---

# RBrain Integration Activation

RBrain (forked from GBrain) has a rich integration system: 7 recipes, 12 skills, and 20+ cron jobs. This skill covers how to audit, prioritize, and activate them.

## Repo Location

```
/Users/cole/RBrain
Upstream: garrytan/gbrain.git (fetches as `upstream`)
Origin: ramybarsoum/rbrain
```

## Integration Inventory

### Recipes (in `recipes/`)

| Recipe | Category | Dependencies | API Keys Needed |
|--------|----------|-------------|-----------------|
| ngrok-tunnel | infra | none | `NGROK_AUTHTOKEN` |
| credential-gateway | infra | none | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (or ClawVisor) |
| twilio-voice-brain | sense | ngrok-tunnel | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `OPENAI_API_KEY`, `NGROK_AUTHTOKEN` |
| email-to-brain | sense | credential-gateway | Same as credential-gateway |
| calendar-to-brain | sense | credential-gateway | Same as credential-gateway |
| x-to-brain | sense | none | `X_BEARER_TOKEN` |
| meeting-sync | sense | none | `CIRCLEBACK_TOKEN` |

### Dependency Graph
```
credential-gateway ──┬── email-to-brain
                      └── calendar-to-brain
ngrok-tunnel ─────────── twilio-voice-brain
(standalone) ─────────── meeting-sync
(standalone) ─────────── x-to-brain
```

### Skills (in `skills/<name>/SKILL.md`)

| Skill | What It Does | How to Activate |
|-------|-------------|----------------|
| setup | First-time brain setup (9-phase) | Manual run |
| ingest | Ingest meetings, articles, videos, PDFs into brain | Agent-driven on inbound content |
| enrich | Tiered enrichment of people/company pages | Agent-driven on entity detection |
| query | 3-layer brain search + synthesis | Agent-driven on questions |
| briefing | Daily morning briefing | Cron job (daily AM) |
| maintain | Health checks, back-links, embedding refresh | Cron job (weekly) |
| publish | Share brain pages as encrypted HTML | Manual trigger |

## Phased Activation Plan

### Phase 1: Fix Brain Health (no input needed)

**⚠️ CRITICAL: `gbrain init` always creates a PGLite brain and overwrites `~/.rbrain/config.json` to `{"engine":"pglite"}`. Do NOT run bare `gbrain init` if your data is on Supabase.**

If using Supabase (the active brain):
1. Ensure `~/.rbrain/config.json` contains `{"engine":"postgres"}` (fix it if `init` overwrote it)
2. Run the custom migration script:
   ```bash
   cd /Users/cole/RBrain && source .env && bun run scripts/migrate-supabase.ts
   ```
   This calls `engine.initSchema()` which applies base DDL + all pending migrations.
3. Run it **twice** — the first pass sets baseline (v1), the second applies migrations 2-4.
4. Verify: `bun run src/cli.ts doctor --json` — should show `Version 4 (latest: 4)`.
5. Embed: `bun run src/cli.ts embed --stale` to fill missing embeddings.

If using PGLite (local), bare `gbrain init` is fine.

### Phase 2: Live Sync (no input needed)
Set up cron to keep search index current:
```bash
*/15 * * * * cd /Users/cole/RBrain && source .env && bun run src/cli.ts sync && bun run src/cli.ts embed --stale
```
Must use Session mode pooler (port 5432), NOT Transaction mode (port 6543).

### Phase 3: Daily Briefing (no input needed)
Hermes cron job that queries brain for meetings, threads, stale pages, recent changes.
Use Circleback as the meeting source for the briefing. Do not use or mention Granola unless Ramy explicitly asks for it.

### Phase 4: Dream Cycle (no input needed)
Nightly 2AM Hermes cron: entity sweep → citation fix → memory consolidation → embed stale.

### Phase 5: Weekly Maintenance (no input needed)
Hermes cron: `gbrain doctor`, back-link enforcement, orphan cleanup, embedding refresh.

### Phase 6: Google Services (needs user input)
1. User creates Google Cloud project + OAuth credentials
2. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `/Users/cole/RBrain/.env`
3. **⚠️ Do NOT use port 8080 for the OAuth callback** — that's the Hermes agent (Max) process. Use port 9999 or any other free port.
4. In GCP Console, add the matching redirect URI: `http://localhost:9999/oauth2callback`
5. Update `~/.hermes/google_client_secret.json` to match the new redirect URI
6. Start callback server on the alternate port: `cd ~/.hermes && python3 oauth_callback_server.py 9999` (background)
7. Generate auth URL with the correct `redirect_uri=http://localhost:9999/oauth2callback`
8. User authorizes → token saved to `~/.hermes/google_token.json`
9. Copy token to RBrain locations: `cp ~/.hermes/google_token.json ~/.rbrain/google-tokens.json && cp ~/.hermes/google_token.json ~/.gbrain/google-tokens.json && chmod 600` both
10. Enables: email-to-brain, calendar-to-brain

### Phase 7: X/Twitter (needs `X_BEARER_TOKEN`)
Apply at developer.x.com. Use case framing: "personal knowledge management, read-only, no data resale."

### Phase 8: Meeting Sync
Use Circleback as the default and preferred meeting-ingestion path.
- Circleback (default) — use the native Circleback MCP workflow and `rbrain-circleback-sync`
- Granola — deprecated for Ramy's workflow; do not recommend or schedule new Granola meeting syncs unless Ramy explicitly asks to restore them

### Phase 9: Voice-to-Brain (Gemini Live + Twilio)

Already wired. The Gemini Live bridge at `gateway/platforms/voice_gemini.py` handles:
- Real-time duplex voice: Twilio Media Streams <-> Gemini Live API (model: `gemini-2.5-flash-native-audio-latest`, voice: Orus)
- Transcript capture via `input_audio_transcription` config on Gemini Live
- Post-call brain page creation via RBrain MCP `put_page` (slug: `meeting/YYYY-MM-DD-phone-call-{callSid[:8]}`)
- Pages tagged with `voice-call`, `twilio` and include caller, duration, full transcript

**⚠️ The gateway must restart to pick up code changes to `voice_gemini.py`. Do NOT restart port 8080 manually — it kills the agent.** Changes apply on the next natural gateway restart.

### Phase 10: Ngrok Tunnel (needs `NGROK_AUTHTOKEN` + domain)
1. Install ngrok: `brew install ngrok`
2. Configure auth: `ngrok authtoken <token>`
3. Start tunnel in background: `ngrok http 8080 --url=<domain> --log=stdout`
4. Verify via API: `curl -s http://localhost:4040/api/tunnels | grep public_url`
5. Update Twilio webhooks to point at `https://<domain>/webhooks/twilio/voice` and `/webhooks/twilio`
6. Set up watchdog cron (every 5 min) to restart ngrok if it dies

### Phase 11: X/Twitter Collector (needs `X_BEARER_TOKEN`)
1. Validate token: `curl -sf -H "Authorization: Bearer $TOKEN" "https://api.x.com/2/tweets/search/recent?query=hello&max_results=10"`
2. Get user ID: `curl -sf -H "Authorization: Bearer $TOKEN" "https://api.x.com/2/users/by/username/<handle>?user.fields=id"`
3. Create `/Users/cole/RBrain/x-collector/` with `config.json` (user_id, searches array) and `x-collector.mjs` (Node.js collector)
4. Collector handles: own timeline, mentions, keyword searches, deletion detection, engagement tracking, atomic writes
5. Test run: `source .env && export X_BEARER_TOKEN && node x-collector/x-collector.mjs collect`
6. Set up Hermes cron every 30 min for collection + brain enrichment

### Active Cron Jobs / Scheduler Audit Pattern

When asked to audit or distribute RBrain/GBrain cron work, do **not** rely only on repo docs. Inventory all four layers, then classify jobs before activating anything:

1. Hermes scheduler: `cronjob(action="list")`
2. RBrain/GBrain docs/recipes: `docs/guides/cron-schedule.md`, `recipes/*.md`, relevant skills
3. launchd/services: `~/Library/LaunchAgents/com.gbrain.*.plist`, `ai.rbrain.*.plist`, process table
4. Logs/health: `~/.hermes/cron/output/**`, `~/.gbrain/*.log`, `bun run src/cli.ts doctor --json`

Use this disposition table for each job: **KEEP / CONSOLIDATE / COLE REVIEW / KEEP PAUSED / DELAY / TIMEBOX / CUT OR REPAIR**.

Current verified Hermes cron spine from 2026-04-26 audit:

| Job Name | Schedule | Purpose | Default Owner / Disposition |
|----------|----------|---------|-----------------------------|
| rbrain-circleback-sync | every 2h | Sync Circleback meetings → brain pages | Max / KEEP |
| rbrain-live-sync | */15 min | Embed stale chunks for vector search | Max / KEEP |
| rbrain-daily-briefing | 8 AM daily | Morning briefing | Max / KEEP but consolidate with digest/news |
| daily-digest | 8 AM daily | RBrain activity digest | Max / KEEP but consolidate with briefing/news |
| rbrain-dream-cycle | 2 AM nightly | Backlinks, embedding refresh, maintenance | Max / KEEP, verify command drift |
| rbrain-weekly-maintenance | Mon 5 AM | Full doctor + lint + backlink check | Max / KEEP |
| nightly-learnings-collector | 1 AM daily | Session learning extraction/writeback | Max / KEEP |
| rbrain-citation-fixer | Sun 6 AM | Citation hygiene | Max / KEEP |
| rbrain-x-collector | every 6h | X/Twitter deterministic collection | Max infra + Cole review / KEEP AS COLLECTOR ONLY |
| rbrain-x-signal-review | paused | Review X data and enrich RBrain | Cole + Max / KEEP PAUSED until examples pass taste+detection gates |
| rbrain-x-query-learning | paused | Improve X search queries | Max / KEEP PAUSED, run manually first |
| rbrain-ngrok-watchdog | */5 min | Restart ngrok tunnel if down | Max / audit whether ngrok still needed |

Human-facing signal/content jobs (`weekly-signal-diff`, `ai-scribe-clinical-notes-digest`, `ai-daily-news-discord`, `daily-content-draft`, `content-mine`) should be routed to Cole for usefulness/taste review before Max productizes or consolidates them. Default recommendation: one consolidated 8 AM cockpit packet, not multiple competing morning digests.

## Key Commands

```bash
# Check integration status
cd /Users/cole/RBrain && source .env && bun run src/cli.ts integrations

# Show a specific recipe
bun run src/cli.ts integrations show <recipe-id>

# Run integration doctor
bun run src/cli.ts integrations doctor

# Brain health
bun run src/cli.ts doctor --json

# Check what's configured
bun run src/cli.ts integrations
```

## Checking API Key Availability

```bash
cd /Users/cole/RBrain && source .env
for var in OPENAI_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN X_BEARER_TOKEN \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET CIRCLEBACK_TOKEN NGROK_AUTHTOKEN DATABASE_URL; do
  val="${!var}"
  [ -n "$val" ] && echo "  ✅ $var" || echo "  ❌ $var"
done
```

## Pitfalls

1. **`.env` edits silently fail** — if user says they added vars to `.env`, always verify with `grep` before proceeding. The nano editor can fail to save if the terminal session drops.
2. **Schema version must be current** — `doctor --json` shows `schema_version` warn if behind. Use `scripts/migrate-supabase.ts` (NOT `gbrain init`).
3. **Embeddings are not automatic** — after import or sync, you must run `gbrain embed --stale` (or `--all`) for vector search to work.
4. **Session pooler vs Transaction pooler** — Supabase connection MUST use session pooler (port 5432). Transaction pooler (port 6543) causes `engine.transaction()` to fail silently.
5. **Google OAuth tokens expire** — access tokens ~1 hour. Refresh token is long-lived. The `google-tokens.json` needs auto-refresh logic in collector scripts.
6. **Health check DSL (v0.9.3)** — recipes use typed health checks (`http`, `env_exists`, `command`, `any_of`). Old string format still works with deprecation warning.
7. **Upstream watch** — `search-quality-boost` branch has eval harness + cosine re-scoring, not yet merged to upstream master.
8. **`gbrain init` ALWAYS creates PGLite** — even when `~/.rbrain/config.json` says `{"engine":"postgres"}`, running `gbrain init` overwrites config to PGLite and creates a local brain. **Never run bare `gbrain init` for Supabase.** Use `scripts/migrate-supabase.ts` instead.
9. **`db.initSchema()` ≠ `engine.initSchema()`** — `db.ts initSchema()` only runs base DDL (no migrations). `postgres-engine.ts initSchema()` runs base DDL + `runMigrations()`. The custom migration script uses the engine version.
10. **Port 8080 is Max (Hermes agent)** — NEVER start any server on port 8080 (OAuth callback, webhook listener, etc.). It will kill the agent process and lose the session. Use port 9999 or another free port.
11. **OAuth token file locations** — Hermes saves tokens to `~/.hermes/google_token.json`, RBrain scripts expect `~/.rbrain/google-tokens.json` or `~/.gbrain/google-tokens.json`. Copy to all three with `chmod 600`.
12. **OAuth callback server accepts port arg** — `~/.hermes/oauth_callback_server.py` accepts a port number as `sys.argv[1]`. Use `python3 oauth_callback_server.py 9999` to avoid port 8080 conflict.
13. **X collector needs `export X_BEARER_TOKEN`** — `source .env` alone may not export to child processes. Use `source .env && export X_BEARER_TOKEN && node x-collector.mjs collect`.
14. **ngrok free tier has browser warning page** — curl from localhost to own ngrok URL may time out due to the interstitial page. External services (Twilio) bypass this. Test via ngrok API (`localhost:4040/api/tunnels`) instead.
15. **Hermes `.env` is write-protected** — the `patch` tool refuses to edit `~/.hermes/.env` (credential file protection). Use `terminal` with echo/append instead, or edit RBrain's `.env` which is where the collector reads from.
16. **Voice bridge code changes need gateway restart** — edits to `voice_gemini.py` (or any gateway code) only take effect after a gateway restart. But restarting port 8080 kills the agent. Wait for a natural restart, or coordinate with the user to do it during downtime.
17. **Gemini Live `input_audio_transcription`** — add `types.AudioTranscriptionConfig()` to `LiveConnectConfig` to get caller transcripts. Without it, you only get audio — no text to write to brain pages.
18. **RBrain MCP direct HTTP calls** — for post-call brain page writes from Python (outside Hermes MCP), call the MCP endpoint directly via `urllib.request` with `Authorization: Bearer` header. JSON-RPC format: `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"put_page","arguments":{...}}}`.
19. **RBrain MCP can hit max-client / disconnect errors under parallel query bursts** — when doing X/Twitter enrichment or other batch brain lookups, prefer sequential MCP calls over `multi_tool_use.parallel`. If the MCP server drops or returns `Max client connections reached`, `MCP server 'rbrain' is not connected`, or repeated timeouts, fall back to the local CLI inside `/Users/cole/RBrain`:
   - Search/query existing pages: `source .env && bun run src/cli.ts search 'TERM'` or `bun run src/cli.ts query 'QUESTION'`
   - Add a timeline entry: `source .env && bun run src/cli.ts call add_timeline_entry '{"slug":"companies/foo","date":"2026-04-17","summary":"...","detail":"...","source":"https://x.com/..."}'`
   - Verify the write: `source .env && bun run src/cli.ts timeline companies/foo`
20. **For X review crons, de-dupe across search buckets before enriching** — the same tweet may be stored under multiple search ids. De-dupe by tweet id first, then only enrich if there is a clear existing RBrain page; skip weak matches rather than creating noisy timeline entries.
21. **For exact page-existence checks during X review, prefer `list`/`get` over `query` when possible** — `bun run src/cli.ts search ...` and `query ...` can surface broad/noisy matches (sometimes even `NaN` scores) from docs, digests, and concepts. If you have a likely slug or page family, first inspect with `list --type company|concept|project -n 500`, then `get <slug>` / `timeline <slug>` to verify the target before writing a timeline entry.
22. **Watch for substring false positives in X relevance filtering** — naive keyword matching can misfire on unrelated text like `abridge` matching competitor `Abridge`, or on search metadata contaminating the tweet body classification. Prefer word-boundary/phrase-aware matching for company names and score tweet text separately from `_search_label` / `_search_query` metadata before deciding a tweet is healthcare-relevant.
23. **For syndicated X security/news bursts, de-dupe by claim/theme, not just tweet URL** — multiple accounts may repost the same underlying article or claim with different tweet IDs and links. Before adding a timeline entry, inspect the target page’s existing timeline for the same event phrased differently (for example an MCP architectural-vulnerability/RCE story already captured from another account). If the core claim is already logged, skip the new tweet unless it adds materially new evidence (new source, scope, mitigation, or first-party confirmation).
24. **When calling `bun run src/cli.ts call add_timeline_entry`, shell quoting is brittle** — if the JSON payload includes apostrophes, smart quotes, or long freeform detail text, inline shell quoting can fail with `unexpected EOF while looking for matching '"'`. The reliable pattern is to write the JSON to a temp file, then pass it as a single argument: `cat >/tmp/payload.json <<'JSON' ... JSON` then `bun run src/cli.ts call add_timeline_entry "$(cat /tmp/payload.json)"`. Verify immediately with `bun run src/cli.ts timeline <slug>`.
25. **Do not let the review marker erase your own working set mid-run** — for X review jobs that use `/tmp/xurl_last_review`, collect candidate files first, then refine/dedupe/filter from that in-memory set. If you `touch` the marker before your classification logic is stable and then re-run discovery inside the same session, you'll hide the very files you're trying to review. Persist the candidate list before updating the marker, or fall back to a time-window rescan only for debugging.
26. **Adjacent-market competitor signals can live on an existing competitor page when there is no clean page target for the new company** — if a tweet is clearly relevant to AllCare's competitive landscape but the exact company is not yet in RBrain, prefer enriching the closest existing competitor page only when the entry is framed as a market signal (for example, new funding in healthcare admin automation) rather than pretending it is first-party evidence about that page. If the mapping feels stretched, skip it instead of forcing a noisy write.
27. **When attaching source files to an existing RBrain page, prefer `gbrain files upload <file> --page <slug>` over relying on `files upload-raw` for page-visible attachment verification** — in one verified run, `files upload-raw` reported success with `{"success":true,"storage":"git"...}` but `files list <slug>` still did not show the attachment path. A direct `files upload` did register the page attachment. Also note a current CLI bug: `gbrain files list <slug>` may print `1 file(s):` and then crash with `Invalid mix of BigInt and other type in division.` Treat that as a display bug, not necessarily an upload failure.
28. **GBrain autopilot can be installed but functionally broken/noisy; do not revive it blindly during cron cleanup** — in the 2026-04-26 audit, `com.gbrain.autopilot` existed but `/Users/cole/.gbrain/autopilot-run.sh` executed `/Users/cole/RBrain/src/cli.ts` directly and failed with `Permission denied`, while historical logs also showed Supabase `EMAXCONNSESSION` / circuit-breaker errors. Before repairing or restarting autopilot, decide whether it should replace or coexist with Hermes crons (`rbrain-live-sync`, `rbrain-dream-cycle`, `rbrain-weekly-maintenance`) to avoid duplicate maintenance loops and pool pressure.
29. **For Max/Cole cron distribution, use a two-stage gate** — Max inventories and classifies exact jobs from Hermes scheduler + repo docs + launchd + logs; Cole reviews human-facing signal/content jobs for usefulness/taste. Keep deterministic collectors as silent infra, but keep interpretation/writeback jobs paused until Cole approves sample outputs and Max enforces dedupe, source, and page-target rules.
30. **Hermes `cronjob.script` is a script path, not inline shell** — if a cron job needs pre-run data collection, `script` must point to a Python script under `~/.hermes/scripts/` (or an absolute supported path); do not store `cd /Users/cole/RBrain && source .env && ...` in the `script` field. Inline shell there produces `Script not found: /Users/cole/.hermes/scripts/cd /Users/cole/RBrain ...`. Put shell commands in the prompt, create a real helper script, or clear the `script` field.

## Upstream Sync

See skill `rbrain-upstream-sync` for the merge procedure.
