---
name: rbrain-upstream-sync
description: Sync Ramy's RBrain fork with Garry Tan's upstream GBrain repo. Includes repo layout, Ramy's custom commits to preserve, merge procedure, test expectations, and notable upstream branches to watch.
version: 1.0.1
---

# RBrain Upstream Sync

Sync Ramy's RBrain fork (`/Users/cole/RBrain`) with Garry Tan's upstream GBrain (`garrytan/gbrain.git`).

## Repo Layout

- **Local repo:** `/Users/cole/RBrain`
- **Origin:** `https://github.com/ramybarsoum/RBrain.git` (canonical remote; older lowercase URL redirects with a relocation warning)
- **Upstream:** `https://github.com/garrytan/gbrain.git`
- **Active DB:** Supabase project `rlgonegzlxakquoiyzqq` (credentials in `/Users/cole/RBrain/.env`)
- **MCP server:** stdio via `/Users/cole/RBrain/scripts/rbrain-mcp-stdio.sh`

## Ramy's Custom Commits (preserve during merge)

These are the fork-specific changes that must not be lost:
- `~/.gbrain → ~/.rbrain` rename across all paths
- `v0_archive → public` migration scripts
- `rbrain-mcp` Supabase Edge Function (query-param auth for mobile clients)
- Supabase project cutover to `rlgonegzlxakquoiyzqq`
- Files: `supabase/functions/rbrain-mcp/*`, plus path renames across `src/`

## Sync Procedure

1. **Fetch upstream:**
   ```bash
   cd /Users/cole/RBrain
   git fetch upstream
   ```

2. **Check what's new:**
   ```bash
   git log --oneline master..upstream/master | head -30
   ```

3. **Check unmerged feature branches** (Garry works on branches before merging):
   ```bash
   git branch -r | grep upstream/garrytan
   ```
   Notable branches to watch: `search-quality-boost`, `pglite-engine`, `v0.5-live-sync`, `v0.6-mcp-server`

4. **Merge with inspection** (never blind-commit):
   ```bash
   git merge upstream/master --no-commit --no-ff
   ```

5. **Verify no conflicts + no conflict markers:**
   ```bash
   grep -rn "<<<<<<< " --include="*.ts" --include="*.md" --include="*.json"
   ```

6. **Spot-check auto-merged files** for correct merge decisions:
   - `src/commands/init.ts` — your `~/.rbrain` rename + their symlink fixes
   - `src/commands/integrations.ts` — your path changes + their new features
   - `src/core/file-resolver.ts` — your path changes + their security fixes

7. **Run tests:**
   ```bash
   cd /Users/cole/RBrain && source .env 2>/dev/null
   DATABASE_URL="" bun test  # Unit tests only (fast, ~5s)
   ```
   **Pre-existing failures** (do NOT investigate unless the delta changes):
   - `pglite-lock` (3 tests) — no PGLite locally
   - `detectInstallMethod` (1 test) — env-specific heuristic
   - `check-update` timeout — flaky network test
   - occasional `skills conformance` mismatches from local custom skills
   - `checkResolvable` orphan-trigger / resolver debt already present in the fork

   A good merge can still look like "1707 pass, 0 new failures" with only the known baseline above remaining.
   E2E tests require `DATABASE_URL` and hit live Supabase — run separately if needed.

8. **Commit and push:**
   ```bash
   git add -A
   git commit -m "merge: upstream GBrain vX.Y.Z — <summary>"
   git push origin master
   ```
   If push rejected (someone merged via GitHub already): check `git diff origin/master master --stat` — if empty, just `git reset --hard origin/master`.

9. **Verify `--no-commit` staged files**: When using `--no-commit --no-ff`, files are modified in the working tree but NOT staged. You must `git add -A` before committing or the merge commit will be empty.

