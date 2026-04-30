---
name: rbrain-circleback-sync
description: Sync Circleback meetings into RBrain pages with enrichment, cross-linking, and action items. Covers the full pipeline from Circleback MCP API to RBrain page creation.
version: 1.0.0
---

# Circleback → RBrain Meeting Sync

Pull meetings from Circleback MCP and ingest them as RBrain pages with full enrichment.

## Prerequisites

- Circleback MCP server configured in `~/.hermes/config.yaml` as:
  ```yaml
  mcp_servers:
    circleback:
      url: https://app.circleback.ai/api/mcp
      auth: oauth
  ```
- OAuth tokens cached at `~/.hermes/mcp-tokens/circleback.json` (if this file already exists, a new OAuth login flow is usually **not** needed)
- RBrain CLI available (`cd ~/RBrain && source .env && npx gbrain`)
- **mcporter CLI** (`/opt/homebrew/bin/mcporter`) — preferred for cron/unattended contexts since the native Python MCP API may not be available

## API Access Methods (use mcporter for cron jobs)

### Method 1: mcporter CLI (recommended for cron/unattended)
The native `tools.mcp_tool` Python API is NOT available in `execute_code` / cron contexts. Use `mcporter` instead:

```bash
# Ensure Circleback is in mcporter config (~/.mcporter/mcporter.json)
# The config needs a baseUrl and Authorization header with Bearer token

# List available tools
mcporter list circleback --schema

# Call tools
mcporter call circleback.SearchMeetings intent="..." startDate=2026-04-16 endDate=2026-04-23 pageIndex=0
mcporter call circleback.ReadMeetings intent="..." meetingIds='[123,456,789]'
mcporter call circleback.SearchActionItems intent="..." pageIndex=0
```

### Method 2: Python MCP API (interactive sessions only)
```python
import tools.mcp_tool as mcp
mcp.discover_mcp_tools()
```

### OAuth Token Refresh (unattended)

If Circleback returns **401 Unauthorized**, the OAuth token has expired. Refresh it automatically:

```python
import json, urllib.request, urllib.parse, os

home = os.path.expanduser("~")

with open(f"{home}/.hermes/mcp-tokens/circleback.client.json") as f:
    client = json.load(f)
with open(f"{home}/.hermes/mcp-tokens/circleback.json") as f:
    tokens = json.load(f)

data = urllib.parse.urlencode({
    "grant_type": "refresh_token",
    "refresh_token": tokens["refresh_token"],
    "client_id": client["client_id"],
}).encode()

req = urllib.request.Request(
    "https://app.circleback.ai/api/oauth/access-token",
    data=data, method="POST"
)
req.add_header("Content-Type", "application/x-www-form-urlencoded")

resp = urllib.request.urlopen(req, timeout=15)
new_tokens = json.loads(resp.read().decode())

# Save refreshed tokens
with open(f"{home}/.hermes/mcp-tokens/circleback.json", "w") as f:
    json.dump(new_tokens, f, indent=2)

# Update mcporter config with new access token
with open(f"{home}/.mcporter/mcporter.json") as f:
    config = json.load(f)
config["mcpServers"]["circleback"]["headers"]["Authorization"] = "Bearer " + new_tokens["access_token"]
with open(f"{home}/.mcporter/mcporter.json", "w") as f:
    json.dump(config, f, indent=2)
```

The OAuth metadata endpoint is: `https://app.circleback.ai/.well-known/oauth-authorization-server`

## Circleback Tool Schemas (Critical Gotchas)

### SearchMeetings
- **Required fields:** `intent` (string) and `pageIndex` (number)
- `searchTerm`, `startDate`, `endDate`, `tags`, `profiles`, `domains` are optional
- Returns **20 meetings per page** — paginate with incrementing `pageIndex`
- Keep the same search params across pages

### ReadMeetings
- Takes `meetingIds` (array of numbers) and `intent` (string)
- Returns full notes, attendees, action items, insights, tags, duration

### GetTranscriptsForMeetings
- Takes `meetingIds` (array) and `intent`
- Returns transcript chunks keyed by meeting ID (string keys, not numeric)
- Transcript quality varies — "Quick audio test" had nearly empty transcripts

### SearchActionItems
- **Required fields:** `intent` and `pageIndex`
- Returns 25 items per page
- Filter by `status` ("PENDING" or "DONE"), `searchTerms`, `assigneeProfileId`

### SearchTranscripts
- **Required fields:** `intent` and `searchTerm`
- Returns chunk-level matches with timestamps

## Pipeline Steps

### 1. Pull all meetings (mcporter CLI)

