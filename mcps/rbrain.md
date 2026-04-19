---
name: rbrain
type: mcp
description: Persistent knowledge base. Source of truth for people, companies, concepts, meetings, projects. The one MCP Claude touches on nearly every message.
---

# rbrain MCP

> **Router entry:** `skills/RESOLVER.md` → "MCP Tools" table, row "rbrain". This is the fat file.
> **Related skills:** `skills/brain-ops/SKILL.md`, `skills/query/SKILL.md`, `skills/signal-detector/SKILL.md`.

## What it is

A stdio MCP server generated from `src/core/operations.ts` in the RBrain repo. Contract-first: every CLI command and MCP tool is derived from the same operation definitions, so CLI behavior and MCP behavior are identical.

**Active brain on this machine:** Supabase project `rlgonegzlxakquoiyzqq` (session pooler, `aws-1-us-east-1.pooler.supabase.com:5432`). V0 archive preserved in `v0_archive` schema — **do not touch without explicit instructions**.

## Session-start auto-load (mandatory)

Both of these run before answering the first message:

1. `list_pages` with `limit: 20` — recent context from the last 7 days.
2. `list_pages` with `tag: "pinned"` — permanently pinned notes, no day limit.

If Ramy asks about a topic, person, project, or decision, also call `query` or `search` with a relevant query before answering.

## Operation groups

| Group | Tools | When to use |
|---|---|---|
| **Search/retrieve** | `search`, `query`, `list_pages`, `get_page`, `get_chunks`, `resolve_slugs` | Any lookup. `query` (hybrid: keyword + vector + RRF) is the default; `search` (keyword only) is faster when you know the exact term. |
| **Write/update** | `put_page`, `put_raw_data` | Create/update pages. Rechunks compiled_truth. Embeddings filled in later by the CLI's `embed --stale` cron. |
| **Delete** | `delete_page`, `remove_tag`, `remove_link`, `revert_version` | Destructive. Only on explicit user instruction. |
| **Graph** | `add_link`, `get_links`, `get_backlinks`, `traverse_graph` | Typed edges (`attended`, `works_at`, `invested_in`, `founded`, `advises`, `mentions`, `source`). Auto-populated by put_page's link extraction. |
| **Timeline** | `add_timeline_entry`, `get_timeline` | Append-only evidence. Never edit, only append. |
| **Tags** | `add_tag`, `get_tags` | `pinned` is a special tag — session-start loader pulls it. |
| **Files** | `file_list`, `file_url` | Attachments tied to pages. |
| **Admin** | `get_stats`, `get_health`, `get_ingest_log`, `log_ingest`, `get_versions` | Health checks, debugging, version history. |

## Slug conventions (non-obvious)

Primary subject dictates the directory, not the format of the content:

- **People** → `people/<slug>` (e.g., `people/tamara-beam`)
- **Companies** → `companies/<slug>` (e.g., `companies/perplexity`)
- **Concepts/frameworks** → `concepts/<slug>`
- **Original ideas** → `ideas/<slug>`
- **Projects/initiatives** → `projects/<slug>`
- **Meetings** → `meetings/<YYYY-MM-DD>-<slug>`
- **Recipes** (integration setup docs) → `recipes/<slug>`
- **Skills** → `skills/<name>/readme` (matching the repo folder)
- **MCPs** → `mcps/<name>` (this file lives at `mcps/rbrain`)
- **Tools** → `tools/<name>`
- **Test fixtures** → `test/e2e/fixtures/people/<slug>` — do not confuse with real people/

Full filing rules: `skills/_brain-filing-rules.md`.

## Compiled truth vs timeline (the core model)

Every page has two sections:

- **Compiled truth** — current best understanding, rewritten when evidence changes. This is "what we know now." Chunked and embedded.
- **Timeline** — append-only evidence trail. Dates + events. Never edited, only appended.

When rewriting compiled truth, preserve existing timeline entries and add a new one noting the update. Sources attributed inline in timeline entries.

## put_page contract

Required: `slug`, `type`, `title`, `compiled_truth`.
Optional: `timeline`, `frontmatter` (free-form object), tags (add separately via `add_tag`).

`type` matches the top-level directory: `person`, `company`, `concept`, `idea`, `project`, `meeting`, etc.

Embeddings are NOT written on `put_page` — the CLI's `gbrain embed --stale` cron fills them in within the next 15-minute window. Search works immediately via keyword; vector search catches up after embed.

## Auth

Wired via `/Users/ramybarsoum/Projects/RBrain/scripts/rbrain-mcp-stdio.sh`:

```bash
cd into repo → source .env (0600, gitignored) → exec bun src/cli.ts serve
```

Connection string lives in `~/Projects/RBrain/.env` as `RBRAIN_DATABASE_URL` (or `DATABASE_URL`) and is also mirrored to `~/.gbrain/config.json` (0600). No separate OAuth — direct Postgres connection via Supabase pooler.

**Trust boundary:** `OperationContext.remote` distinguishes trusted local CLI callers (`remote: false`) from untrusted agent callers (`remote: true`). Agent-facing operations like `file_upload` tighten filesystem confinement automatically.

## Gotchas

- **The `pinned` tag is load-bearing.** Untagging a page removes it from session-start auto-load. Only remove it with intent.
- **`list_pages` default limit is 50** — be explicit if you need more.
- **`query` runs hybrid search**, so cosine similarity can surface pages with no keyword overlap. Double-check when results feel off-topic.
- **`put_page` rechunks compiled_truth every call** — cheap, but not free. Batch when ingesting large sets; otherwise use once per entity update.
- **Rebind `RBRAIN_DATABASE_URL` in tests.** The repo's test suite strips it deliberately because Bun auto-loads `.env` and pollutes subprocess env.
- **`v0_archive` schema is untouchable** — preserves 9.3k thoughts, 1.7k learnings, etc. Never write there.

## See also

- Canonical code: `~/Projects/RBrain/src/core/operations.ts`
- Skill usage: `skills/brain-ops/SKILL.md`, `skills/query/SKILL.md`
- Conventions: `skills/conventions/brain-first.md` (check brain before external APIs)
- Router row: `skills/RESOLVER.md` → MCP Tools → "rbrain"
