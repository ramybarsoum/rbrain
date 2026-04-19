---
name: router-pattern
type: convention
description: How the RBrain router works — thin rows in RESOLVER.md point at fat files only when complexity earns them. Applied consistently across skills/, mcps/, and tools/. Read before adding a new MCP, tool, or skill entry.
---

# Router Pattern — Thin Rows Point at Fat Files

**This is a foundational organizational rule for RBrain. Any AI agent (Claude Code, Hermes, Codex, Cursor, future agents) adding content must respect this pattern.**

## The rule in one sentence

`skills/RESOLVER.md` is the thin index. Depth lives in per-entry files only when that entry has earned the second layer.

## The structure

```
~/Projects/RBrain/
├── skills/
│   ├── RESOLVER.md              ← thin router. One row per skill/MCP/tool.
│   ├── conventions/             ← cross-cutting rules (this file)
│   │   └── router-pattern.md    ← ← you are here
│   ├── _brain-filing-rules.md
│   ├── _output-rules.md
│   └── <skill-name>/
│       └── SKILL.md             ← fat file. Runtime contract, phases, gotchas.
├── mcps/                        ← fat files for MCPs that earn them
│   ├── README.md                ← folder guard, cites this convention
│   └── <mcp-name>.md            ← fat file: operations, auth, gotchas
└── tools/                       ← fat files for CLIs/services that earn them
    ├── README.md                ← folder guard, cites this convention
    └── <tool-name>.md           ← fat file: setup, runtime surface, gotchas
```

Same shape, three directories: thin router row → optional fat file.

## The "earn the file" test

A new entry graduates from thin-row to fat-file if **any one** of these is true:

1. **Operation surface > 5.** More than ~5 operations, subcommands, or flags worth naming.
2. **Auth complexity.** OAuth, per-machine tokens, proxy config, key rotation rules.
3. **Non-obvious semantics.** Rules that require explanation (e.g., "the `pinned` tag is load-bearing", "compiled_truth vs timeline", "setdefault semantics beat .env").
4. **Multiple gotchas.** 3+ quirks that would bite a new agent on first use.
5. **Multi-step setup.** Install or onboarding takes more than one command.
6. **Cross-machine coordination.** State or tokens need to move between MacBook, cole-macbook, a VM, etc.

If **none** of the above apply, the entry stays as a thin row. The vendor's own docs handle the rest.

## Concrete examples from this repo

| Entry | Classification | Why |
|---|---|---|
| `rbrain` MCP | Fat file `mcps/rbrain.md` | Criteria 1 (36+ ops), 3 (compiled_truth/timeline, pinned semantics), 4 (4+ gotchas) |
| `gws` CLI | Fat file `mcps/gws.md` | Criteria 1 (7 subcommands), 2 (OAuth flow), 4 (rate limits, prefix-sensitive search) |
| `browser-use` cloud | Fat file `tools/browser-use.md` | Criteria 2 (API key conventions), 5 (per-machine bootstrap), 6 (cole-macbook mirror) |
| `browser-harness` | Fat file `skills/browser-harness/SKILL.md` | Criterion 1 (large runtime surface), 4 (many gotchas), 5 (install flow) |
| Discord / Slack / Playwright MCPs | Thin row | None of the criteria met. Vendor docs suffice. |
| Figma / Stedi / HeroUI / Linear | Thin row | Simple purpose. One row tells Claude *when* to reach for them; vendor docs cover *how*. |

## Cross-linking rules (how the router and fat files stay consistent)

Every fat file **must** include:

1. **Back-reference to the router row.**
   Example: `> **Router entry:** `skills/RESOLVER.md` → "MCP Tools" table, row "rbrain".`
2. **Forward-references to related skill files.**
   Example: `> **Related skills:** `skills/brain-ops/SKILL.md`, `skills/query/SKILL.md`.`
3. **A "See also" footer** linking to upstream docs, canonical code paths, and the router row again.

Every router row pointing to a fat file **must** include the file path in the "Depth" column.

This bidirectional link means you cannot update one side without the other side surfacing the change. Drift is noisy, not silent.

## When to promote a thin row to a fat file

Not on a schedule. On evidence.

**Signals that a row has earned graduation:**

- You catch yourself re-explaining the same MCP's semantics twice in different sessions.
- A new machine onboarding repeats the same setup steps for this tool.
- An agent makes the same mistake with it twice.
- You add a skill that chains through this MCP and find no documentation to cite.

When you graduate a row:

1. Create `mcps/<name>.md` or `tools/<name>.md`.
2. Update the "Depth" column of the RESOLVER row to point at it.
3. Mirror as a brain page via `put_page` (so `rbrain search` finds it).
4. Commit atomically — never the fat file without the RESOLVER update, never the RESOLVER update without the fat file.

## When to demote a fat file back to a thin row

Rare, but possible: if a fat file decays to a paragraph that just re-states the vendor's docs, delete it and collapse to a thin row. Dead fat files are worse than thin rows — they imply depth that no longer exists.

## Anti-patterns to refuse

If an agent (or human) proposes any of these, push back and cite this doc:

1. **"Let's add a fat file for every MCP."** — Violates the earn-the-file test. Creates maintenance burden without payoff for simple rows.
2. **"Let's just put everything in RESOLVER.md."** — Works at today's size. Starts eating context at ~400 lines. Fat files are the relief valve.
3. **"Let's add the fat file in `skills/` since it's the same pattern."** — No. `skills/` is for runtime skills the agent *executes*. `mcps/` is for services the agent *calls*. `tools/` is for CLIs and cloud services the agent *shells out to*. Directory carries meaning.
4. **"Let's skip the back-reference — it's obvious."** — No. The back-ref is the drift guard. Without it, router and fat file diverge silently.
5. **"Let's add an MCP by only editing RESOLVER."** — Fine if the row is truly thin. But if it needs auth instructions, setup steps, or gotchas, the edit is a lie of omission — the router implies a fat file exists or that the entry is simple, and it's neither.

## How this rule is enforced

- `skills/RESOLVER.md` header cites this file as required reading before adding entries.
- `mcps/README.md` and `tools/README.md` cite this file as the governance rule for their folders.
- This file is mirrored to RBrain as `skills/conventions/router-pattern` with the `pinned` tag, so session-start `list_pages tag:pinned` surfaces it.
- Every fat file template (see each existing fat file's header) starts with the router back-reference and related-skills block.

## See also

- `skills/RESOLVER.md` — the router this rule governs
- `skills/conventions/quality.md` — citations and back-links (similar drift-guard philosophy)
- `skills/_brain-filing-rules.md` — where different content types get filed
- `mcps/README.md` — folder guard that cites this file
- `tools/README.md` — folder guard that cites this file
