# mcps/

Fat files for MCP servers that have earned their own doc.

## Stop before adding a file here

Read `skills/conventions/router-pattern.md` first. The short version:

- Thin rows in `skills/RESOLVER.md` are the default.
- A fat file here only earns its place when the MCP passes the "earn the file" test: >5 operations, auth complexity, non-obvious semantics, 3+ gotchas, multi-step setup, or cross-machine coordination.
- Discord, Slack, Playwright are examples of MCPs that stay as thin rows in RESOLVER and do NOT get a file here. Their docs live upstream.

## Current fat files

- `rbrain.md` — the persistent knowledge base MCP. Session-start auto-load rules, operation groups, slug conventions, compiled_truth/timeline model.
- `gws.md` — Google Workspace CLI. Subcommands, OAuth flow, scope list.

## Adding a new fat file

1. Confirm the MCP passes the earn-the-file test in `skills/conventions/router-pattern.md`.
2. Create `mcps/<name>.md` using the structure from existing files:
   - Router back-reference at the top
   - Related-skills block
   - Operation surface / runtime surface section
   - Auth section
   - Gotchas section
   - "See also" footer
3. Update the matching row in `skills/RESOLVER.md` → "MCP Tools" table so the "Depth" column points at `mcps/<name>.md`.
4. Mirror as a brain page via `put_page` so `rbrain search` finds it.
5. Commit the fat file, RESOLVER update, and brain mirror together.

If you are about to skip any of these steps, re-read `skills/conventions/router-pattern.md`.
