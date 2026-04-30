---
name: notion
description: Notion API for creating and managing pages, databases, and blocks via curl. Search, create, update, and query Notion workspaces directly from the terminal.
version: 1.0.0
author: community
license: MIT
metadata:
  hermes:
    tags: [Notion, Productivity, Notes, Database, API]
    homepage: https://developers.notion.com
prerequisites:
  env_vars: [NOTION_API_KEY]
---

# Notion API

Use the Notion API via curl to create, read, update pages, databases (data sources), and blocks. No extra tools needed — just curl and a Notion API key.

## Prerequisites

1. Create an integration at https://notion.so/my-integrations
2. Copy the API key (starts with `ntn_` or `secret_`)
3. Store it in `~/.hermes/.env`:
   ```
   NOTION_API_KEY=ntn_your_key_here
   ```
4. **Important:** Share target pages/databases with your integration in Notion (click "..." → "Connect to" → your integration name)

## API Basics

All requests use this pattern:

```bash
curl -s -X GET "https://api.notion.com/v1/..." \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json"
```

The `Notion-Version` header is required. This skill uses `2025-09-03` (latest). In this version, databases are called "data sources" in the API.

## Common Operations

### Search

```bash
curl -s -X POST "https://api.notion.com/v1/search" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"query": "page title"}'
```

### Get Page

```bash
curl -s "https://api.notion.com/v1/pages/{page_id}" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03"
```

### Get Page Content (blocks)

```bash
curl -s "https://api.notion.com/v1/blocks/{page_id}/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03"
```

### Create Page in a Database

```bash
curl -s -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {"database_id": "xxx"},
    "properties": {
      "Name": {"title": [{"text": {"content": "New Item"}}]},
      "Status": {"select": {"name": "Todo"}}
    }
  }'
```

### Query a Database

```bash
curl -s -X POST "https://api.notion.com/v1/data_sources/{data_source_id}/query" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"property": "Status", "select": {"equals": "Active"}},
    "sorts": [{"property": "Date", "direction": "descending"}]
  }'
```

### Create a Database

```bash
curl -s -X POST "https://api.notion.com/v1/data_sources" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {"page_id": "xxx"},
    "title": [{"text": {"content": "My Database"}}],
    "properties": {
      "Name": {"title": {}},
      "Status": {"select": {"options": [{"name": "Todo"}, {"name": "Done"}]}},
      "Date": {"date": {}}
    }
  }'
```

### Update Page Properties

```bash
curl -s -X PATCH "https://api.notion.com/v1/pages/{page_id}" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"properties": {"Status": {"select": {"name": "Done"}}}}'
```

### Add Content to a Page

```bash
curl -s -X PATCH "https://api.notion.com/v1/blocks/{page_id}/children" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello from Hermes!"}}]}}
    ]
  }'
```

## Property Types

Common property formats for database items:

- **Title:** `{"title": [{"text": {"content": "..."}}]}`
- **Rich text:** `{"rich_text": [{"text": {"content": "..."}}]}`
- **Select:** `{"select": {"name": "Option"}}`
- **Multi-select:** `{"multi_select": [{"name": "A"}, {"name": "B"}]}`
- **Date:** `{"date": {"start": "2026-01-15", "end": "2026-01-16"}}`
- **Checkbox:** `{"checkbox": true}`
- **Number:** `{"number": 42}`
- **URL:** `{"url": "https://..."}`
- **Email:** `{"email": "user@example.com"}`
- **Relation:** `{"relation": [{"id": "page_id"}]}`

## Key Differences in API Version 2025-09-03

- **Databases → Data Sources:** Use `/data_sources/` endpoints for queries and retrieval
- **Two IDs:** Each database has both a `database_id` and a `data_source_id`
  - Use `database_id` when creating pages (`parent: {"database_id": "..."}`)
  - Use `data_source_id` when querying (`POST /v1/data_sources/{id}/query`)
- **Search results:** Databases return as `"object": "data_source"` with their `data_source_id`
- **Internal integration caveat:** For internal workspace bots, `parent: {"workspace": true}` may fail with `validation_error` even though auth is valid. In practice, create pages under an existing `parent.page_id` or `parent.database_id` returned by `/v1/search`. Workspace-root private page creation is only supported for integrations with the right insert-content capability/profile.

## Notes

- Page/database IDs are UUIDs (with or without dashes)
- Rate limit: ~3 requests/second average
- The API cannot set database view filters — that's UI-only
- Use `is_inline: true` when creating data sources to embed them in pages
- Add `-s` flag to curl to suppress progress bars (cleaner output for Hermes)
- Pipe output through `jq` for readable JSON: `... | jq '.results[0].properties'`

## Public share pages without API access

If the user gives you a public Notion share link and you do **not** have `NOTION_API_KEY` or the integration cannot access the workspace:

1. Prefer the **browser** tool over `web_extract`.
2. Open the public share URL with `browser_navigate`.
3. Use `browser_snapshot(full=true)` to capture visible rows/cards.
4. If the page is a database board/list and `browser_snapshot` truncates, use `browser_console` with `document.body.innerText` to extract the rendered text.
5. Expect `web_extract` to fail on some Notion share links; do not assume the page is actually private until browser output confirms a sign-in wall.
6. For comparison/review tasks, treat the Notion page as an execution board: extract initiative names, pillars, priorities, owners, status, and summaries, then compare against the user's source doc.

This fallback is especially useful for public roadmap boards where the user wants synthesis rather than database mutation.

## Zapier MCP fallback for page creation

If `NOTION_API_KEY` is missing but the machine has a connected Zapier MCP server, you can sometimes still create or update Notion pages through Zapier actions exposed by `mcporter`.

Discovery pattern:

```bash
mcporter list zapier | grep -i notion
```

Common actions include:
- `zapier.notion_create_page`
- `zapier.notion_add_content_to_page`
- `zapier.notion_find_page_by_title`

Example:

```bash
mcporter call zapier.notion_create_page \
  title='Page title' \
  instructions='Create a Notion page with this title.' \
  output_hint='Return the created page URL and page ID.' \
  --output json
```

### Critical caveat: Zapier Notion auth can be stale

If Zapier returns:

```text
API token is invalid.
```

then the Zapier-side Notion connection is broken/stale. Get the reconnection URL with:

```bash
mcporter call zapier.get_configuration_url \
  instructions='Return the configuration URL for connected apps.' \
  output_hint='Return the URL only.' \
  --output json
```

Then have the user reconnect Notion in Zapier before retrying the Notion action.

This is a good fallback when direct Notion API auth is unavailable, but it is not reliable unless the Zapier Notion app is already healthy.

## Public-share troubleshooting

If the user gives you a Notion URL and wants you to read/compare content:

1. **Try the page directly in the browser tool first** if API auth is unavailable or the skill reports missing `NOTION_API_KEY`.
2. **Do not trust `web_extract` on Notion links** as the primary path — it may fail on shared Notion pages even when the link is valid.
3. If browser shows a sign-in wall, tell the user the page is still private and ask for either:
   - a true public share link,
   - pasted content,
   - screenshots,
   - or an export.
4. If browser shows the content, use:
   - `browser_snapshot(full=true)` for structured text
   - `browser_console(expression='document.body.innerText.slice(...)')` to pull more raw text when the snapshot truncates
5. Public shared databases often load as a visible table/board even with a signup banner; ignore the banner and extract the visible page text.

This browser-first fallback is especially useful for roadmap reviews, side-by-side comparisons, and quick reads where full Notion API setup would be overkill.
