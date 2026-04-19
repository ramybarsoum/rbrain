---
name: gws
type: cli-as-mcp
description: Google Workspace access via the `gws` CLI. Covers Gmail, Drive, Calendar, Sheets, Docs, Slides, Tasks. Use before saying "I can't find it."
---

# gws — Google Workspace CLI

> **Router entry:** `skills/RESOLVER.md` → "MCP Tools" table, row "Google Workspace".
> **Rule from CLAUDE.md:** Always try `gws` before saying you can't find something.

## What it is

A command-line tool that wraps Google's APIs behind one binary. Not strictly an MCP server — it's a CLI the agent shells out to via Bash — but documented here because it plays the same role: a gateway to a backing service with its own auth and semantics.

## Subcommands

| Command | Purpose |
|---|---|
| `gws gmail` | Search/read/send email. Primary use: finding threads by sender, subject, date range. |
| `gws drive` | List, search, download, upload files. Resolve share links. |
| `gws calendar` | Event lookup, upcoming-meeting context, scheduling conflicts. |
| `gws sheets` | Read/write spreadsheet cells. Use for structured data not in rbrain. |
| `gws docs` | Read/edit Google Docs. Pull doc content into brain when worth citing. |
| `gws slides` | Read/export slide decks. |
| `gws tasks` | Google Tasks — separate from RBrain daily tasks (see `skills/daily-task-manager/`). |

Run `gws <command> --help` for flag reference.

## When to reach for gws

- The user references an email, doc, or calendar event not already in brain.
- You need to verify a claim (who sent what, when a meeting happened, etc.).
- Before asking the user "can you send me the link?" — try `gws gmail` first.
- **Not** for storing answers. gws is read-through; persist what matters as a brain page via `rbrain.put_page` with a source attribution.

## Auth

OAuth stored per-Google-account in `~/.gws/` (or equivalent). Re-auth triggers a browser flow. **Do not commit** any files under `~/.gws/`. If a new machine (cole-macbook) needs gws, run the first-time auth flow interactively — there's no way to transfer tokens safely.

Scopes required:

- `gmail.readonly` / `gmail.modify` (send = modify)
- `drive.readonly` / `drive`
- `calendar.readonly` / `calendar`
- `spreadsheets` / `documents` / `presentations` / `tasks`

Rotate tokens on a schedule; don't cache in the repo.

## Patterns that work

- **"Did X send me anything about Y?"** → `gws gmail --from X --query Y`
- **"Where's the deck Tamara shared last week?"** → `gws drive --shared-with me --name '<fragment>' --modified-after 2026-04-12`
- **"What meetings do I have tomorrow?"** → `gws calendar --days 1`
- **Bulk extraction into brain** → pipe `gws` output to a script that creates rbrain pages, with source attribution pointing at the Gmail/Drive link.

## Gotchas

- **Rate limits are quiet.** Google returns 200 OK with partial results under pressure. Don't trust "empty" without retrying.
- **Drive search is prefix-sensitive.** Searching "Q2 plan" misses "Q2-plan.docx". Use `--contains` for fuzzy matching.
- **Calendar timezones are local by default.** Pass `--tz` explicitly when doing cross-timezone scheduling, or you'll book the wrong hour.
- **Gmail threads vs messages.** `--thread` and `--message` are different units. A 12-message thread returns 12 messages, or 1 thread, depending on the flag.
- **Tasks are per-list.** `gws tasks` defaults to the primary list. Pass `--list <name>` for alternate lists.

## See also

- Daily-task flow: `skills/daily-task-prep/SKILL.md` (uses `gws calendar` to build morning context)
- Email ingestion: `recipes/email-to-brain` (can use gws as the collector layer)
- Router row: `skills/RESOLVER.md` → MCP Tools → "Google Workspace"
