---
name: rbrain-dashboard-ai-native-cockpit
description: "Implement AI-native RBrain dashboard cockpit changes: always-on Max chat, command-center pages, deterministic radar/ledger queries, and verification practices."
version: 1.0.0
---

# RBrain Dashboard AI-Native Cockpit

## When to use

Use this when Ramy asks to improve the RBrain dashboard, add cockpit/command-center views, turn dashboard pages into action-oriented AI-native surfaces, or change Max chat behavior in the dashboard.

## Contract

This skill guarantees:
- Read `~/RBrain/SOUL.md` and `~/RBrain/RESOLVER.md` before changes
- Consult Ramy before major UX/product changes with a cut/keep/why table when the change is strategic
- Preserve the name `RBrain`
- Treat Max chat as a primary AI-native command surface, not a hidden chatbot toggle
- Prefer deterministic database-backed cards before LLM-generated summaries
- Label heuristics honestly instead of pretending they are ground truth
- Keep unrelated dirty repo state separate from dashboard changes
- Verify with focused tests and `npm run build`; interpret `npm run lint` carefully because dashboard lint may have pre-existing debt

## Workflow

### 1. Inspect context first

From `~/RBrain`:

```bash
git status --short
```

Read:
- `~/RBrain/SOUL.md`
- `~/RBrain/RESOLVER.md`
- `~/RBrain/dashboard/AGENTS.md` if touching `dashboard/`
- Relevant dashboard files:
  - `dashboard/app/layout.tsx`
  - `dashboard/components/ChatWidget.tsx`
  - `dashboard/app/globals.css`
  - `dashboard/lib/operations.ts`
  - target page files under `dashboard/app/`

Call out unrelated dirty files before editing.

### 2. Plan product shape before coding

For strategic UX changes, write/confirm a cut/keep/why table. Ramy's preferred direction from the Phase 1 cockpit work:

| Pattern | Default |
|---|---|
| Hidden chatbot toggle | Cut as primary UX |
| Always-on Max surface | Keep/build |
| Bottom command bar | Keep for mobile/narrow screens |
| Existing traditional pages | Repurpose before rebuilding |
| Fake or opaque metrics | Cut |
| Deterministic cards with explainable heuristics | Keep |

### 3. Use deterministic query helpers

Prefer adding pure helper functions in `dashboard/lib/*.ts` and testing them with `bun:test` before wiring UI.

Good examples:
- split todos into overdue / due today / upcoming
- pick “one thing now” using an explicit priority order
- score decision evidence from counts of backlinks, timeline entries, and chunks
- summarize why an open loop was flagged

Test command:

```bash
cd ~/RBrain/dashboard
bun test lib/<helper>.test.mjs
```

### 4. Add dashboard operations

Add data assemblers in `dashboard/lib/operations.ts` that derive from existing tables first:
- `pages`
- `links`
- `tags`
- `timeline_entries`
- `content_chunks`
- `minion_jobs`

Avoid schema changes in the first pass unless the feature cannot be represented from current data.

Useful Phase 1 query patterns:
- stale task: open dashboard todo where due date is past or `updated_at` is older than threshold
- unresolved meeting action: meeting content contains `action`, `follow up`, `owner`, `pending`, or `blocked`
- promise-like loop: content contains `I will`, `we will`, `promise`, `send`, or `follow up`
- abandoned draft: type/title/slug contains `draft` and `updated_at` is old
- decision candidate: type/title/content contains `decision`, `decide`, `approved`, `pending decision`, `blocked on`, `choose`, or `approve`

### 5. UI rules

For AI-native cockpit views:
- Every card should expose `why flagged`, source, age, and next action when possible
- Use Max chat scopes/suggestions in `ChatWidget.tsx` for new routes
- For desktop, reserve space for the always-on Max panel (`--chat-w`) so content is not hidden
- For narrow screens, collapse Max into a bottom command surface
- Do not remove existing utility pages (`Pages`, `Graph`, `Feed`, `Search`) unless Ramy explicitly asks

