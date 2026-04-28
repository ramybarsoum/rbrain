#!/usr/bin/env bash
# check-upstream-pr-merges.sh
#
# Fails if a commit range contains local merge commits of upstream PRs that have
# not first been merged upstream by Garry. This prevents RBrain from treating
# open garrytan/gbrain PR branches as approved upstream.
#
# Usage:
#   bash scripts/check-upstream-pr-merges.sh <git-revision-range>
#
# Examples:
#   bash scripts/check-upstream-pr-merges.sh origin/master..HEAD
#   bash scripts/check-upstream-pr-merges.sh "$GITHUB_EVENT_BEFORE..$GITHUB_SHA"

set -euo pipefail

RANGE="${1:-}"
UPSTREAM_REPO="${UPSTREAM_REPO:-garrytan/gbrain}"
REQUIRED_MERGER="${REQUIRED_UPSTREAM_MERGER:-garrytan}"

if [[ -z "$RANGE" ]]; then
  echo "usage: $0 <git-revision-range>" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required to verify upstream PR approval state" >&2
  exit 2
fi

MERGES_FILE="$(mktemp)"
trap 'rm -f "$MERGES_FILE"' EXIT

git log --merges --format='%H%x09%s' "$RANGE" \
  | grep -E $'\tmerge: upstream PR #[0-9]+' >"$MERGES_FILE" || true

if [[ ! -s "$MERGES_FILE" ]]; then
  echo "No upstream PR merge commits found in $RANGE."
  exit 0
fi

failed=0

while IFS= read -r entry; do
  commit="${entry%%$'\t'*}"
  subject="${entry#*$'\t'}"
  pr_number="$(sed -E 's/.*#([0-9]+).*/\1/' <<<"$subject")"

  pr_record="$(gh pr view "$pr_number" --repo "$UPSTREAM_REPO" \
    --json state,mergedBy,url,title \
    --jq '[.state, (.mergedBy.login // ""), .url, .title] | join("\u001f")')"
  IFS=$'\037' read -r state merged_by url title <<<"$pr_record"

  if [[ "$state" != "MERGED" || "$merged_by" != "$REQUIRED_MERGER" ]]; then
    echo "error: $commit merges upstream PR #$pr_number without required upstream approval" >&2
    echo "  subject: $subject" >&2
    echo "  upstream: $url" >&2
    echo "  title: $title" >&2
    echo "  state=$state mergedBy=${merged_by:-<none>} requiredMergedBy=$REQUIRED_MERGER" >&2
    failed=1
  else
    echo "ok: $commit merges approved upstream PR #$pr_number ($state by $merged_by)"
  fi
done <"$MERGES_FILE"

exit "$failed"
