# Cole Usefulness Review — RStack Cron Workflow Candidates

Date: 2026-04-26
Owner: Cole
Context: Ramy approved moving from discovery to execution after Max's execution plan. This is Cole's usefulness/taste filter for the first activation wave.

## Verdict summary

Do **not** activate 20 jobs at once. Start with the operating spine, then add scout queues only after the spine proves useful.

Top 5 jobs that would make Ramy faster this week:

1. **Morning briefing** — adopt now
2. **Meeting ingestion + action extraction** — adopt now, dependency-gated by meeting source access
3. **Nightly dream cycle / memory consolidation** — adopt now as silent infra
4. **End-of-day recap** — adopt now with strict brevity
5. **Market / healthcare AI radar** — manual pilot first, then cron if signal is good

## Candidate reviews

### 1. Morning briefing

**Verdict:** useful — activate first.

**Why:** Ramy needs fewer scattered reminders and more sharp operating leverage before the 9am deep-work window.

**Recommended shape:** daily brief item, delivered at 07:55 PT, held during quiet hours if needed.

**Smallest useful version:**

```md
Morning Brief — YYYY-MM-DD

1. Today’s hard commitments
2. Top 3 actions that move AI Concierge reliability forward
3. Decisions waiting on Ramy
4. Compliance / HIPAA / patient-safety signoffs
5. One risk to watch
```

**Noise guard:** no generic calendar dump; every item needs a why-now or next action.

**Owner split:** Cole drafts and delivers; Max verifies memory/decision correctness.

---

### 2. Meeting ingestion + attendee enrichment

**Verdict:** useful — highest compounding value, activate once source access is verified.

**Why:** AllCare’s important decisions happen in meetings. If decisions/action items do not become RBrain state, the system forgets and Ramy pays rework tax.

**Recommended shape:** silent ingest plus targeted outputs:

- decisions → `#decisions` candidate entry
- action items → task queue
- product/engineering risks → relevant project page
- people/company signals → RBrain entities

**Smallest useful version:** process one recent meeting manually, extract:

```md
Meeting: [title/date]
Decisions:
- [decision] — owner, evidence, confidence
Action items:
- [action] — owner, due/urgency if known
Risks:
- [risk] — why it matters
RBrain updates proposed:
- [page/slug] — [change]
```

**Noise guard:** do not write “discussion” as “decision.” Max should hard-gate durable decision writes.

**Owner split:** Cole extracts first pass; Max hardens and files durable memory.

---

### 3. Nightly dream cycle

**Verdict:** useful — activate as silent infrastructure.

**Why:** This is the Garry pattern with the highest long-term compounding: entity sweep, citation cleanup, stale page detection, sync/embed.

**Recommended shape:** silent infra; only notify on meaningful failure, new blocker, or surprising insight.

**Smallest useful version:** nightly `gbrain dream`/maintenance cycle plus report saved under reports, no user ping unless broken.

**Noise guard:** never send “nothing changed.”

**Owner split:** Max owns durable memory integrity; Cole reviews any creative/strategy signals surfaced by the cycle.

---

### 4. End-of-day recap

**Verdict:** useful — activate after morning brief.

**Why:** Ramy’s system needs a clean daily close: what changed, what is stuck, what needs him tomorrow.

**Recommended shape:** daily digest at 17:55 PT.

**Smallest useful version:**

```md
EOD — YYYY-MM-DD

Captured today:
- [signal/decision/task]
Waiting on Ramy:
- [only true blockers]
Tomorrow:
- [1-3 prep items]
Blind-spot guardrail:
- [stakeholder request without named facility staff beneficiary, if any]
```

**Noise guard:** if there is no meaningful change, stay quiet or fold into next morning brief.

**Owner split:** Cole drafts; Max verifies what became durable.

---

### 5. Weekly brain health / maintenance

**Verdict:** useful — activate as silent infra.

**Why:** Broken embeddings, citations, backlinks, or stale pages quietly degrade every answer.

**Recommended shape:** weekly maintenance report; notify only on failures or high-impact cleanup opportunities.

**Smallest useful version:** run `gbrain doctor --json`, `gbrain embed --stale`, citation audit, backlinks, lint.

**Noise guard:** no weekly “all good” post unless Ramy asks.

**Owner split:** Max owns; Cole only needs to know if a failure affects live usefulness.

---

### 6. Auto-update / upstream opportunity check

**Verdict:** useful — keep, but low-interruption.

**Why:** RBrain should inherit useful GBrain improvements without chasing every patch.

**Recommended shape:** daily/weekly check; notify only if a release has features relevant to RStack workflows.

**Smallest useful version:** `gbrain check-update --json` and a relevance filter.

**Noise guard:** no patch-version noise; no auto-install.

**Owner split:** Max verifies safety; Cole summarizes practical value.

---

### 7. Market / healthcare AI radar

**Verdict:** maybe — manual pilot before cron.

**Why:** Potentially valuable for strategy/content, but easy to become noisy.

**Recommended shape:** scout queue, not a daily briefing item by default.

**Smallest useful version:** 2–3 manual runs around:

- senior living AI
- care coordination automation
- HIPAA/AI policy
- healthcare agent reliability
- competitor movement

**Good output example:**

```md
Signal: [specific market/policy/product movement]
Why Ramy should care: [one sentence]
AllCare implication: [product/strategy consequence]
Suggested action: ignore / monitor / discuss / draft / decide
```

**Noise guard:** reject generic AI news. Must connect to AI Concierge reliability, senior living operations, HIPAA, or product positioning.

**Owner split:** Cole scouts and drafts; Max files only durable learnings.

---

### 8. Content opportunity mining

**Verdict:** maybe — scout queue only.

**Why:** Useful if it turns Ramy’s actual work into strong founder/product POV; bad if it becomes generic posting prompts.

**Recommended shape:** weekly queue, not daily cron.

**Smallest useful version:** mine the week for 3 post candidates with evidence from actual work.

**Noise guard:** every content idea needs a source moment and a point of view. No generic “AI in healthcare is changing” sludge.

**Owner split:** Cole drafts; Max checks truth/voice; Ramy approves before external posting.

---

### 9. Email/inbox triage

**Verdict:** useful but dependency-gated.

**Why:** Could save real time if it uses brain context before classification.

**Recommended shape:** start read-only digest; only later draft replies.

**Smallest useful version:** classify important senders and open loops; no sending.

**Noise guard:** unknown sender does not equal irrelevant when healthcare/compliance words appear; use deterministic safety triggers.

**Owner split:** Cole triages/drafts; Max writes durable relationship/project updates.

## Activation recommendation

### Phase 1 — activate/verify spine

1. Morning briefing
2. End-of-day recap
3. Nightly dream cycle
4. Weekly brain health
5. Auto-update relevance check

### Phase 2 — dependency-gated compounding

1. Meeting ingestion
2. Email triage
3. Calendar/contact sync

### Phase 3 — taste-gated scouts

1. Market radar
2. Content opportunity mining
3. Social signal collection

## What I need from Max next

Max should now produce the authoritative inventory/cut table with exact source paths, dependencies, and activation safety. For any job whose value depends on taste/signal quality, send me a packet with:

- source paths
- intended output
- dependency status
- sample output if available
- risk/noise concern

I’ll return a useful/maybe/reject verdict and the smallest acceptable output shape.
