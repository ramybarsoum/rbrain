---
name: rbrain-skill-editing
description: Safely create or update skills in the local RBrain repo. Inspect local skill files before assuming a skill is missing, wire manifest and resolver carefully, run conformance, and separate your changes from pre-existing repo drift.
version: 1.0.0
---

# RBrain Skill Editing

## When to use

Use this when asked to create, split, or update a skill in `~/RBrain/skills/`, especially when the user describes the desired behavior in prompts or wants skill routing updated.

## Contract

This skill guarantees:
- Check the local RBrain repo before assuming a skill does not exist
- Read `~/RBrain/SOUL.md`, `~/RBrain/RESOLVER.md`, and `~/RBrain/skills/RESOLVER.md` first
- Inspect adjacent skills for conventions before editing anything
- Update resolver and manifest only as needed for the requested skill change
- Run the local conformance test and separate task-related failures from pre-existing repo debt
- Report exact files changed and call out unrelated dirty state instead of hiding it

## Workflow

### Step 1: Inspect the local repo first

Do not rely only on RBrain pages or MCP search to decide whether a skill exists.

Check:
- `~/RBrain/SOUL.md`
- `~/RBrain/RESOLVER.md`
- `~/RBrain/skills/RESOLVER.md`
- `~/RBrain/skills/manifest.json`
- nearby skill files in `~/RBrain/skills/*/SKILL.md`

Look for:
- an existing skill with overlapping scope
- whether the requested change should extend an existing skill or split into two skills
- repo conventions for frontmatter, sections, and routing language

### Step 2: Inspect current repo state before wiring changes

Before editing resolver or manifest, check for existing drift:
- run `git status --short`
- if needed, inspect targeted diff scope with `git diff -- <files>`

Assume `skills/RESOLVER.md` and `skills/manifest.json` may already contain unrelated local edits. Do not claim the full diff is yours unless you verified it.

### Step 3: Make the smallest valid change

Prefer the smallest change that matches the user's requested behavior.

Patterns:
- If an existing skill is overloaded, split it into explicit steps
- If the user wants a review step and an apply step, make the review skill non-mutating and the apply skill mutating
- Keep confirmation gates explicit for any write path
- Add routing entries in `skills/RESOLVER.md`
- Add manifest entries in `skills/manifest.json`
- If the real problem is context bloat from always loading routing docs, do **not** split `RESOLVER.md` by default. Prefer adding a hard rule in `CLAUDE.md` or `AGENTS.md` that `skills/RESOLVER.md` is read only when skill routing, filing guidance, or a specific brain-writing workflow is needed
- When importing a skill from an external repo, do **not** copy it verbatim by default. First inspect the upstream `SKILL.md` plus any linked workflow docs/scripts, then normalize hardcoded paths, agent-specific directories (for example `.claude/...`), and repo-local assumptions to RBrain conventions before writing anything

#### Fetching files from GitHub repos

When importing a skill from a GitHub repo, use this fallback chain:

1. **`curl` raw URLs first** — fastest and most reliable for individual files:
   ```bash
   curl -sL 'https://raw.githubusercontent.com/{owner}/{repo}/main/{path}' -o ~/RBrain/skills/{dest}
   ```
2. **Browser + Raw view** — if you need to read a file first to decide whether to fetch it, navigate to the GitHub page, click the `Raw` link, then extract via `browser_console` (`document.body.innerText`).
3. **Avoid `web_extract` for GitHub** — it frequently fails on raw.githubusercontent.com URLs. Don't waste time on it.

For bulk fetching (SKILL.md + scripts + workflows), use `execute_code` with a loop of `curl` calls — much faster than navigating one file at a time.

#### External skill adaptation checklist

When importing a third-party skill into RBrain:

- [ ] **Replace agent-specific paths.** Upstream skills often reference `.claude/skills/...`, `~/projects/{tool}/`, or other agent-local directories. Replace with RBrain-native paths (`~/RBrain/skills/{name}/...`) or project-relative paths.
- [ ] **Check Python version compatibility.** System Python on macOS is often 3.9, which crashes on `str | None` union syntax (3.10+). If the skill depends on Python packages, verify the package imports cleanly on system Python. If not, set up a dedicated venv with a modern Python (e.g. `uv venv --python 3.13 ~/projects/{tool}`).
- [ ] **Verify CLI commands match docs.** Upstream skill instructions may reference outdated commands (e.g., `nlm auth login` when the actual command is `nlm login`). Always run `--help` on newly installed tools to confirm the real command surface.
- [ ] **Note auth requirements.** If the skill requires interactive browser auth (Google OAuth, etc.), flag it explicitly in the SKILL.md and in the report to the user — it can't be completed autonomously.
- [ ] **Keep upstream source link.** Add a `> **Upstream source:**` line in the SKILL.md pointing to the original repo for future reference.

### Step 4: Verify locally

Run:
```bash
bun test test/skills-conformance.test.ts
```

Interpret results carefully:
- If your new or edited skill passes but the suite still fails, check whether failures are pre-existing
- Do not fix unrelated repo debt unless the user asked for that
- Explicitly separate "my change passed" from "the repo is already red"

**Common conformance failures on imported skills:**
- Missing `## Contract` section (imports often use `## Problem` or `## Overview` instead). Add Contract, don't rename the existing section.
- Missing `## Output Format` section (imports often use `## Output` or `## Notes`). Add Output Format alongside it.
- Missing `## Anti-Patterns` section (imports often use `## Rules`, `## Guardrails`, or `## Notes`). Add Anti-Patterns as a separate section.
- Missing manifest entry (test asserts every skill directory is listed in manifest.json). Compare `ls ~/RBrain/skills/*/SKILL.md` against manifest entries.

**Fix pattern for imported skills:** Keep the original content. Add the missing conformance sections below the existing content. Do not restructure the whole file.

### Step 5: Report tightly

Report:
- files created or modified
- what changed in each
- whether the new or updated skill passed conformance
- any unrelated pre-existing failures or dirty repo state
- any important caveat about untracked or already-modified files

## Anti-Patterns

- Assuming a skill is missing because it does not appear in RBrain pages
- Editing repo skills without checking local `~/RBrain/skills/`
- Treating the entire `git diff` as your work without checking prior dirty state
- Quietly fixing unrelated failing skills during a focused task
- Claiming the repo is broken because of your changes when failures are pre-existing
- Skipping resolver or manifest wiring after creating a new skill
- Skipping conformance verification

## Verification checklist

- `SOUL.md`, top-level `RESOLVER.md`, and `skills/RESOLVER.md` read
- local skill existence checked
- manifest entry present
- resolver routing entry present
- conformance test run
- unrelated dirty state called out
