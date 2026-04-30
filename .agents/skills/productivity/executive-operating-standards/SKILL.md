---
name: executive-operating-standards
description: Turn an executive operating standards or behavioral feedback document into an actionable checklist, an RBrain concept page, a recurring reminder, and calendar changes.
version: 1.0.0
author: Hermes
license: MIT
metadata:
  hermes:
    tags: [executive, operations, rbrain, cronjob, calendar, writing]
---

# Executive Operating Standards

Use this when Ramy shares a CEO/CPO operating standards document, behavioral feedback memo, or any written set of working rules and asks to operationalize it.

## What good looks like

Produce four outputs when requested:
1. A blunt summary of the document's real message
2. A short actionable checklist
3. An RBrain concept page with citations
4. A recurring reminder plus calendar recommendations tied to Ramy's actual work patterns

## Core workflow

1. Read the source document fully.
2. Extract the operating rules, not just the tone.
3. Translate each directive into a checklist item that can be used before meetings, forecasts, staffing calls, and builder detours.
4. When writing to RBrain:
   - File it as a `concepts/` page if the primary subject is a reusable operating framework
   - Add inline citations on every factual claim
   - Link it to `soul-ramy-barsoum` when the checklist is meant to govern Ramy's working style
   - Log the ingest after creating or updating the page
5. When scheduling the reminder:
   - Make it blunt and short
   - Include a prompt to review the relevant RBrain page slug
   - Ask where Ramy violated or followed the standards that week
   - Tie it to his protected 9am-12pm deep work window and any active stalled writing work
6. When proposing calendar changes:
   - Start from Ramy's fixed deep work window of 9am-12pm
   - Put writing-heavy work first if a roadmap, spec, or strategy doc is already overdue
   - Protect leverage over throughput. Ramy's best hours should go to specs, architecture, prioritization, and written decisions, not reactive coding

## Cronjob pitfall

The `cronjob` tool may reject natural-language schedules like `every Friday at 4pm`.
If that happens, switch to a cron expression immediately.

Example for Friday 4 PM PT:
- `0 23 * * 5`

Verify the returned `next_run_at` to make sure the tool interpreted the schedule correctly.

## Output guidance

- Be direct. Lead with what is broken.
- Keep the checklist compact enough to be usable.
- Calendar recommendations should change behavior, not just restate the document.
- If a writing deliverable is already slipping, reserve the first deep-work blocks of the week for it until done.

## Boundaries

- Do not write unsupported claims into RBrain. Cite the uploaded document or existing SOUL/RBrain context.
- Do not create a person or company page for the memo itself. This belongs in `concepts/` unless the user explicitly wants it filed elsewhere.
- Do not rely on vague reminder language. The reminder should force a weekly review of behavior, forecasts, deep work protection, and any stalled strategy doc.

## Verification

Before finishing, confirm:
- the RBrain page exists
- the reminder job exists and has the expected next run
- the calendar proposal reflects Ramy's real deep-work hours and current top writing bottleneck
