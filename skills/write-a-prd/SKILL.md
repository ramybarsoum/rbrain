---
name: write-a-prd
version: 1.0.0
description: |
  Create a PRD through user interview, codebase exploration, and module design,
  then submit as a GitHub issue. Use when user wants to write a PRD, create a
  product requirements document, or plan a new feature.
triggers:
  - "write a PRD"
  - "create a PRD"
  - "product requirements document"
  - "plan a new feature"
  - "I need a PRD for"
tools:
  - search
  - query
  - get_page
mutating: false
chains_to:
  - prd-to-issues
  - grill-me
source: mattpocock/skills/write-a-prd
---

# Write a PRD Skill

> Based on [mattpocock/skills/write-a-prd](https://github.com/mattpocock/skills)

## Contract

Create a PRD through structured interview, codebase exploration, and module design. The PRD is submitted as a GitHub issue. Steps may be skipped if not necessary.

## Phases

### Phase 1: Problem discovery

1. Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.
2. Query RBrain for context on the problem domain, related projects, people, and prior decisions.
3. Load SOUL.md context to validate against product principles.

### Phase 2: Codebase exploration

Explore the repo to verify assertions and understand current state. For AllCare repos:
- Check which services are involved.
- Confirm API gateway endpoints exist for cross-service calls.
- Identify existing patterns to build on.

### Phase 3: Interview

Interview the user relentlessly about every aspect of the plan until reaching shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

For each question, provide your recommended answer.

For AllCare work, validate each decision against:
- Product principles (Dining Table, Invisible Pen, AI Battalion, Early Whisper).
- HIPAA constraints (PHI handling, audit logging, tenant isolation).
- "Does this reduce manual work for facility staff?"

### Phase 4: Module design

Sketch out the major modules to build or modify. Actively look for opportunities to extract **deep modules** that can be tested in isolation.

A deep module encapsulates a lot of functionality in a simple, testable interface which rarely changes.

Check with the user:
- Do these modules match expectations?
- Which modules need tests?

### Phase 5: Write and submit PRD

Once shared understanding is complete, write the PRD using the template below and submit as a GitHub issue.

## PRD Template

```markdown
## Problem Statement

The problem from the user's perspective.

## Solution

The solution from the user's perspective.

## User Stories

Extensive numbered list covering all aspects:

1. As an <actor>, I want a <feature>, so that <benefit>

## Implementation Decisions

- Modules to build/modify
- Interface changes
- Technical clarifications
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets (they go stale quickly).

## Testing Decisions

- What makes a good test (external behavior, not implementation details)
- Which modules will be tested
- Prior art for tests in the codebase

## Out of Scope

What is explicitly not included in this PRD.

## Further Notes

Any additional context.
```

## Rules

- No PHI in the PRD. Use placeholder data in examples.
- Use "Escalated" not "HITL" in user-facing text (AllCare terminology).
- Do NOT close or modify existing issues during PRD creation.
- After PRD is created, suggest running `prd-to-issues` to break it into implementation tickets.
- After submitting, query RBrain for related entities and suggest cross-links if applicable.

## Output Format

A GitHub issue containing the PRD, structured as:

```markdown
## Problem Statement
{The problem from the user's perspective.}

## Solution
{The solution from the user's perspective.}

## User Stories
1. As an <actor>, I want a <feature>, so that <benefit>

## Implementation Decisions
- Modules to build/modify
- Interface changes
- Technical clarifications
- Architectural decisions

## Testing Decisions
- What makes a good test
- Which modules will be tested

## Out of Scope
{What is explicitly not included.}
```

## Anti-Patterns

- Writing the PRD without interviewing the user first
- Skipping codebase exploration for AllCare repos (service boundaries and API contracts matter)
- Including specific file paths or code snippets in the PRD (they go stale quickly)
- Forgetting to validate against product principles and HIPAA constraints
- Creating the PRD as a local document instead of a GitHub issue
