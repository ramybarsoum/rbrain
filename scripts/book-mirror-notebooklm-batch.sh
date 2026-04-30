#!/usr/bin/env bash
set -euo pipefail

# Create NotebookLM Book Mirror notebooks for a small, explicit batch.
#
# Defaults are local-development friendly; override paths in env for another
# machine/user. This script intentionally does not commit or publish outputs.

ROOT="${RBRAIN_ROOT:-$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)}"
OUT="${BOOK_MIRROR_NOTEBOOKLM_OUT:-$ROOT/drafts/book-mirror/notebooklm}"
SOURCE_DIR="${BOOK_MIRROR_SOURCE_DIR:-$HOME/Library/Mobile Documents/iCloud~com~apple~iBooks/Documents}"
PROFILE="${NOTEBOOKLM_PROFILE:-default}"
mkdir -p "$OUT"

run_book() {
  local slug="$1"
  local title="$2"
  local file="$3"
  local dir="$OUT/$slug"
  mkdir -p "$dir"
  echo "## $title" | tee "$dir/status.log"
  echo "source_file=$file" | tee -a "$dir/status.log"

  if [[ ! -f "$file" ]]; then
    echo "missing source file: $file" | tee -a "$dir/status.log"
    return 1
  fi

  local nb_json nb_id
  nb_json=$(nlm notebook create "Book Mirror — $title" --profile "$PROFILE")
  echo "$nb_json" > "$dir/notebook-create.json"
  nb_id=$(python3 - "$dir/notebook-create.json" <<'PY'
import json, re, sys
s = open(sys.argv[1]).read()
try:
    data = json.loads(s)
    if isinstance(data, dict):
        print(data.get('id') or data.get('notebook_id') or data.get('uuid') or '')
    else:
        print('')
except Exception:
    m = re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', s)
    print(m.group(0) if m else '')
PY
)
  if [[ -z "$nb_id" ]]; then
    echo "Could not parse notebook id for $title" | tee -a "$dir/status.log"
    cat "$dir/notebook-create.json" | tee -a "$dir/status.log"
    return 1
  fi
  echo "$nb_id" > "$dir/notebook-id.txt"
  echo "notebook_id=$nb_id" | tee -a "$dir/status.log"

  nlm source add "$nb_id" --file "$file" --title "$title" --wait --wait-timeout 900 --profile "$PROFILE" > "$dir/source-add.json" 2>&1 || {
    echo "source add failed" | tee -a "$dir/status.log"; return 1;
  }
  nlm source list "$nb_id" --json --profile "$PROFILE" > "$dir/sources.json" 2>&1 || true

  nlm notebook query "$nb_id" "Create a detailed, chapter-by-chapter structured summary for a Book Mirror. Preserve the author's stories, frameworks, terminology, examples, and practical takeaways. Do not include long verbatim copyrighted passages. Include citations where NotebookLM provides them." --json --profile "$PROFILE" > "$dir/notebooklm-summary.json" 2>&1 || true

  nlm report create "$nb_id" --format "Briefing Doc" --confirm --profile "$PROFILE" > "$dir/report-create.json" 2>&1 || true
  nlm mindmap create "$nb_id" --title "Book Mirror Mind Map — $title" --confirm --profile "$PROFILE" > "$dir/mindmap-create.json" 2>&1 || true
  nlm slides create "$nb_id" --format detailed_deck --length default --focus "Book Mirror: chapter-by-chapter summary and applications for a healthcare AI product leader" --confirm --profile "$PROFILE" > "$dir/slides-create.json" 2>&1 || true
  nlm audio create "$nb_id" --format brief --length short --focus "Book Mirror summary for a healthcare AI product leader" --confirm --profile "$PROFILE" > "$dir/audio-create.json" 2>&1 || true

  nlm download report "$nb_id" --output "$dir/report.md" --profile "$PROFILE" > "$dir/report-download.log" 2>&1 || true
  nlm download mind-map "$nb_id" --output "$dir/mindmap.json" --profile "$PROFILE" > "$dir/mindmap-download.log" 2>&1 || true
  nlm download slide-deck "$nb_id" --output "$dir/slides.pptx" --profile "$PROFILE" > "$dir/slides-download.log" 2>&1 || true
  nlm download audio "$nb_id" --output "$dir/audio.mp3" --profile "$PROFILE" > "$dir/audio-download.log" 2>&1 || true

  echo "done" | tee -a "$dir/status.log"
}

run_book "software-as-a-science" "Software as a Science" "$SOURCE_DIR/Software As A Science.pdf"
run_book "the-one-thing" "The ONE Thing" "$SOURCE_DIR/The One Thing.pdf"
