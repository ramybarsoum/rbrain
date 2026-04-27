#!/usr/bin/env bash
set -euo pipefail

ROOT="${RBRAIN_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"

MAX_PROFILE="${MAX_PROFILE:-$ROOT/agents/max}"
COLE_PROFILE="${COLE_PROFILE:-$ROOT/agents/cole}"

timestamp() {
  date +%Y%m%d%H%M%S
}

ensure_profile() {
  local profile_dir="$1"
  local agent_name="$2"
  local agent_id="$3"
  local runtime="$4"

  mkdir -p "$profile_dir"

  if [ ! -f "$profile_dir/SOUL.md" ]; then
    sed \
      -e "s/<Agent Name>/$agent_name/g" \
      -e "s/<agent-id>/$agent_id/g" \
      -e "s/<hermes|openclaw|other>/$runtime/g" \
      "$ROOT/agents/templates/SOUL.md.template" > "$profile_dir/SOUL.md"
  fi

  if [ ! -f "$profile_dir/IDENTITY.md" ]; then
    sed \
      -e "s/<Agent Name>/$agent_name/g" \
      -e "s/<agent-id>/$agent_id/g" \
      -e "s/<hermes|openclaw|other>/$runtime/g" \
      "$ROOT/agents/templates/IDENTITY.md.template" > "$profile_dir/IDENTITY.md"
  fi

  if [ ! -f "$profile_dir/RUNTIME.md" ]; then
    sed \
      -e "s/<Agent Name>/$agent_name/g" \
      -e "s/<agent-id>/$agent_id/g" \
      -e "s/<hermes|openclaw|other>/$runtime/g" \
      "$ROOT/agents/templates/RUNTIME.md.template" > "$profile_dir/RUNTIME.md"
  fi
}

link_file() {
  local target="$1"
  local link="$2"
  local link_dir
  link_dir="$(dirname "$link")"
  mkdir -p "$link_dir"

  if [ -e "$link" ] && [ ! -L "$link" ]; then
    cp -p "$link" "$link.backup.$(timestamp)"
    rm "$link"
  fi

  ln -sfn "$target" "$link"
}

ensure_profile "$MAX_PROFILE" "Max" "max" "hermes"
ensure_profile "$COLE_PROFILE" "Cole" "cole" "openclaw"

link_file "$MAX_PROFILE/SOUL.md" "$HERMES_HOME/SOUL.md"
link_file "$MAX_PROFILE/IDENTITY.md" "$HERMES_HOME/IDENTITY.md"
link_file "$MAX_PROFILE/RUNTIME.md" "$HERMES_HOME/RUNTIME.md"

link_file "$COLE_PROFILE/SOUL.md" "$OPENCLAW_HOME/workspace/SOUL.md"
link_file "$COLE_PROFILE/IDENTITY.md" "$OPENCLAW_HOME/workspace/IDENTITY.md"
link_file "$COLE_PROFILE/RUNTIME.md" "$OPENCLAW_HOME/workspace/RUNTIME.md"

echo "Agent profile links installed:"
echo "  Max  -> $MAX_PROFILE"
echo "  Cole -> $COLE_PROFILE"