### 6. Verification

Run:

```bash
cd ~/RBrain/dashboard
bun test lib/<helper>.test.mjs
npm run build
```

Also run:

```bash
npm run lint
```

But interpret lint output carefully. In the dashboard, lint may already fail on pre-existing debt such as:
- old `any` usage in pages
- React lint warnings/errors in existing layout/effect patterns
- existing unescaped entity issues

Do not claim lint is clean unless it is. Separate:
- new issues introduced by your change
- pre-existing repo lint debt

### 7. Local route smoke test

If starting the dev server, use a non-conflicting port and kill it after verification:

```bash
cd ~/RBrain/dashboard
npm run dev -- -p 3060
curl -I http://localhost:3060/daily
```

If route smoke test returns 500, inspect the HTML/error payload. During the Phase 1 cockpit work, local visual verification was blocked by DB auth:

```text
password authentication failed for user "postgres"
```

Treat that as environment/auth failure, not necessarily a UI/build failure.

If live Supabase auth is stale and the goal is local route smoke rather than live data QA, use a local Docker pgvector database:

```bash
cd ~/RBrain
# Start or create local smoke DB on the port used by .env.testing
if ! docker ps -a --format '{{.Names}}' | grep -qx gbrain-test-pg; then
  docker run -d --name gbrain-test-pg \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=gbrain_test \
    -p 5433:5432 \
    pgvector/pgvector:pg16
else
  docker start gbrain-test-pg
fi
cat src/schema.sql | docker exec -i gbrain-test-pg \
  psql -U postgres -d gbrain_test -v ON_ERROR_STOP=1
cat > dashboard/.env.local <<'EOF'
# Local dashboard smoke-test database. Gitignored.
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gbrain_test
EOF
cd dashboard
env -u DATABASE_URL -u RBRAIN_DATABASE_URL npm run dev -- -p 3060
```

Then smoke:

```bash
curl -sS -o /tmp/daily.html -w '%{http_code}\n' http://localhost:3060/daily
curl -sS -o /tmp/open-loops.html -w '%{http_code}\n' http://localhost:3060/open-loops
curl -sS -o /tmp/decisions.html -w '%{http_code}\n' http://localhost:3060/decisions
```

Note: Next.js gives shell environment variables precedence. If the shell has a stale `DATABASE_URL`, run the dev server with `env -u DATABASE_URL -u RBRAIN_DATABASE_URL ...` so `dashboard/.env.local` is used.

## PR / merge target guardrail

For Ramy's RBrain dashboard feature work, be explicit about which remote/repo is being changed:

```bash
git remote -v
gh repo view --json nameWithOwner,viewerPermission,defaultBranchRef
```

Default target is Ramy's fork (`ramybarsoum/RBrain`) unless Ramy explicitly asks to touch upstream (`garrytan/gbrain`). When opening or checking a PR, pass `--repo ramybarsoum/RBrain` (or the verified repo) instead of relying on ambient `gh` defaults. After merge, verify local state:

```bash
git checkout master
git pull --ff-only origin master
git status --short
gh pr view <number> --repo ramybarsoum/RBrain --json url,state,mergedAt,statusCheckRollup
```

Report clearly whether upstream was untouched.

## Anti-Patterns

- Shipping a hidden side chatbot as the primary AI UX
- Inventing metrics without showing the heuristic
- Adding schema migrations before proving the cockpit can be derived from existing data
- Mixing dashboard work with unrelated dirty schema/core files
- Relying on `gh`'s ambient repo inference when RBrain has both Ramy's fork and Garry Tan upstream in play
- Treating all `npm run lint` failures as caused by current changes without checking pre-existing debt
- Calling RBrain anything else

## Output Format

Report:
- what changed by page/component
- exact files touched
- tests/build commands and results
- lint status separated into new vs pre-existing debt
- any local smoke-test blockers such as DB auth
