# tools/

Fat files for CLIs and cloud services the agent shells out to, when they've earned their own doc.

## Stop before adding a file here

Read `skills/conventions/router-pattern.md` first. Same rule as `mcps/`:

- Thin rows in `skills/RESOLVER.md` are the default.
- A fat file here only earns its place when the tool passes the "earn the file" test in the convention doc.

## tools/ vs mcps/ vs skills/

- `skills/<name>/SKILL.md` — runtime skill the agent *executes* (fat markdown skill with phases).
- `mcps/<name>.md` — MCP server the agent *calls* via the MCP protocol.
- `tools/<name>.md` — CLI or cloud service the agent *shells out to* (bash command, HTTP API).

A tool may pair with a skill: e.g., `tools/browser-use.md` (the cloud API side) pairs with `skills/browser-harness/SKILL.md` (the runtime skill that uses it). Both files exist, both cross-reference each other.

## Current fat files

- `browser-use.md` — Browser Use cloud API. Remote daemons, profile sync, API key conventions, billing.

## Adding a new fat file

1. Confirm the tool passes the earn-the-file test in `skills/conventions/router-pattern.md`.
2. Create `tools/<name>.md` using the structure from existing files.
3. Update the matching row in `skills/RESOLVER.md`.
4. Mirror as a brain page via `put_page`.
5. Commit fat file + RESOLVER update + brain mirror together.

If you are about to skip any of these steps, re-read `skills/conventions/router-pattern.md`.