```bash
# Paginate through results (20 per page)
mcporter call circleback.SearchMeetings \
  intent="List recent meetings for RBrain sync" \
  startDate=2026-04-16 endDate=2026-04-23 pageIndex=0

# Continue with pageIndex=1 if 20 results returned
```

Returns JSON array of meeting objects with `id`, `name`, `createdAt`, `notes`, `attendees`.

### 2. Get full details (mcporter CLI)

```bash
mcporter call circleback.ReadMeetings \
  intent="Get full details for RBrain sync" \
  meetingIds='[8230051,8163163,8160355]'
```

Returns full notes, attendees, action items, insights, tags, duration.

### 3. Create RBrain pages

Slug pattern: `meeting-YYYY-MM-DD-{name-slugified}`

```bash
# IMPORTANT: Do NOT use --file flag — it silently does nothing (returns "skipped").
# Instead, pipe content via stdin with YAML frontmatter prepended:
cat /tmp/page.md | npx gbrain put "meeting-2026-04-20-topic"
```

Page content template:
```markdown
# {Meeting Name}

**Date:** YYYY-MM-DD
**Duration:** X min
**Source:** Circleback (Meeting ID: {id})
**Tags:** meeting, circleback

## Attendees
- Participant N (Circleback anonymizes names)

## Notes
{notes from Circleback}

## Action Items
- [STATUS] **Title** — assigned to {assignee}
  {description}

---
[Source: Circleback, YYYY-MM-DD]
```

### 4. Add tags

```bash
npx gbrain tag "{slug}" meeting circleback
```

### 5. Cross-link via timeline entries

`gbrain link` fails with Supabase constraint error. Use `timeline-add` instead:

```bash
# Bidirectional cross-referencing
npx gbrain timeline-add "existing-entity-slug" "2026-04-20" \
  "Discussed in Meeting Name ({meeting-slug}) — key takeaway summary"

npx gbrain timeline-add "meeting-slug" "2026-04-20" \
  "Key decisions: bullet 1, bullet 2, bullet 3"
```

### 6. Pull action items separately

```bash
mcporter call circleback.SearchActionItems intent="Get all action items" pageIndex=0
# Filter: status="PENDING" or status="DONE"
```

### 7. Slug resolution for existing pages

**Always check existing slugs before creating pages.** The slug generation is not deterministic — `gbrain` may normalize differently (e.g., "&" becomes "and"). Run:

```bash
cd ~/RBrain && source .env 2>/dev/null && npx gbrain list 2>&1 | grep 'meeting-YYYY-MM'
```

Map Circleback meeting IDs to existing slugs. Only generate new slugs for meetings without an existing page.

## Slug Generation for Meeting Pages

Use idempotent `meeting-YYYY-MM-DD-{slugified-name}` slugs. Strip common prefixes ("Ramy Barsoum and ", "AllCare.ai ", "AllCare ") from the meeting name before slugifying, since those are generic Circleback artifacts. For duplicate names (e.g., two "Ramy Barsoum and Amir Barsoum" meetings on different dates), the date prefix already disambiguates. Replace `&` with `and` first, then use `re.sub(r'[^\w\s-]', '', slug)` to strip ALL non-word characters (commas, colons, brackets, dots, etc. — not just dots). Collapse dashes and spaces. Always verify slugs via `gbrain list | grep meeting-YYYY-MM` before creating.

## Cron/execute_code Context Notes

When running this skill as a cron job or inside `execute_code`, each code block runs in an isolated Python process. **Variables do NOT persist between `execute_code` calls.** This means:

- You must re-fetch data (e.g., re-call `mcporter ReadMeetings`) in any block that needs it, or write intermediate results to temp files and re-read them
- `slug_map`, `all_details`, and other pipeline state must be rebuilt in each code block that references them
- The safest pattern is: fetch data, build pages, write temp files, create RBrain pages — all in as few `execute_code` calls as possible, preferring large single blocks over many small ones

## Pitfalls

1. **Attendee names are anonymized.** Circleback returns "Participant N" with `email: null`. You cannot resolve real identities from the API alone. Don't create person pages from Circleback attendee data.

2. **`gbrain link` is broken on Supabase.** The `add_link` operation fails with "there is no unique or exclusion constraint matching the ON CONFLICT specification." Use `timeline-add` for cross-referencing until the schema is fixed.

3. **RBrain MCP times out.** The `mcp__rbrain__*` tools frequently timeout (30s+). Use the CLI fallback: `cd ~/RBrain && source .env 2>/dev/null && npx gbrain <command>`. The `.env` sourcing is required or every command fails with "password authentication failed for user postgres."

4. **Circleback requires `intent`.** Every tool call needs an `intent` string describing why you're calling it. Omitting it returns a validation error.

