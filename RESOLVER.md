# RBrain — Top-Level Resolver

This is the schema and filing tree for the brain. Read this before creating or moving any page.

For skill routing (which skill handles which task), see `skills/RESOLVER.md`.
For full filing rules and decision protocol, see `skills/_brain-filing-rules.md`.

## Brain schema

```
~/RBrain/
├── skills/                  ← skill definitions (read on demand, never pre-loaded)
│   ├── RESOLVER.md          ← skill routing tree
│   ├── _brain-filing-rules.md
│   ├── _output-rules.md
│   ├── conventions/         ← cross-cutting quality rules
│   └── {skill-name}/SKILL.md
├── src/                     ← CLI + MCP server (Supabase-backed)
├── templates/               ← page templates (Person, Company, Meeting, etc.)
├── docs/                    ← guides and reference docs
├── SOUL.md                  ← canonical user profile (slug: soul-ramy-barsoum)
└── RESOLVER.md              ← THIS FILE (brain schema)
```

## Brain pages (Supabase)

Pages live in Supabase, accessed via `mcp__rbrain__*` tools. Directory structure is logical (enforced by slug prefixes and tags), not filesystem paths.

| Directory  | Contains                                          | Slug pattern                  |
|------------|---------------------------------------------------|-------------------------------|
| `people/`    | Person pages                                     | `first-last`                  |
| `companies/` | Company pages                                    | `company-name`                |
| `meetings/`  | Meeting notes                                    | `meeting-YYYY-MM-DD-topic`    |
| `concepts/`  | Reusable frameworks, mental models               | `concept-name`                |
| `ideas/`     | Original thinking, proposals                     | `idea-name`                   |
| `projects/`  | Initiatives, product work                        | `project-name`                |
| `working/`   | Active task state and resumable workspace context | `task-or-thread-name`        |
| `sources/`   | Bulk raw data imports ONLY                       | `source-name`                 |
| `decisions/` | Pinned decisions with rationale                  | `decision-name`               |
