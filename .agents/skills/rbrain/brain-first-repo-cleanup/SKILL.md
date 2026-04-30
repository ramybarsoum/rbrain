---
name: brain-first-repo-cleanup
version: 1.0.0
description: Clean up multi-repo setup using Garry Tan's GBrain pattern. Brain is foundation, CLAUDE.md files are thin pointers. Resolvers are fractal.
triggers:
  - "clean up repos"
  - "multi-repo setup"
  - "brain-first pattern"
  - "trim CLAUDE.md"
---

# Brain-First Multi-Repo Cleanup

Clean up a multi-repo setup using Garry Tan's GBrain pattern: brain is the foundation, local CLAUDE.md files are thin pointers.

## Architecture

- **`~/RBrain/SOUL.md`** — user identity, writing style, company info, key people, product principles. FILE, not a brain page.
- **`~/RBrain/skills/RESOLVER.md`** — skill router, MCP tool lookup, filing resolver. FILE, not a brain page.
- **`~/RBrain/CLAUDE.md`** — brain repo project instructions (keep as-is, same as Garry's).
- **`~/<repo>/CLAUDE.md`** — thin pointer + project-specific rules only (~200 lines max).

## Resolvers are fractal

1. **Skill resolver** (RESOLVER.md) — maps triggers to skill files
2. **Filing resolver** (RESOLVER.md `## Filing resolver`) — maps content types to directories
3. **Context resolver** (inside each skill) — sub-routing within the skill

## Hard rule for every local CLAUDE.md

Add this at the top:

```markdown
## Before any task

1. Read `~/RBrain/SOUL.md` for user personality, writing style, company info, key people.
2. Read `~/RBrain/skills/RESOLVER.md` for skill routing and MCP tool lookup.
3. Never guess about people, companies, skills, or MCPs. The resolver has the answer.
```

## Steps

1. **Study the reference implementation** (github.com/garrytan/gbrain). Fetch CLAUDE.md, RESOLVER.md, README.md. Understand the wiring before proposing anything.
2. **Consult the user first.** For each file to trim, present a table: section | cut/keep | why. Wait for approval before writing.
3. **Update RESOLVER.md** if needed: add missing skills, MCP tools section, filing resolver, "Always read first" section.
4. **Trim local CLAUDE.md files.** Keep only: hard rule + project-specific rules (HIPAA patterns, HeroUI patterns, test/build commands, repo structure). Remove anything duplicated from SOUL.md or RESOLVER.md.
5. **Delete duplicate files** (SOUL.md, RESOLVER.md copies in other repos).
6. **Run resolver tests.** `bun test test/resolver.test.ts` in RBrain repo. Add routing test cases for any new skills added.
7. **Report.** Before and after line counts, duplicates found, tests status.

## Pitfalls

- **Files, not pages.** SOUL.md and RESOLVER.md must be files that agents read every session. Brain pages require explicit API calls and won't be loaded automatically.
- **Never rewrite without consulting.** The user wants to review what you'll cut before you cut it.
- **Don't assume the pattern.** Study the actual reference repo first. Garry's GBrain may not have CLAUDE.md or SOUL.md at the root (they live in skills/ and templates/).
- **RBrain/CLAUDE.md stays as-is.** It's the brain repo's own project instructions, same as Garry's. Don't trim it.
- **Test after changes.** The resolver test validates every skill is reachable, sections exist, conventions referenced. Add routing cases for new entries.
