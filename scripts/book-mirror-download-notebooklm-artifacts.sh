#!/usr/bin/env bash
set -euo pipefail

# Poll and download NotebookLM artifacts for a Book Mirror notebook.
# Outputs are intentionally local/ignored because they can include generated
# audio, slides, notebook IDs, and source-derived text.

ROOT="${RBRAIN_ROOT:-$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)}"
SLUG="${BOOK_MIRROR_SLUG:-the-one-thing}"
DIR="${BOOK_MIRROR_NOTEBOOKLM_DIR:-$ROOT/drafts/book-mirror/notebooklm/$SLUG}"
PROFILE="${NOTEBOOKLM_PROFILE:-default}"
INTERVAL_SECONDS="${BOOK_MIRROR_POLL_INTERVAL_SECONDS:-180}"
MAX_ATTEMPTS="${BOOK_MIRROR_MAX_ATTEMPTS:-20}"

if [[ ! -f "$DIR/notebook-id.txt" ]]; then
  echo "missing notebook id: $DIR/notebook-id.txt" >&2
  exit 1
fi

NB_ID=$(cat "$DIR/notebook-id.txt")
for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  date -u +"%Y-%m-%dT%H:%M:%SZ" >> "$DIR/artifact-monitor.log"
  nlm list artifacts "$NB_ID" --json --profile "$PROFILE" > "$DIR/artifacts-latest.json" || true
  cat "$DIR/artifacts-latest.json" >> "$DIR/artifact-monitor.log" || true
  if grep -q '"status": "completed"' "$DIR/artifacts-latest.json"; then
    nlm download report "$NB_ID" --output "$DIR/report.md" --profile "$PROFILE" > "$DIR/report-download.log" 2>&1 || true
    nlm download mind-map "$NB_ID" --output "$DIR/mindmap.json" --profile "$PROFILE" > "$DIR/mindmap-download.log" 2>&1 || true
    nlm download slide-deck "$NB_ID" --format pptx --output "$DIR/slides.pptx" --profile "$PROFILE" > "$DIR/slides-download.log" 2>&1 || true
    nlm download audio "$NB_ID" --output "$DIR/audio.mp3" --profile "$PROFILE" > "$DIR/audio-download.log" 2>&1 || true
  fi
  if [[ -s "$DIR/audio.mp3" && -s "$DIR/slides.pptx" ]]; then
    echo "downloaded audio and slides" >> "$DIR/artifact-monitor.log"
    exit 0
  fi
  sleep "$INTERVAL_SECONDS"
done
exit 0
