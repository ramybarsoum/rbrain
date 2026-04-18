---
name: article-learning
version: 2.0.0
description: |
  Review an article through Ramy's real context. Extract what applies, challenge weak
  ideas, map useful insights to concrete landing spots, and end with explicit approval
  gates. This is the review step only. It does not write changes. Use when Ramy shares
  an article and wants to learn from it before deciding what to apply.
triggers:
  - "read this article"
  - "what can I learn from this"
  - "article learning"
  - shares an article with learning intent
  - "extract learnings from this"
  - "summarize this article for me"
  - "what should I change based on this article"
tools:
  - search
  - query
  - get_page
  - resolve_slugs
  - list_pages
mutating: false
chains_from:
  - idea-ingest
---

# Article Learning Skill

> **Filing rule:** Read `skills/_brain-filing-rules.md` before proposing any landing spot.
> **Identity:** Read `get_page("soul-ramy-barsoum")` before analyzing. SOUL.md has Ramy's context, writing style, active projects, product principles, and decision rights.
> **This is step 1 of 2.** This skill reviews and proposes. It does not apply changes.

## Contract

This skill guarantees:
- Every insight is tied to real RBrain pages, projects, principles, or known priorities. No fabricated context.
- Relevance is explicit. Each insight is scored high, medium, low, or skip.
- Weak ideas get challenged. If the article does not hold up in regulated healthcare SaaS, say so plainly.
- Conflicts with existing pages, active projects, or pinned decisions are surfaced directly.
- Every proposed change has a concrete landing spot and a trade-off.
- Confirmation is non-negotiable. No writes, page updates, timeline entries, or workflow edits happen in this step.

## When to use this vs idea-ingest

- **idea-ingest**: File the article itself into the brain with source handling and entity links.
- **article-learning**: Extract what applies to Ramy's work, challenge what doesn't, and propose specific changes.
- **article-apply-changes**: Execute only the changes Ramy explicitly approved.

These chain naturally. Run idea-ingest first if the article itself should be preserved in the brain. Then run article-learning to turn it into decisions. Only after approval should article-apply-changes run.

## Phases

### Phase 1: Load context

Before analyzing the article, load real context from RBrain:

1. `get_page("soul-ramy-barsoum")`
2. `list_pages({limit: 20})`
3. `query("<article topic/entity>")` for people, projects, tools, and concepts mentioned
4. `resolve_slugs("<partial>")` for fuzzy references
5. `get_page(slug)` on anything directly relevant

If the article or intent is unclear, ask:
1. Article (paste or link)?
2. Priority angle?
3. Immediate apply or file-away?

### Phase 2: Extract and score insights

Identify distinct insights in the article. For each insight, capture:

| Field | Values |
|---|---|
| Relevance | high / medium / low / skip |
| Landing spot | AllCare.ai, RBrain page, skill, workflow, personal |
| Relationship | confirms / challenges / extends current approach |
| Concrete change | specific enough to execute |

For every medium or high relevance insight, expand it into:
- **What it is**
- **What it does**
- **What it means**
- **Why it matters to Ramy**. Tie this to real pages, projects, principles, or active threads.
- **Proposed change**. Make it executable.

Rules:
- Challenge Ramy's current approach when a better one exists.
- Push back when the article does not hold up in regulated healthcare SaaS.
- Surface conflicts with existing pages or pinned decisions directly.
- If any insight should be rejected, add a required `Things to Skip or Push Back On` section.

### Phase 3: Confirm before any writes

End with `Changes Awaiting Your Approval`.

Each item must be numbered and use this shape:
- `[ ] Change name`
- One-line description
- Landing spot (`slug`, skill file, or workflow)
- Risk or trade-off

Accept confirmations like:
- `1, 3, 5`
- `all except 2`
- `none`
- free-form edits or rewritten items

No changes happen without explicit approval.

## Output Format

```markdown
2-3 sentences on the article thesis and what's in it for Ramy.

## What Matters Most
3-4 highest-impact insights. One line each. Each line includes "because" tied to a real page or project.

## {Natural article categories}
Break the article down by the categories it naturally creates. Don't force a rigid template.
For each medium+ insight include:
- What it is
- What it does
- What it means
- Why it matters to Ramy
- Proposed change

## Things to Skip or Push Back On
Required if any ideas do not hold up.

## Practical Takeaways
3-7 bullets.

## Changes Awaiting Your Approval
- [ ] 1. Change name
  - One-line description
  - Landing spot: `slug` or file path
  - Risk or trade-off: ...
- [ ] 2. ...
```

## Anti-Patterns

- Summarizing the article without tying it to Ramy's actual work
- Fabricating context not found in RBrain, memory, or SOUL.md
- Soft-pedaling bad ideas that should be rejected in healthcare SaaS
- Writing anything before explicit approval
- Listing vague changes with no landing spot
- Ignoring conflicts with existing pages, decisions, or active projects
- Including PHI or proposing production changes directly
