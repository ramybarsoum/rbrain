---
name: install-ob1-skill
description: |
  Install a skill from the OB1 repository (github.com/natebjones-projects/ob1) into
  both Hermes Agent skills and the user's rbrain repo. Handles directory discovery,
  bulk download, naming fixes, and verification.
---

# Install OB1 Skill

## When to Use

- User says "install this skill" and provides an OB1 GitHub link
- User wants a skill from the OB1 repo installed for both Hermes and rbrain

## Prerequisites

- OB1 repo: `https://github.com/natebjones-projects/ob1/tree/main/skills/<skill-name>`
- Two target locations:
  - Hermes: `~/.hermes/skills/<skill-name>/`
  - rbrain: `~/rbrain/skills/<skill-name>/`
- User's brain is called **RBrain** (not "Open Brain")

## Process

### 1. Discover the full file tree

Navigate to the skill's GitHub directory page and expand the file tree. OB1 skills can have:
- `SKILL.md` (required)
- `metadata.json`, `README.md`
- `references/` — supplementary markdown files
- `scripts/` — Python scripts
- `variants/` — per-client SKILL.md overrides (e.g. `claude-code/SKILL.md`, `codex/SKILL.md`)

Browse each subdirectory to get the complete file list. **Do not assume** the structure — some skills are flat (3 files), others have deep trees (9+ files across 4 subdirs).

### 2. Download all files via curl

Use the raw GitHub URL pattern:
```
https://github.com/natebjones-projects/ob1/raw/refs/heads/main/skills/<skill-name>/<relative-path>
```

**Pitfall:** `web_extract` and direct URL fetching may fail due to tool outages. `curl -sL` from the terminal is the most reliable method.

**Pitfall:** Create the root directory with `mkdir -p` BEFORE downloading files into it. If you only create subdirectories, root-level files (SKILL.md, metadata.json) will fail silently because the parent dir doesn't exist.

```bash
# CORRECT — create root first
mkdir -p ~/.hermes/skills/<skill-name>
mkdir -p ~/rbrain/skills/<skill-name>

# Then create subdirs
mkdir -p ~/.hermes/skills/<skill-name>/references
mkdir -p ~/.hermes/skills/<skill-name>/scripts
mkdir -p ~/.hermes/skills/<skill-name>/variants/claude-code

# Download each file
curl -sL "https://github.com/natebjones-projects/ob1/raw/refs/heads/main/skills/<skill-name>/<file>" -o "<dest>"
```

Download to **both locations** in the same loop.

### 3. Fix "Open Brain" → "RBrain"

OB1 skills reference "Open Brain" as the generic brain name. Ramy's brain is called **RBrain**.

```bash
# Check for occurrences
grep -c "Open Brain" ~/.hermes/skills/<skill-name>/SKILL.md

# Replace in both locations (use patch tool with replace_all=true)
```

Use the `patch` tool with `replace_all: true` for both:
- `~/.hermes/skills/<skill-name>/SKILL.md`
- `~/rbrain/skills/<skill-name>/SKILL.md`

Also check `references/` and other .md files for the same issue.

### 4. Verify

1. Check file tree: `find ~/.hermes/skills/<skill-name> -type f | sort`
2. Count "Open Brain" remaining: should be 0
3. Check skills_list to confirm Hermes picks it up (automatic, no reload needed)

## Output

Tell the user:
1. Where it was installed (both paths)
2. File tree with sizes
3. No reload needed for Hermes
4. Any naming fixes applied

## Cron Job Setup (if requested)

If user wants a recurring run of the skill:
```python
cronjob(
    action="create",
    name="<skill-name>",
    schedule="<cron>",  # e.g. "0 9 * * 1" for weekly Monday 9am
    skills=["<skill-name>"],
    deliver="<target>",  # e.g. "discord:<channel_id>"
    prompt="<self-contained instructions>"
)
```

## Pitfalls Log

| Issue | Fix |
|-------|-----|
| `web_search`/`web_extract` both down | Use `curl -sL` from terminal instead |
| Root dir not created before files | `mkdir -p` the root dir first, then subdirs |
| "Open Brain" in OB1 skills | Replace with "RBrain" using patch replace_all |
| Google/DuckDuckGo captcha in browser | Go directly to source sites (TechCrunch, The Verge) |
| File download appears successful but file missing | Verify with `wc -c` not just curl exit code |