5. **Meeting ID types.** `SearchMeetings` returns numeric IDs. `GetTranscriptsForMeetings` returns string-keyed results. Don't assume type consistency.

6. **`gbrain put` with `--file` overwrites.** Running the same put command twice updates the page content. Running without `--file` creates a stub. Always use `--file` for full content.

7. **Circleback search is broad.** Searching without `searchTerm` returns ALL meetings. Use `startDate`/`endDate` to narrow when doing incremental syncs.

8. **Transcripts can be empty.** Short or audio-quality meetings may return nearly empty transcripts. The `notes` field (summary) is more reliable than transcripts for actual content.

9. **`gbrain put` "skipped" is not an error.** When content hasn't changed, `gbrain put` returns `{"status": "skipped"}` — this means the page is up-to-date, not that something failed.

10. **Skip "Quick audio test" meetings.** Meetings with unintelligible transcripts and no substantive content should be skipped during ingestion.

11. **mcporter doesn't auto-configure Circleback.** The Hermes `config.yaml` has Circleback, but `mcporter` has its own config at `~/.mcporter/mcporter.json`. You must add the Circleback server there with the Bearer token for mcporter to access it. Token must be refreshed when it expires (see OAuth Token Refresh section).

12. **`gbrain put` needs `--tag` at creation time.** Tags passed via `gbrain put --tag` are set on creation. For existing pages that were "skipped" (content unchanged), you still need `gbrain tag` to add any new tags.

13. **`ReadMeetings` output can be very large — batch your calls.** Requesting 5–6 meetings at once can produce JSON responses exceeding stdout buffer limits in subprocess contexts (e.g., `execute_code`), causing truncation and `JSONDecodeError: Unterminated string`. Batch into groups of **2 meeting IDs** per call for safest results — even 3 can fail when notes contain Arabic/RTL text or rich formatting.

14. **`ReadMeetings` JSON output contains control characters.** Raw `json.loads()` will throw `JSONDecodeError: Invalid control character` on ReadMeetings responses. Always use `json_parse()` from `hermes_tools` (which uses `strict=False`) instead of stdlib `json.loads()`. This is especially true for meetings with Arabic/RTL text or rich formatting in notes/insights.

15. **Supabase pool size limit (15 connections) bites on rapid `gbrain` calls.** Running 3+ `timeline-add` or other `gbrain` commands in quick succession can exhaust the session pooler, returning `EMAXCONNSESSION max clients reached`. Add `sleep 5-8` between batches of 2-3 `gbrain` calls, or serialize them one at a time with brief pauses.

    **Critical workaround for cron/execute_code contexts:** When `gbrain put` and `gbrain get` run as *separate* `terminal()` calls, pages can silently disappear — `put` returns `{"status": "created_or_updated"}` but a subsequent `get` in a new terminal session returns `page_not_found`. This is caused by the Supabase session pooler dropping transactions between connections. **Fix:** chain `put` and immediate `get` verification in the *same* terminal command string using `&&`. For batch creation, chain 3-4 puts per single terminal call with `sleep 5` between them:
    ```bash
    cd ~/RBrain && source .env 2>/dev/null && sleep 3 && \
      cat /tmp/page1.md | npx gbrain put "slug-1" 2>&1 && sleep 5 && \
      cat /tmp/page2.md | npx gbrain put "slug-2" 2>&1 && sleep 5 && \
      cat /tmp/page3.md | npx gbrain put "slug-3" 2>&1
    ```
    This keeps all operations within a single DB session. Do **not** use separate `terminal()` calls for each `gbrain put` — pages will not persist reliably.

15. **`gbrain` slug normalization differs from simple slugify.** `AllCare.ai` becomes `allcareai` (dot stripped, no separator) not `allcare-ai`. Always check existing slugs via `gbrain list | grep` before generating new ones — don't assume your slugify logic matches gbrain's.

16. **`ReadMeetings` `insights` field is a dict, not a list.** Despite looking like an array in some responses, the `insights` field can be a dict (hash/object), so `insights[:200]` will throw `TypeError: unhashable type: 'slice'`. Use `str(insights)[:200]` or check `isinstance(insights, list)` before slicing.

17. **`ReadMeetings` `duration` is in seconds.** The field is a float in seconds (e.g., `3398.395` ≈ 57 minutes). Convert with `round(duration / 60)` for display in RBrain pages.

18. **`gbrain put` may fail with "column 'page_kind' of relation 'pages' does not exist".** GBrain v0.21+ expects a `page_kind` column in the `pages` table but the Supabase migration may not have added it. `gbrain apply-migrations` reports "up to date" without fixing it. Fix manually:
    ```bash
    psql "$DATABASE_URL" -c "ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_kind TEXT NOT NULL DEFAULT 'markdown';"
    ```
    After adding the column, `gbrain put` works normally. Check for this error at the start of every sync run.

