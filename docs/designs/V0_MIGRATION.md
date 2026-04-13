# V0 → RBrain data migration reference

One-shot migration that turned the archived `v0_archive` schema (45 tables, ~14k entity rows) into RBrain pages. Lives here as a reference so future schema work can trace why a page has the slug it does.

## Provenance

Every page produced by the migration carries `v0_id` and `v0_table` in its frontmatter. To find the original V0 row for any RBrain page:

```sql
SELECT slug, frontmatter->>'v0_id', frontmatter->>'v0_table'
FROM public.pages
WHERE slug = '<slug>';
```

To find the RBrain page for a V0 row:

```sql
SELECT id, slug FROM public.pages
WHERE frontmatter->>'v0_id' = '<uuid-or-bigint>'
  AND frontmatter->>'v0_table' = '<table>';
```

## Source → page-type mapping

| `v0_archive` source | RBrain `type` | slug pattern |
|---|---|---|
| `people` (+ matching `compiled_truth` person row) | `person` | `person/<slug(name)>-<id8>` |
| `compiled_truth` person rows where `entity_id IS NULL` | `person` | `person/<slug(entity_name)>-orphan` |
| `compiled_truth` rows where `entity_type='topic'` | `topic` | `topic/<slug(entity_name)>` |
| `projects` (+ matching `compiled_truth` project row) | `project` | `project/<slug(name)>-<id8>` |
| `meetings` | `meeting` | `meeting/<YYYY-MM-DD>-<slug(title)>-<id>` |
| `thoughts` (+ `metadata.route` if present) | `thought` / `project_update` / `thought_feature_request` / `thought_idea` / `thought_learning` / `thought_decision` / `thought_follow_up` / `person_note` / `meeting_note` | `<route>/<YYYY-MM-DD>-<slug(title)>-<id8>` |
| `learnings` | `learning` | `learning/<id>-<slug(title)>` |
| `decisions` | `decision` | `decision/<id>-<slug(title)>` |
| `follow_ups` | `follow_up` | `follow-up/<YYYY-MM-DD or undated>-<slug(title)>-<id8>` |
| `feature_requests` | `feature_request` | `feature-request/<id8>-<slug(title)>` |
| `ideas` | `idea` | `idea/<slug(name)>-<id8>` |
| `interactions` | `interaction` | `interaction/<YYYY-MM-DD>-<type>-<id8>` |

The `slug()` helper lowercases, strips non-alphanumerics, replaces spaces with hyphens, caps at 60 chars. The `id8` helper takes the first 8 characters of the V0 UUID (with dashes stripped) or the full bigint as a string. Slugs are deterministic so re-running the migration produces the same slugs and `gbrain import` upserts via `content_hash`.

## Skipped tables (not migrated)

- `inbox_log` — routing audit log, system metadata
- `rewrite_queue` — processing queue
- `crm_skip_patterns` — config rows
- `page_versions` — only 19 rows, not worth the complexity
- `pages` — single leftover v2.0 dev test page
- `people_email_aliases` — already covered by `people.aliases[]` array column

## FK → links mapping

| V0 foreign key | RBrain link |
|---|---|
| `follow_ups.contact_id → people.id` | `follow_up_page → person_page`, `link_type='about'` |
| `interactions.contact_id / person_id → people.id` | `interaction_page → person_page`, `link_type='with'` |
| `feature_requests.linked_project → projects.id` | `feature_request_page → project_page`, `link_type='requested_for'` |
| `meeting_participants.meeting_id + person_id` | `meeting_page → person_page`, `link_type='attended_by'` |

## Timeline entries derived from V0

| Source | Becomes timeline entry on |
|---|---|
| `v0_archive.timeline_entries` | matched person/project/topic page (joined via `compiled_truth.entity_id`) |
| `v0_archive.meeting_action_items` | the meeting page |
| `v0_archive.decisions.decided_at` | the decision page |
| `v0_archive.follow_ups.due_date` | the follow-up page |
| `v0_archive.interactions.occurred_at` | the interaction page |

## Embeddings

Migration ships pages **without** embeddings (`gbrain import --no-embed`). Embeddings are backfilled separately via `gbrain embed --stale` which uses the existing chunker and the OpenAI text-embedding-3-large model (1536d), same as V0 used. V0's row-level embeddings are discarded — RBrain stores embeddings per chunk, not per entity, so the V0 vectors don't have a clean target.

## Re-running the migration

The whole pipeline is idempotent:

1. **Export** (`scripts/migrate-v0-archive.ts`) — overwrites scratch markdown files with deterministic slugs/content. Re-running is safe.
2. **Import** (`gbrain import --no-embed --workers 8`) — uses `content_hash` to skip unchanged pages. Re-running is fast.
3. **Post-process** (`scripts/migrate-v0-archive-postprocess.sql`) — `links` inserts use `ON CONFLICT (from_page_id, to_page_id) DO NOTHING`. `timeline_entries` inserts use `WHERE NOT EXISTS` guards because that table has no UNIQUE constraint. Both safe to re-run.
4. **Embed** (`gbrain embed --stale`) — only embeds chunks where `embedded_at IS NULL`. Safe to interrupt and resume.

## Rollback

`v0_archive` is the immutable source of truth — never DROP it without explicit user approval. Migration rollback is just:

```sql
TRUNCATE public.pages CASCADE;
```

This cascades to `content_chunks`, `links`, `tags`, `timeline_entries`, `raw_data`, `page_versions`, `files`. Then re-run the four phases.
