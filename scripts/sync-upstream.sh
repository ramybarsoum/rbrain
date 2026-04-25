#!/usr/bin/env bash
# sync-upstream.sh
#
# Merges upstream garrytan/gbrain into RBrain master.
# On any conflict, keeps RBrain's version (-X ours).
# Additive upstream changes (new files, new commands, new skills) still come in.
#
# Usage:
#   bash scripts/sync-upstream.sh          # preview what's coming
#   bash scripts/sync-upstream.sh --apply  # actually merge

set -euo pipefail

UPSTREAM_REMOTE="upstream"
UPSTREAM_BRANCH="master"
DRY_RUN=true

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

echo "Fetching ${UPSTREAM_REMOTE}..."
git fetch "${UPSTREAM_REMOTE}" --quiet

AHEAD=$(git rev-list "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"..HEAD --count)
BEHIND=$(git rev-list HEAD.."${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}" --count)

echo ""
echo "RBrain is ${AHEAD} commit(s) ahead of upstream, ${BEHIND} commit(s) behind."

if [[ "${BEHIND}" -eq 0 ]]; then
  echo "Already up to date. Nothing to merge."
  exit 0
fi

echo ""
echo "Upstream commits coming in:"
git log --format="  %h %s" HEAD.."${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"

if [[ "${DRY_RUN}" == true ]]; then
  echo ""
  echo "Dry run. Run with --apply to merge:"
  echo "  bash scripts/sync-upstream.sh --apply"
  exit 0
fi

echo ""
echo "Merging upstream/${UPSTREAM_BRANCH} (conflicts resolved in favor of RBrain)..."
git merge "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}" \
  -X ours \
  --no-edit \
  -m "merge: upstream gbrain $(git describe "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}" --tags --always 2>/dev/null || git rev-parse --short "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}")"

echo ""
echo "Merged. Running bun install to sync lockfile..."
bun install --frozen-lockfile 2>/dev/null || bun install

echo ""
echo "Done. Push when ready:"
echo "  git push origin master"
