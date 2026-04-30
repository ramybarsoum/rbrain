---
name: clean-local-dirty-files
description: Triage and clean a repo's dirty working tree while preserving intentional local work. Use when the user asks to "fix dirty files", clean local changes, or sort an uncommitted worktree.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [git, cleanup, dirty-worktree, tests, triage]
    related_skills: [github-pr-workflow, systematic-debugging]
---

# Clean Local Dirty Files

Use this when a user asks to fix or clean local dirty files in a repository.

## Goal

Turn an ambiguous dirty worktree into a safe, reviewable state:
- Preserve intentional product/code/test changes.
- Remove accidental local artifacts.
- Restore accidental deletes or unrelated edits.
- Verify the remaining changes with targeted tests.
- Do **not** commit unless the user explicitly asks.

## Workflow

1. **Load context and inspect status**
   ```bash
   pwd
   git status --short
   git branch --show-current
   git diff --stat
   git diff --name-status
   git log --oneline -5
   ```

2. **Classify dirty files**

   Bucket every changed/untracked file:
   - **Intentional code/test/docs changes**: coherent feature or bugfix diffs with tests.
   - **Accidental artifacts**: `.DS_Store`, repo-local `.hermes/`, editor temp files, logs, generated scratch files.
   - **Risky/orphan work**: untracked large feature files, files with hardcoded secrets, duplicated local infra, or changes whose dependencies were removed.
   - **Nested app scaffold meant to travel with the repo**: e.g. `apps/<name>/` Remotion/Next/etc. If the user wants teammates/forkers to get it, commit only source/config/lockfiles and app docs; add/verify ignores for `node_modules/`, generated bundles (`build/`, `dist/`, `out`), and `.env*` at both app-local and root levels. Do not move it to a separate repo unless it needs independent deployment, releases, permissions, or non-repo users. If local Node fails with a Homebrew dylib error (for example stale `libsimdjson.*.dylib`), root-cause with `brew list --versions node simdjson`, `node --version`, and `otool -L $(which node)`; clean stale formula versions with `brew cleanup node simdjson` only after confirming the current linked Node works.
   - **Shared cross-agent skills**: if the repo uses a canonical shared skill root such as `.agents/skills/`, commit that root and its lock/routing docs, but delete exact duplicate skills under legacy/root `skills/<name>/` after hash-comparing them. Do not keep two identical sources of truth.
   - **RBrain/brain-generated product artifacts**: commit final durable pages/specs/reports that should travel with team forks (for example `book-mirror/*.md`, `docs/designs/*.md`, scheduler/weekly/nightly reports), but do not commit private/copyright/raw working artifacts such as PDFs/EPUBs, NotebookLM audio/slides/logs/notebook IDs, runtime recall caches, or machine-local memory state. Move/ignore them instead.
   - **Accidental deletion**: deleted files that are not clearly part of the requested cleanup.

3. **Inspect before deleting**

   Before removing untracked files/directories, inspect them enough to know whether they are accidental:
   ```bash
   git diff -- <path>
   ```
   Use `read_file` / `search_files` for untracked contents. If an untracked file contains secrets or stale infra code, remove it rather than preserving it in the repo.

4. **Clean obvious artifacts**

   Safe examples:
   ```bash
   rm -f .DS_Store
   rm -rf .hermes
   ```

5. **Restore accidental deletes**

   If a tracked file was deleted without a clear reason:
   ```bash
   git restore path/to/file
   ```

6. **Remove or revert orphaned/risky local feature fragments**

   If untracked files plus partial tracked changes form an incomplete or unsafe local feature, remove the untracked files first, then revert only the tracked pieces that are now orphaned. Prefer targeted `git restore <file>` or `patch` over broad resets.

7. **Verify remaining changes**

   Always run:
   ```bash
   git diff --check
   source venv/bin/activate && python -m py_compile <modified-python-files>
   ```

   Then run focused tests covering the remaining dirty files, for example:
   ```bash
   source venv/bin/activate && python -m pytest <relevant test files> -q
   ```

   If practical, run the full suite. If the full suite fails with broad unrelated baseline/environment failures, do not chase them unless they are localized to the dirty changes. Capture a few representative failures and state that the focused target suite passed.

8. **Final status report**

   End with:
   - What was removed/restored/reverted.
   - What intentional diffs remain.
   - Verification commands and results.
   - Whether full suite passed or had unrelated baseline/env failures.
   - Explicitly say no commit was made unless you committed.

## Pitfalls

- Do **not** run `git reset --hard` or `git clean -fd` unless the user explicitly authorizes destructive cleanup of all local work.
- Do **not** assume all untracked files are junk; inspect first.
- Do **not** keep untracked files containing hardcoded secrets or machine-specific infra assumptions.
- Do **not** chase unrelated full-suite failures when a focused dirty-file suite is clean and failures are clearly environment/baseline.
- For this user's Hermes repo, never kill/restart port 8080.
