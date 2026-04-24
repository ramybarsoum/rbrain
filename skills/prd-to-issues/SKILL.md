---
name: prd-to-issues
version: 1.0.0
description: |
  Break a PRD into independently-grabbable GitHub issues using tracer-bullet
  vertical slices. Use when user wants to convert a PRD to issues, create
  implementation tickets, or break down a PRD into work items.
triggers:
  - "Break PRD into issues"
  - "break this PRD into issues"
  - "PRD to tickets"
  - "create issues from PRD"
  - "prd to issues"
  - "convert PRD to tickets"
  - "break down this PRD"
tools:
  - search
  - query
  - get_page
mutating: false
source: mattpocock/skills/prd-to-issues
---

# PRD to Issues Skill

> Based on [mattpocock/skills/prd-to-issues](https://github.com/mattpocock/skills)

## Contract

Break a PRD into independently-grabbable GitHub issues using vertical slices (tracer bullets). Each issue is a thin end-to-end slice through all integration layers, not a horizontal slice of one layer.

## Phases

### Phase 1: Load context

1. Ask the user for the PRD (GitHub issue number, URL, or document).
2. If the PRD references known entities (projects, people, services), query RBrain for compiled truth.
3. If you haven't explored the codebase, do so to understand current state.

### Phase 2: Draft vertical slices

Break the PRD into **tracer bullet** issues.

Rules:
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests).
- A completed slice is demoable or verifiable on its own.
- Prefer many thin slices over few thick ones.

Each slice is typed:
- **AFK** — can be implemented and merged without human interaction. Prefer these.
- **HITL** — requires human interaction (architectural decision, design review, HIPAA sign-off).

For AllCare work:
- Any slice touching patient safety, HIPAA compliance, or auth model changes must be HITL.
- Cross-service slices must call out which services are involved and confirm API gateway endpoints exist.
- Validate slices against product principles (Dining Table, Invisible Pen, AI Battalion, Early Whisper).

### Phase 3: Quiz the user

Present the proposed breakdown as a numbered list. For each slice show:
- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices must complete first
- **User stories covered**: which user stories from the PRD this addresses

Ask:
- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves.

### Phase 4: Create GitHub issues

For each approved slice, create a GitHub issue using `gh issue create`. Create in dependency order (blockers first) so real issue numbers can be referenced.

Issue body template:

```markdown
## Parent PRD

#<prd-issue-number>

## What to build

Concise description of this vertical slice. End-to-end behavior, not layer-by-layer. Reference specific sections of the parent PRD.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #<issue-number>

Or "None - can start immediately" if no blockers.

## User stories addressed

- User story 3
- User story 7
```

Do NOT close or modify the parent PRD issue.

## Rules

- Vertical slices only. Never horizontal (e.g., "do all the DB work", "do all the UI work").
- Each slice must be independently demoable.
- Confirmation required before creating any GitHub issues.
- No PHI in issue titles, descriptions, or acceptance criteria.
- Use "Escalated" not "HITL" in user-facing issue text (AllCare terminology).

## Output Format

One or more GitHub issues, each containing:

```markdown
## Parent PRD
#<prd-issue-number>

## What to build
{End-to-end behavior, not layer-by-layer.}

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by
- Blocked by #<issue-number> or "None — can start immediately"

## User stories addressed
- User story 3
- User story 7
```

Issues are created in dependency order (blockers first).

## Anti-Patterns

- Creating horizontal slices instead of vertical ones
- Skipping user confirmation before creating GitHub issues
- Including PHI in issue text
- Creating thick slices that bundle too many layers
- Forgetting to validate against AllCare product principles and HIPAA constraints
- Closing or modifying the parent PRD issue during slice creation
