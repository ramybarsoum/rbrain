---
name: rbrain-x-collector
description: Run the X/Twitter collector for RBrain using xurl (official X API CLI), analyze collected tweets, and enrich brain pages with notable findings. Designed to be invoked unattended by `hermes cron`.
version: 1.0.0
---

# RBrain X/Twitter Collector → Brain Enrichment

> Update: the preferred collector is now the deterministic Node script at `/Users/cole/RBrain/x-collector/x-collector.mjs`, with LLM review/enrichment running separately on a slower schedule. Use `xurl` for ad-hoc investigations or one-off recovery, not as the default collection loop.

Collects tweets from X/Twitter, identifies notable entities, and enriches RBrain pages with relevant findings.

## Step 1: Run Searches

Load the search queries from `/Users/cole/RBrain/x-collector/config.json`. For each query in the `searches` array, run:

```bash
xurl search "QUERY" -n 20
```

**MUST use file redirection for `-n 100`.** The `terminal()` function caps stdout at ~20KB (not 50KB). High-volume queries (Supabase, AI agents, Anthropic, MCP) produce 100-140KB JSON at `-n 100`. Redirect to a temp file FIRST, then parse the file in a separate `execute_code` block:

```bash
xurl search "QUERY" -n 100 > /tmp/xurl_search_0.json 2>&1
```

Then parse the file inside `execute_code`:
```python
import json
with open("/tmp/xurl_search_0.json") as f:
    data = json.load(f)
tweets = data.get("data", [])
```

**Why file redirection is mandatory:** Without it, `terminal()` silently truncates output at ~20KB. The JSON appears valid but is cut mid-object. `json.loads()` and `json_parse()` both fail. You'll waste turns retrying with smaller `-n` values. Just redirect to file from the start.

**Fallback: `-n 30` inline.** If you must parse inline (e.g., quick ad-hoc search), `-n 30` stays under the 20KB cap. `-n 50` does NOT fit reliably — it depends on tweet text length.

**Pagination with date operators** (only needed for exhaustive collection beyond 100):

```bash
xurl search "QUERY since:2026-04-15" -n 100 > /tmp/xurl_search_page1.json 2>&1
xurl search "QUERY until:2026-04-15" -n 100 > /tmp/xurl_search_page2.json 2>&1
```

**⚠️ Do NOT use `--verbose` or `-v` flags.** They leak auth headers in agent sessions.

## Step 2: Parse and Identify Notable Tweets

xurl returns JSON with `data` array of tweets. Parse the output and scan for high-engagement tweets.

Each tweet has:
- `text` — tweet text
- `author_id` — X user ID
- `created_at` — ISO timestamp
- `public_metrics.like_count` — likes
- `public_metrics.retweet_count` — RTs
- `id` — tweet ID
- User info in `includes.users` array

**Engagement thresholds:** 50+ likes OR 25+ RTs for "notable." In practice, X search API results rarely hit these thresholds (typical max is ~10-15 likes). Use a **relevance-first approach**: define keyword groups for core focus areas (healthcare AI, AllCare, AI agents, MCP, Anthropic, competitors), filter tweets matching any keyword group regardless of engagement, then further triage those for brain enrichment.

## Step 3: Enrich Brain Pages

For each notable tweet:

1. **Extract entities** — people, companies, products mentioned
2. **Query brain** — `mcp_rbrain_query` to check if relevant pages exist
3. **If page exists** — add a timeline entry with tweet context via `mcp_rbrain_add_timeline_entry`
4. **If no page exists** — only create one if the entity is directly relevant to the brain's focus areas (see below)

### Enrichment Decision Framework

**DO create/enrich pages when:**
- Entity is directly related to AllCare, healthcare AI, or senior care
- Entity is a person in Ramy's professional network
- Entity is a competitor, partner, or investor in the healthcare AI space

**DO NOT create pages for:**
- General AI industry news (OpenAI, Anthropic, SpaceX) unless directly relevant
- Broad trend discussions with no specific actionable entity
- Low-signal engagement bait

## Step 4: Log the Run

Append a summary line to the log file using `write_file`:

```
~/.rbrain/logs/x-collector.log
```

Read the existing log first, then write the full content back with the new line appended.

## Pitfalls