10. **GitHub web merges**: Ramy sometimes merges upstream PRs directly on GitHub. Always check `git log origin/master` first — if the merge is already there, just `git pull` or `git reset --hard origin/master` instead of doing a duplicate local merge.
11. **Legacy Supabase schema warning**: if a post-merge migration or `scripts/migrate-supabase.ts` fails before doing real work with missing `links.link_source` / `origin_page_id` columns, the local database may predate the v11 links-table expansion. Apply the dedicated recovery skill/runbook before retrying migrations; re-running blindly will not fix it.
12. **`CREATE TABLE IF NOT EXISTS` does not upgrade existing live tables**: upstream may add columns inside table definitions that old Supabase projects will never receive automatically. Add explicit versioned migrations and runtime/schema guards for new columns before relying on new code. Example from v0.22.0/source-aware search: legacy `content_chunks` needed `search_vector` plus trigger/backfill before RBrain MCP search stopped failing with `column cc.search_vector does not exist`.
13. **GitHub Actions PR permissions**: the upstream-sync Action can successfully create a branch but fail at PR creation with `GraphQL: Resource not accessible by integration (createPullRequest)`. Treat this as token/permissions, not necessarily a merge failure; inspect the branch/merge locally and push manually or fix workflow permissions.
14. **Fresh upstream PR triage**: when Ramy asks to review/merge fresh upstream fixes and PRs, do not only merge `upstream/master`. Also inspect open upstream PRs with `gh pr list --repo garrytan/gbrain` and merge only PRs that are green, narrowly scoped, and cleanly compatible with the fork. Leave unstable/no-check/dirty PRs unmerged with evidence.
15. **Trusted local list caps**: RBrain CLI list/read paths may have remote-safety caps intended for MCP/remote callers. If asked to remove a local CLI page cap, preserve remote/MCP safety caps while making trusted local list calls unlimited by default. Add regression tests for the local unlimited path and the remote capped path.
16. **Fork-specific cycle test drift**: the fork may intentionally diverge from upstream's expected cycle shape. In April 2026, RBrain used a 7-phase cycle; update tests to match the fork's actual resolver/cycle contract rather than forcing upstream assumptions if runtime behavior confirms the fork contract.
17. **Dashboard local telemetry safety**: dashboard pages that expose local agent telemetry (for example `~/.codex/sessions`) must be loopback-gated before merging. Verify changed-file lint and `dashboard` build, not just TypeScript compilation.
18. **Rebase-to-upstream mode**: if Ramy explicitly asks to rebase RBrain onto GBrain master, first create a backup branch and stash local work. Use `git rebase -X theirs upstream/master` so fork commits replay over current upstream. During this mode, drop historical "Revert upstream PR #..." commits once those PRs are now present in `upstream/master`; replaying those reverts will remove legitimate upstream code. Also check `VERSION` and `package.json` after rebase — old fork version commits can downgrade the CLI version and must be restored to upstream's current version. If ignored private paths block rebase (for example live `voice-agent/`), do not move/overwrite them; skip obsolete historical commits that tried to add those private paths.
19. **Post-rebase verification must include CI pre-test gates**: targeted tests and conflict-marker scans are insufficient after a large upstream rebase. Before force-pushing rebased `master`, run the same gates CI runs, especially `scripts/check-jsonb-pattern.sh && scripts/check-progress-to-stdout.sh && scripts/check-wasm-embedded.sh && bun run typecheck`, then targeted tests and/or `bun test`. A prior rebase passed local smoke tests but GitHub Actions failed on `bun run typecheck` because replayed stale fork code left duplicate `config` declarations, missing `join`/`homedir` imports, missing upgrade helpers, and stale code-page type contracts.
20. **RBrain cycle phase drift**: RBrain's fork intentionally adds the `promotion` phase after upstream's cycle phases. As of upstream v0.23.0, upstream has 8 phases (`lint → backlinks → sync → synthesize → extract → patterns → embed → orphans`), so RBrain should have 9 phases with `promotion` appended. After merging upstream cycle tests, use `ALL_PHASES.length` / `CyclePhase[]`-typed expected arrays instead of hard-coded counts, and verify `src/core/cycle.ts` imports `homedir` if the promotion stamp path uses it.

## Common Conflict: CLAUDE.md header

Upstream frequently expands the opening paragraph of CLAUDE.md (the "GBrain is a..." description). This is almost always the only conflict. Take upstream's version, it's a superset. The local machine section (Supabase project, MCP path) lives below the conflict and is untouched.

## GStack (no fork)

Ramy deleted `ramybarsoum/RStack` (April 2026). No custom commits, pure overhead. GStack is used directly from `garrytan/gstack`.

GStack is installed on both machines:
- **cole-macbook:** `~/.claude/skills/gstack/` (installed, built v0.17.0+)
- **ramy-macbook:** Install via Claude Code: `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`

GStack is the coding skills engine (ship, review, QA, investigate, office-hours, retro). GBrain/RBrain is the "mod" that plugs into it. There is no separate "GStackBrain" repo.

## Notable Upstream Features to Watch

| Branch/PR | Feature | Status |
|-----------|---------|--------|
| `search-quality-boost` | Eval harness (P@k, nDCG@k), cosine re-scoring, RRF normalization | Unmerged |
| `pglite-engine` | Embedded Postgres via WASM | Merged |
| `v0.6-mcp-server` | MCP stdio server | Merged |
| v0.9.x security waves | Path traversal, symlink hardening, typed health checks | Merged |

## Health Check DSL (v0.9.3+)

The new typed health check DSL replaces raw `execSync` shell strings in recipes:
- `http` — check URL returns 200
- `env_exists` — verify env var is set
- `command` — run a command safely
- `any_of` — pass if any sub-check passes

Run `gbrain integrations doctor` to exercise the new checks.
