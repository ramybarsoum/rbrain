---
name: top-down-weekly-video-update
description: Create a 2-part weekly video/update script for Ramy using top-down communication. Pull evidence from Circleback/RBrain, avoid double-counting workstreams, and tune script length to target speaking time.
version: 1.0.0
author: Hermes
license: MIT
metadata:
  hermes:
    tags: [writing, video, weekly-update, top-down, circleback, rbrain, ramy]
---

# Top-Down Weekly Video Update

Use when Ramy wants a weekly spoken update, leadership video script, or top-down communication summary covering:
- what was achieved last week
- what is planned this week
- roadmap-based progress updates
- a 2-part structure with action titles first and supporting evidence second

Load `ramy-voice` before writing. `scqa-writing-framework` is optional for structure, but the final output should be top-down, not academic.

## What good looks like

Produce a script with exactly two sections:
1. Last week achievements
2. This week roadmap / next steps

Each section starts with an **Action Title** that includes:
- a fact
- a number
- an achievement

Then support the title with mutually exclusive evidence. Do not let two bullets describe the same workstream with different wording.

## Evidence-gathering workflow

1. Read the user's stated framing first. If Ramy corrects the narrative, trust that over inferred summaries.
2. Pull supporting evidence from Circleback for `last_week` and `this_week`.
3. Prefer:
   - Circleback meeting search tools to identify recent meetings
   - Circleback transcript or note synthesis for open-ended takeaways
   - Circleback full meeting reads for the specific meetings that seem most relevant
4. If using local RBrain CLI / `gbrain query`, verify it works before relying on it. If auth/db access fails, fall back to Circleback-based evidence and say so internally while drafting.

## Narrative rules

- Lead with the conclusion, not the chronology.
- Merge overlapping achievements into one workstream. Example: deployment + infrastructure + channel integration for the same Concierge launch should usually be one proof point, not two.
- If the user says an item belongs in "this week" instead of "last week", move it immediately. Do not defend the earlier framing.
- Roadmap items are strongest in section 2. If the user provides an explicit task list, use that list directly rather than inferred tasks.
- Prefer strong summaries like:
  - "live, connected, and measurable"
  - "launch to scale"
  - "from launch-ready to operational"

## Ramy-specific style constraints

- Blunt, operator tone.
- Answer first.
- No em dashes.
- Use numbers where possible.
- Avoid generic hype. Ground every claim in actual work or actual roadmap items.
- Sound like a CPO/CEO briefing leadership, not a content creator recapping a week.

## Spoken-script constraints

- Write for speech, not prose.
- Short sentences.
- Clear transitions: "First", "Second", "Third".
- Avoid nested clauses that make avatar/TTS delivery sound robotic.
- For 2:00 to 2:30 target, check word count. Aim ~280 to 330 words for normal delivery, or slightly higher if the cadence will be deliberate.
- Use `execute_code` or another tool to calculate rough speaking time from word count. Do not estimate mentally.

## Recommended output format

1. A polished script
2. Optional shorter alt closing lines
3. If useful, a note on estimated duration backed by tool output

## Example section pattern

### Action Title 1: Last week we launched Concierge and opened 3 measurable workstreams.

One paragraph stating the main outcome.

Then 3 support points:
- launched Concierge
- integrated Concierge with other pillars through contracts
- began KPI tracking against a baseline such as 84% first-response breach

### Action Title 2: This week I’m closing 5 roadmap tasks to scale Concierge.

Use the user's explicit roadmap items directly, e.g.:
- AI Concierge phone integration
- client-side UI across admin/caregiver/patient/POA/adult child
- primary & secondary human concierge assignment
- bidirectional landing stage page (pillar → client)
- KPI layer

## Verification checklist

Before finishing, confirm:
- each action title includes a fact, a number, and an achievement
- section 1 and section 2 do not duplicate the same workstream
- user-provided roadmap items appear verbatim or near-verbatim in section 2
- script length matches requested speaking duration using a tool-based word-count estimate
- tone matches Ramy's operator voice