1. **Do NOT use `--verbose` or `-v`** — leaks auth headers in output
2. **Do NOT read or cat `~/.xurl`** — contains secrets
3. **Don't over-enrich** — the brain is small and focused. General tech news pollutes it. When in doubt, skip.
4. **Rate limits** — xurl returns 429 errors as JSON. If rate limited, log it and stop.
5. **`mcp_rbrain_search` can hit "Max client connections reached"** — If you get this error, wait a moment and retry, or use `mcp_rbrain_query` (hybrid search) instead.
6. **Log writing: use `write_file`, not terminal `cat >>`** — terminal `cat >>` can time out in cron jobs.
7. **xurl auth is app-only (bearer token)** — whoami, posting, liking, DMs won't work. Search and read work fine.
8. **Search queries are in `/Users/cole/RBrain/x-collector/config.json`** under the `searches` array.
8a. **`config.searches` can be strings or objects** — newer query-learning runs may normalize entries to objects like `{ "id": "search_2", "query": "..." }`. When objects are present, use `entry.query` as the X query and `entry.id` as the stable search identifier / directory name. This preserves history even if array order changes.
9. **xurl JSON output truncates at ~20KB via `terminal()` stdout** — popular queries with `-n 100` produce 100-140KB and get silently truncated. The truncation produces valid-looking but incomplete JSON that fails parsing. You MUST use file redirection (`> /tmp/file.json 2>&1`) and parse the file in a separate `execute_code` block with `json.load(open(...))`. Do not waste turns trying inline `-n 50` or `-n 30` — just redirect to file from the start.
10. **Control character sanitization** — tweet text often contains raw control chars that break `json.loads()`. Use `json_parse()` from `hermes_tools` (handles control chars) instead of `json.loads()`.
11. **User resolution via `includes.users`** — `xurl search` returns `author_id` in tweet objects. The `includes.users` array IS included in search results and contains `{"id": "...", "username": "...", "name": "..."}` entries. Build a lookup dict: `user_map = {u["id"]: {"username": u["username"], "name": u["name"]} for u in data["includes"]["users"]}`. Only fall back to `xurl read TWEET_ID` if `includes.users` is missing or the author isn't in it (rare).
12. **Engagement thresholds are aspirational** — X search results rarely hit 50+ likes. Use relevance-based filtering (keyword groups for healthcare AI, competitors, MCP, etc.) as the primary filter, with engagement as a secondary signal.
13. **Consistently dead queries** — "AI agents healthcare", "senior care AI" OR "elderly care AI", and "barsoumramy" OR "Ramy Barsoum" almost always return 0 results. They're still worth running (for the rare hit) but don't expect signal from them.
14. **RBrain CLI may have DB auth issues** — if `bun src/cli.ts` commands fail with "password authentication failed", use the MCP tools (`mcp_rbrain_query`, `mcp_rbrain_get_page`, etc.) as a reliable fallback.
15. **Rate limit timing varies** — The X API Basic tier rate limits can be hit with as little as 1 req/sec or tolerated at 1-2 sec intervals. In practice, results vary by API load. Start with `time.sleep(2)` between searches. If you hit 429s, increase to `time.sleep(30)` for the remainder. A 10-query run at 2s delays takes ~30 seconds; at 30s delays it takes ~5 minutes. Plan cron timeout for the worst case (5+ minutes).
17. **File redirection works for xurl** — `xurl search "QUERY" -n 100 > /tmp/file.json 2>&1` produces clean JSON even at 140KB+. Parse the file in a subsequent `execute_code` block. The terminal exit code is 0 even though stdout is empty (redirected to file).
18. **Listicle detection** — tweets containing phrases like "concepts developers should know", "roadmap to prepare", "bonus concepts", or "interview prep" are engagement-bait listicles. Skip them even at high engagement. They don't add signal to the brain.
19. **Engagement reality check** — across multiple runs, the 50+ likes threshold has never been met. Typical max engagement is 10-30 likes. The 50+ threshold serves as a ceiling filter (prevents over-enrichment), but the real filtering happens via relevance-first keyword matching. Don't lower the threshold to chase tweets.
20. **Rate limit recovery pattern** — when you hit a 429, do NOT retry immediately. Wait 60s, then retry once. If still 429, stop that batch and move to the next group of queries in a fresh `execute_code` block with the 30s delay pattern. The API resets rate limits per 15-minute window.
22. **Never detect rate limits by checking `"429" in raw`** — tweet IDs are large numbers that often contain "429" as a substring (e.g., `"id": "2043759479779459140"`). Checking raw text for "429" produces false positives, causing valid data to be discarded. Instead, parse the JSON first with `json.loads()`, then check for `"errors"` in the parsed dict, or check for a missing `"data"` key combined with `"meta"` having `"result_count": 0`. Rate limit responses from xurl look like `{"errors": [...]}` or `{"title": "Too Many Requests", ...}`, not valid tweet arrays.
23. **Run queries individually via `terminal()`, not batched in `execute_code` with `time.sleep()`** — the `execute_code` sandbox has a 5-minute timeout. Batching 10 queries with `time.sleep(3-5)` between each easily exceeds this limit. Instead, run each `xurl search` as a separate `terminal()` call (sequentially, from the top-level agent loop), then process all result files in a single `execute_code` block at the end. This avoids both the timeout and the rate-limit stacking problem.
21. **Quoted tweets can surface high-engagement originals** — a low-engagement quote tweet (e.g. 24 likes) may reference a much higher-engagement original (1,165 likes, 1.2M impressions). When you find a relevant quote tweet, `xurl read QUOTED_ID` on the referenced tweet to check its metrics. Only enrich if the original is directly relevant to brain focus areas (most are general dev listicles — skip those).
24. **`shell_quote` in `execute_code`** — available from `hermes_tools`: `from hermes_tools import shell_quote`. Use it for `timeline-add` text with special chars ($, @, etc.). If import fails, fall back to `import shlex; shlex.quote()`.
25. **Brain CLI fallback from cron** — when running as a cron job, MCP tools (`mcp_rbrain_query`, `mcp_rbrain_add_timeline_entry`) may not be available. Use the RBrain CLI directly: `cd /Users/cole/RBrain && source .env && npx gbrain <command>`. Key commands: `search "query" -n N`, `get <slug>`, `timeline-add <slug> <date> <text>`. The `.env` sourcing is required or you'll get "password authentication failed". Alternative: `bun src/cli.ts <command>` also works but `npx gbrain` is simpler and doesn't require knowing the repo path.
26. **6-9 notable tweets is a typical yield** — from a 499-508 tweet scan, 6-9 tweets hit the 50+ likes OR 25+ RTs threshold. The 50+ likes threshold IS sometimes met (observed: top tweet had 130 likes). Of those notable tweets, typically 0-1 are HIGH/MEDIUM relevance to healthcare AI. Most high-engagement tweets in these queries are crypto spam ($VIRTUAL), generic listicles, tutorials, or niche tool demos unrelated to healthcare AI. Don't lower thresholds to chase signal.
27. **`source .env` is the correct env sourcing pattern for CLI commands** — `cd /Users/cole/RBrain && source .env 2>/dev/null; bun run src/cli.ts <cmd>` works. `set -a && . ./.env && set +a` also works but `source .env` is simpler and reliable in cron contexts. Without sourcing, every CLI command fails with "password authentication failed for user postgres".
28. **Log appending must use `read_file` + `write_file`** — never use `cat >> ... << 'EOF'` heredocs in cron. The terminal heredoc approach fails (exit code -1). Instead: read the existing log with `read_file()`, concatenate the new entry as a Python string, and write the full content back with `write_file()`.
29. **`shell_quote` IS available from `hermes_tools`** — contrary to pitfall #24, `from hermes_tools import shell_quote` works. The import is needed. Use it for timeline-add text that contains special characters ($, @, etc.) to avoid shell quoting issues.
30. **Run all 10 searches in a single `execute_code` block with file redirection** — contrary to pitfall #23, running all searches in one `execute_code` block via `terminal()` calls is fine as long as each uses `> /tmp/file.json 2>&1` redirection (fast, no sleep needed between them). The 5-minute timeout is generous for 10 sequential xurl calls. Processing the results is a separate `execute_code` block.
31. **Current collector storage is one JSON file per tweet under `data/tweets/searches/<search_id>/`** — these are not per-run API payloads. Each file contains a single tweet object plus `_collected_at`, `_search_id`, `_search_label`, `_search_mode`, and `_search_query`. For query-learning analysis, scan those per-tweet files directly; do not expect a top-level `data` array.
32. **Zero-result runs are not persisted by the collector** — `collectSearches()` only stores returned tweets and summarizes totals in-memory. If you are tuning queries from disk after the fact, you usually cannot prove repeated zero-result runs from artifacts alone. Use no-relevance hits, obvious noise, and absence of any stored tweets as the main replacement evidence unless an external run log exists.
33. **Collector output format is one tweet per JSON file, not one search response per file** — in `/Users/cole/RBrain/x-collector/data/tweets/searches/*/*.json`, each file is typically a single tweet object with top-level keys like `id`, `text`, `public_metrics`, `_author`, `_collected_at`, `_search_label`, and `_search_query`. Do not assume a top-level `data` array or `includes.users`. If `data` exists, normalize it, but default to reading the file itself as the tweet payload.
34. **Naive keyword scoring creates false positives on competitor-watch terms** — exact substring matches like `curenta` and broad domain phrases like `assisted living` can score irrelevant foreign-language or political tweets. Before enriching, inspect the top candidates and require contextual healthcare evidence around the match (for example healthcare keywords, relevant search label, or clearly relevant linked article metadata). Treat raw keyword hits from `competitor-watch` as a first-pass filter, not proof of relevance.
35. **`npx gbrain` can fail with a local permission error even when the repo CLI works** — observed failure: `sh: /Users/cole/.npm/_npx/.../node_modules/.bin/gbrain: Permission denied`. If this happens, skip `npx gbrain` and run the repo CLI directly from `/Users/cole/RBrain`, for example `bun src/cli.ts ...` or `bun run src/cli.ts ...`.
36. **Use direct slug reads as a fallback when search is flaky** — `bun src/cli.ts get <slug>` can still return a page even when `search` is failing with DB auth or circuit-breaker errors. If a candidate clearly maps to a likely slug (for example `companies/ethermed`), try `get` before assuming the brain is unavailable.
37. **On macOS, `stat -c` fails; use `stat -f` for marker inspection** — when checking `/tmp/xurl_last_review` on this machine, GNU-style `stat -c '%Y %y %n'` returns `illegal option -- c`. Use BSD/macOS syntax instead, e.g. `stat -f '%m %Sm %N' -t '%Y-%m-%dT%H:%M:%S%z' /tmp/xurl_last_review`. The main scan command `find ... -newer /tmp/xurl_last_review` still works unchanged.
38. **For cron enrichment runs, prefer `gbrain call ...` with repo-loaded env over `npx gbrain` or bare `gbrain`** — load `/Users/cole/RBrain/.env` into the process environment first, then run JSON operations like `gbrain call query '{"query":"..."}'`, `gbrain call get_timeline '{"slug":"..."}'`, and `gbrain call add_timeline_entry '{...}'`. This is more reliable than shell-sourcing plus positional CLI commands, and it maps directly to the MCP operations.
39. **`~/.gbrain/config.json` may not be sufficient for auth in unattended runs** — observed case: `gbrain call query ...` failed with `password authentication failed for user "postgres"` until `/Users/cole/RBrain/.env` was loaded into the environment. Treat the repo `.env` as the source of truth for cron jobs on this machine.
40. **Query-before-write should be literal, not inferred** — for tweet enrichment, first run `gbrain call query` (or `search`) for the topic, confirm the target slug appears in results, then add a timeline entry. If the page match is ambiguous, skip the write rather than forcing a weak mapping.
41. **Relevance-first for already-collected tweet files means substantive signal, not just keyword hit** — generic MCP explainers, certification roadmaps, and promotional launch tweets can match keywords but still be too weak to enrich. Stronger signals include security issues, explicit enterprise adoption by major platforms, healthcare studies with concrete findings, or competitor/funding updates with clear AllCare relevance.
42. **Deduplicate recent-file scans by tweet ID before triage** — the same tweet often appears in multiple search directories (for example `medical-scribe` and `docs-burden`). If you score raw files without deduping on `id`, you will overcount both scanned and relevant totals and may attempt duplicate enrichments.
43. **For tweet enrichment, semantic `query` results are not enough to prove a page match** — hybrid search can return semantically related pages (`companies/luminai`, `companies/ethermed`, etc.) even when the exact entity page for the tweet subject does not exist. Before writing, confirm an exact target page via `get_page` on the likely slug(s) (for example `companies/abridge`, `companies/oracle-health`, `companies/coral`) or an unmistakable exact-match search result. If the exact page is absent, skip the write rather than attaching the signal to a merely related competitor page.
44. **Watch for competitor-name homographs in tweet text** — exact keyword filters can surface false positives when a competitor name is also a normal word, most notably `Abridge` vs the verb `abridge`. Legal/political tweets about the First Amendment produced multiple bogus hits in the recent-file scan. Treat these as noise unless the tweet also contains clear healthcare/company context (for example medical, clinical, patient, hospital, scribe, EHR, ambient documentation, or an unmistakable company reference like `@Abridge`, funding, hiring, or product/news context).
