---
name: grill-me
version: 1.0.0
description: |
  Interview the user relentlessly about a plan or design until reaching shared
  understanding, resolving each branch of the decision tree. Use when user wants
  to stress-test a plan, get grilled on their design, or mentions "grill me".
triggers:
  - "grill me"
  - "stress test this plan"
  - "poke holes in this"
  - "challenge this design"
  - "interview me about this"
tools:
  - search
  - query
  - get_page
mutating: false
source: mattpocock/skills/grill-me
---

# Grill Me Skill

> Based on [mattpocock/skills/grill-me](https://github.com/mattpocock/skills)

## Contract

Interview the user relentlessly about every aspect of their plan until reaching shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

## Phases

### Phase 1: Load context

Before grilling, load relevant context:
1. Read `~/RBrain/skills/RESOLVER.md` for brain context.
2. If the plan references known entities (people, projects, companies), query RBrain for compiled truth.
3. If a question can be answered by exploring the codebase, explore the codebase instead of asking.

### Phase 2: Interview

For each question:
1. Ask one question at a time.
2. Provide your recommended answer with rationale.
3. Walk down each branch of the design tree.
4. Resolve dependencies between decisions before moving forward.
5. Challenge assumptions. Push back where the plan has gaps, contradictions, or untested premises.

### Phase 3: Summary

After reaching shared understanding on all branches:
1. Summarize the resolved decisions.
2. Flag any remaining open questions or risks.
3. If changes were agreed on, list them as actionable next steps.

## Rules

- One question at a time. Never dump a list.
- Provide your recommended answer for each question. Don't just ask, take a position.
- If a question can be answered by reading code or brain pages, do that instead of asking.
- Push back on weak reasoning. Don't accept "it depends" without exploring the branches.
- For AllCare plans: validate against product principles (Dining Table, Invisible Pen, AI Battalion, Early Whisper) and HIPAA constraints.

## Output Format

When the grilling is complete:

```markdown
## Resolved Decisions
- {Decision 1}: {resolution} — rationale
- {Decision 2}: {resolution} — rationale

## Open Questions
- {Unresolved question} — what's blocking it

## Next Steps
- {Actionable item 1}
- {Actionable item 2}
```

## Anti-Patterns

- Asking multiple questions at once instead of walking one branch at a time
- Failing to take a position on each question before asking the user
- Accepting "it depends" without walking the dependency branches
- Skipping codebase or brain reads when the answer is already available
- Forgetting to validate AllCare plans against product principles and HIPAA
