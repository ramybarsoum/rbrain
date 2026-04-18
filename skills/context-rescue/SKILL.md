---
name: context-rescue
version: 1.0.0
description: Extracts minimum viable context from a long conversation so you can start a clean new chat without losing work. Use after 20+ turns or when the session feels sluggish.
triggers:
  - "context rescue"
  - "rescue this conversation"
  - "save this session"
  - "start a new chat without losing context"
  - "session is getting slow"
  - "the conversation is too long"
tools:
  - Write
mutating: false
---

# Context Rescue Skill

## Contract

This skill guarantees:
- The rescue package is short. Ideally under 2,000 tokens, absolutely under 5,000 even for complex work.
- Every included fact is substance, not conversational overhead. Pleasantries, meta-discussion, and tangents are cut.
- Deliverables (code, copy, frameworks) are preserved verbatim. Context (decisions, constraints) is tightly summarized.
- Ambiguous items go to Open Questions, not Decisions Locked. Better to re-confirm than carry a wrong assumption forward.
- The package is saved to disk at a deterministic path, so the user can reference or share it later.
- The user receives a token-savings estimate and an exact instruction for how to kick off the new conversation.

## Phases

### Phase 1: Gather material

Ask the user to do ONE of the following:
- **(a)** Paste in the conversation (or the relevant portions) they want to rescue.
- **(b)** Describe from memory: what they've been working on, what decisions have been made, what outputs they've generated so far, and what they still need to do.

Tell them (a) gives a better result, but (b) works fine if the conversation is too long to paste.

Wait for their response before proceeding.

### Phase 2: Extract the rescue package

Produce a Context Rescue Package with five sections in this exact order:

- **TASK STATE** — 1 to 3 sentences describing what the work is and where it currently stands.
- **DECISIONS LOCKED** — a bulleted list of every decision, conclusion, or constraint established during the conversation. Be specific. "Target audience: mid-career product managers, not entry-level" beats "audience was discussed."
- **KEY OUTPUTS** — any actual deliverables produced (copy, code, frameworks, plans, analyses). Include verbatim if short. If long, produce a tight summary that preserves the essential structure so the user can reference it without regenerating.
- **OPEN QUESTIONS** — anything unresolved, flagged for later, or still being iterated on.
- **NEXT STEP** — what the user should ask in the new conversation to pick up immediately.

### Phase 3: Save to disk

Save the rescue package to this exact path (use the current date and time):

```
~/.claude/workflows/context-rescue/packages/rescue-YYYY-MM-DD-HHMMSS.md
```

Use the Write tool. Create any missing parent directories as needed.

### Phase 4: Report back

Tell the user:
- The exact file path where the package was saved.
- An estimated token count of the rescue package compared to what their full conversation likely costs per turn.
- Instructions for kickoff: open a new conversation, paste the rescue package as the first message with a short framing like "Here's the context from my previous session. I'd like to continue from where I left off," and then proceed with the next question.

## Output Format

A Context Rescue Package formatted in clean markdown with five clearly labeled sections (Task State, Decisions Locked, Key Outputs, Open Questions, Next Step). Leanest possible. Include a token-savings estimate at the end.

```markdown
# Context Rescue — YYYY-MM-DD

## TASK STATE
[1-3 sentences]

## DECISIONS LOCKED
- [specific decision]
- [specific decision]

## KEY OUTPUTS
[verbatim short outputs, or tight summaries of long ones]

## OPEN QUESTIONS
- [unresolved item]

## NEXT STEP
[exact question or instruction to open the new chat with]

---
Estimated savings: ~N tokens per turn × remaining work vs re-loading full conversation.
```

## Anti-Patterns

- **Padding with "nice to have" context.** Every token costs money on every future turn. If it is not essential for continuing the work, cut it.
- **Promoting debate to decision.** If you are uncertain whether something was settled, put it in Open Questions. Do not freeze a wrong assumption into Decisions Locked.
- **Paraphrasing deliverables.** Preserve exact wording for code, copy, and specific formulations the user will reference.
- **Skipping short conversations.** If under 10 turns, tell the user they may not need a rescue yet, but offer the package anyway if they want a clean start.
- **Including conversational overhead.** No pleasantries, no meta-discussion, no tangents. Substance only.
