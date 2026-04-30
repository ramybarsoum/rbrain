---
name: x-query-learning-loop
description: Analyze last-7-day X collector output, replace weak active searches with focused healthcare variants, and keep config + collector schema stable.
version: 1.0.1
---

# X Query Learning Loop

Use when tuning `/Users/cole/RBrain/x-collector/config.json` from collected tweet artifacts.

## Preconditions

- Collector output lives under `/Users/cole/RBrain/x-collector/data/tweets/searches/<search_id>/*.json`.
- Each file is usually one tweet object, not a full API payload.
- `config.searches` may be either plain strings or objects like `{ "id": "search_2", "query": "..." }`.
- If converting searches to objects, patch `x-collector.mjs` to read `entry.query` and use `entry.id` as the storage directory / `_search_id`.

## Loop

1. Use `execute_code` first.
2. Before inventing new searches, audit current active coverage and identify the closest existing search to the new topic. Prefer extending that search with competitor names, adjacent terminology, and stronger relevance keywords before creating a parallel tracker.
3. If the user wants a new topic monitored end-to-end, pair the query change with a dedicated digest cron and run that digest once immediately so the first useful report lands right away.
4. Normalize `config.searches` into objects with stable ids.
5. Analyze only tweets with `_collected_at` from the last 7 days.
6. For each active search, compute:
   - `tweets_seen`
   - `unique_authors`
   - `engagement_hits` (>=25 likes OR >=10 reposts)
   - `relevance_hits` using `config.relevance_keywords` (seed defaults if missing)
   - `negative_hits` using `config.negative_keywords` (seed defaults if missing)
   - a stricter `target_hits` / target-fit score based on Ramy / AllCare / senior-living / healthcare-ops phrases, so broad keywords like `aging` do not make noisy tweets look relevant
   - 3 representative previews ranked by target-fit, engagement, and noise penalty
7. Protect sentinel low-volume searches that directly watch Ramy / AllCare / senior-care phrases, even if they are quiet.
8. Replace at most 2 broad generic searches with zero relevance. Favor removing high-volume noise (generic AI/dev queries) over rare-but-targeted sentinels.
9. Candidate replacements must come from:
   - `config.exploration_pool`, or
   - focused query variants derived from recurring phrases inside the relevant tweets from the last 7 days.
10. Move removed search objects into `exploration_pool`; append promoted searches into `searches`.
11. Keep `len(config.searches) <= config.learning.max_active_searches`.
12. Append one JSON line to `query-learning-log.jsonl` with timestamp, kept_ids, removed_ids, added_ids, and reasons.
13. Validate:
   - `config.json` parses
   - active count <= max_active_searches
   - every appended JSONL log line parses
   - if a collector script exists in the repo, syntax-check it; do not assume `/Users/cole/RBrain/x-collector/x-collector.mjs` exists in every checkout

## Good replacement pattern

When relevant tweets cluster around healthcare ops phrases, promote narrower healthcare queries such as:
- `"healthcare automation" ("prior authorization" OR "clinical documentation" OR documentation)`
- `"healthcare automation" ("EHR integrations" OR "payer portal workflows")`

## Pitfalls

- Do not spin up a brand-new tracker before checking whether an existing active search can absorb the topic with narrower terms.
- Do not add a digest cron without running it once after setup; immediate first output is the fastest way to verify the loop is useful.
- Do not treat zero stored tweets as proof of repeated zero-result runs unless an external run log exists.
- Do not replace sentinel target-watch queries just because they are sparse.
- Do not add broad generic AI/dev queries without healthcare or senior-living anchors.
- Do not increase `search_max` unless there is evidence the cap is truncating useful signal.
- Do not rely on `relevance_keywords` alone when they contain broad terms like `aging`, `elderly`, or `AI assistant`; validate with tweet previews and target-fit scoring before keeping a query.
- Tweet artifacts often store engagement in `public_metrics` and author data in `_author.username`; use those before assuming fields are missing.
- In healthcare searches that mention **Abridge**, do not trust raw keyword matches. The plain-English verb `abridge` creates heavy false-positive noise (free speech, anime abridging, legal text, etc.). Require surrounding healthcare context terms (for example `ai`, `clinical`, `health`, `patient`, `doctor`, `ehr`, `scribe`, `medical`, `documentation`) or a trusted handle like `AbridgeHQ` before counting a tweet as relevant.
