---
name: article-apply-changes
version: 1.0.0
description: |
  Execute only the article-derived changes Ramy explicitly approved. Parse numbered or
  free-form confirmations, apply updates sequentially, log the batch in RBrain, and
  report exact slugs and paths changed. Use after article-learning, never before.
triggers:
  - "apply 1, 3, 5"
  - "all except 2"
  - "apply the approved article changes"
  - "make those article updates"
  - "go ahead and apply them"
tools:
  - search
  - query
  - get_page
  - list_pages
  - resolve_slugs
  - put_page
  - add_tag
  - add_link
  - add_timeline_entry
  - log_ingest
mutating: true
chains_from:
  - article-learning
---

# Article Apply Changes Skill

> **Filing rule:** Read `skills/_brain-filing-rules.md` before creating or updating any page.
> **Identity:** Read `get_page("soul-ramy-barsoum")` before applying changes. Respect SOUL.md decision rights and writing style.
> **This is step 2 of 2.** This skill executes only approved changes from article-learning.

## Contract

This skill guarantees:
- Only explicitly approved changes are applied.
- Confirmation parsing handles numbered selections, exclusions, ranges, and free-form edits.
- Execution is sequential, not parallel.
- Every applied change records the exact slug or file path touched.
- The batch is logged once with `log_ingest` using `source_type: "article-review"`.
- Scope stays tight. Downstream issues are flagged, not opportunistically fixed.

## When to use this

Use this only after `article-learning` produced a `Changes Awaiting Your Approval` section and Ramy explicitly approved some or all items.

Do not use this skill to interpret vague intent. If the confirmation is ambiguous, restate what would be applied and wait for a clear `go`.

## Phases

### Phase 1: Parse confirmation

Parse confirmations like:
- `1, 3, 5`
- `all except 2`
- `1-4`
- modified selections
- free-form approval text that clearly maps to the numbered list

Restate the selection in this shape:

```markdown
Applying:
1. {Change} — {landing spot}
2. ...

Skipping:
- {Change} — {reason}
```

If the original confirmation is clean, proceed without another wait.
If the confirmation is ambiguous, stop after the restatement and wait for a final `go`.

### Phase 2: Execute approved changes

Execute sequentially. Not in parallel.

Landing spot rules:

- **RBrain pages**: use `put_page` with slug conventions matching the existing brain schema (`concepts/`, `projects/`, `people/`, `meetings/`, `quotes-`, `digests/`). Use the correct page type. Add tags with `add_tag`. Add links with `add_link`. Add timeline entries with `add_timeline_entry` if the change reflects a decision or shift.
- **Skills**: identify the exact skill file, show the diff, write the change, and report the path.
- **Prompts**: store as an RBrain concept page or inside the relevant skill. Include usage notes.
- **Workflows**: store as an RBrain page (`concept` or `project`). Link affected projects and tag appropriately.
- **AllCare.ai decisions**: never touch production. Draft only as a project page and flag for team review. Tag with the relevant product principle when applicable.

After the full batch:
- call `log_ingest` once
- `source_type`: `article-review`
- `source_ref`: the article URL, title, or explicit source reference
- `summary`: short summary of what changed
- include `pages_updated`

For each approved item, capture:
- what changed
- slug or path
- tags, links, and timeline entries added
- any errors

### Phase 3: Failures and scope control

If one change fails:
- stop that change
- log the error in the report
- continue with the next approved change

If a downstream issue is discovered:
- flag it
- do not fix it under the same approval
- treat it as a new change that needs new confirmation

If content already exists or duplicates another page:
- flag the duplication
- ask whether to merge, replace, or add
- do not guess

If there is a conflict with an existing page or pinned decision:
- pause that change
- surface the conflict clearly
- wait for direction

## Output Format

```markdown
## Applied
1. {Change} — `slug/or/path` — one line on what is different now
2. ...

## Failed or Skipped
- {Change} — reason — resolution path

## Follow-Ups Worth Considering
- Optional next steps only
```

Keep it tight. Bullets. Exact slugs and paths in code formatting.

## Anti-Patterns

- Applying anything that was not explicitly approved
- Touching AllCare.ai production instead of drafting the change
- Expanding scope because a related cleanup looks tempting
- Hiding conflicts or duplicate-content decisions
- Forgetting `log_ingest` after the batch
- Running changes in parallel
- Including PHI or non-opaque identifiers