19. **`~/.gbrain/config.json` can point to a pglite temp path after test runs.** If `gbrain list`, `gbrain put`, or `gbrain get` fail with "relation pages does not exist" but `psql "$DATABASE_URL" -c "\dt"` shows the `pages` table, check `~/.gbrain/config.json`. It should have `"engine": "postgres"` and a `"database_url"` key — not `"engine": "pglite"` with a temp path. Fix by rewriting the config:
    ```python
    import json
    config = {"engine": "postgres", "database_url": "<DATABASE_URL from ~/RBrain/.env>"}
    with open(os.path.expanduser("~/.gbrain/config.json"), "w") as f:
        json.dump(config, f, indent=2)
    ```
    Add this check at the start of every sync run — before any `gbrain` calls — because test suites or manual `gbrain init` runs can clobber the config.

20. **`gbrain tags <slug>` returns comma-separated strings, not one tag per line.** Parsing `tags` output by splitting on newlines gives a single string like `"circleback, concierge, meeting"`. Split on commas (and strip whitespace) to get individual tags.

21. **Slug collisions from prefix stripping.** Two meetings named "Ramy & Sakr and Amir Barsoum" and "Ramy Barsoum and Amir Barsoum" on the same date both strip to `amir-barsoum`. Always check for duplicate slugs after generation. For disambiguation:
    - **Keep distinguishing names** in the slug (e.g., `sakr-and-amir-barsoum` vs `amir-barsoum`) rather than stripping all prefixes aggressively
    - **Read existing page content** via `gbrain get "{slug}"` and match the `**Source:** Circleback (Meeting ID: XXXXX)` line to determine which Circleback meeting the existing page belongs to — then generate a different slug for the other meeting
    - As a last resort, append a short hash or counter

## Incremental Sync (re-runs on existing pages)

When re-running the sync, most meetings will already have RBrain pages. The incremental pipeline enriches existing pages rather than recreating them:

### 1. Check what exists

```bash
cd ~/RBrain && source .env 2>/dev/null && npx gbrain list 2>&1 | grep 'meeting-YYYY-MM'
```

### 2. Read full details from Circleback (for duration + tags)

Even if pages exist, call `ReadMeetings` to get:
- **`duration`** (in seconds — convert with `round(duration / 60)`)
- **`tags`** (e.g., `["Concierge"]` — propagate to RBrain via `gbrain tag`)

### 3. Enrich missing fields

For pages with `**Duration:** Unknown min`, do a targeted update:

```python
# Get current content, replace Unknown with actual duration, re-put
import time

for mid, slug in slug_map.items():
    get_result = terminal(f'cd ~/RBrain && source .env 2>/dev/null && npx gbrain get "{slug}" 2>&1')
    content = get_result["output"].strip()
    
    if "**Duration:** Unknown min" in content:
        updated = content.replace("**Duration:** Unknown min", f"**Duration:** {duration} min")
        # Write to temp file then pipe
        terminal(f"cat > /tmp/rbrain_{mid}.md << 'ENDOFFILE'\n{updated}\nENDOFFILE")
        terminal(f'cd ~/RBrain && source .env 2>/dev/null && cat /tmp/rbrain_{mid}.md | npx gbrain put "{slug}" 2>&1')
    time.sleep(3)  # Avoid Supabase pool exhaustion
```

### 4. Add missing tags

Circleback returns tags like `["Concierge"]`. Propagate to RBrain:

```bash
npx gbrain tag "{slug}" circleback concierge
```

### 5. Add timeline entries with key takeaways

Add a `timeline-add` entry per meeting summarizing the key topic/decisions. This provides searchable cross-references even when the page content hasn't changed:

```bash
npx gbrain timeline-add "meeting-slug" "2026-04-23" \
  "Sprint review: SMS setup, multi-tenant structure, team redistribution"
```

### What to skip on re-runs
- **Page creation** — if slug already exists, don't recreate
- **Content rewrite** — if notes/action-items are already populated, only update missing fields (duration)
- **"Quick audio test" meetings** — always skip these

## Future Improvements

- **Automate as cron job** — run daily to sync new Circleback meetings to RBrain
- **Incremental sync** — use `startDate` = last sync date to only pull new meetings
- **Schema fix** — fix the Supabase link table constraint to enable proper `gbrain link`
- **Attendee resolution** — cross-reference with existing RBrain person pages using meeting context (e.g., "Participant 5" in AllCare meetings is likely a known team member)
