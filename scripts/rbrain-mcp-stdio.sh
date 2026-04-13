#!/bin/sh
# Thin wrapper that boots the RBrain stdio MCP server from the project directory.
# Called by Claude Code / Codex / OpenClaw / Cursor MCP configs.
# Loads /Users/cole/RBrain/.env if present (RBRAIN_DATABASE_URL, OPENAI_API_KEY, etc.)
set -e
cd /Users/cole/RBrain
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec bun src/cli.ts serve
