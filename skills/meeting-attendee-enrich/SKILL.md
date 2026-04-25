---
name: meeting-attendee-enrich
version: 1.0.0
description: |
  Follow-up to meeting-ingestion. Given a freshly ingested meeting page,
  enrich every attendee without an existing people page. Applies notability
  gate per attendee, creates Tier 1/2 pages via the enrich skill, skips
  non-notable with an explicit log. Guarantees no attendee is left as an
  unresolved name string.
triggers:
  - "enrich attendees"
  - "meeting follow-up enrichment"
  - "build people pages from meeting"
  - "meeting-ingestion completed"
tools:
  - get_page
  - put_page
  - search
  - query
  - list_pages
  - add_link
  - add_timeline_entry
  - get_backlinks
mutating: true
---

# Meeting Attendee Enrich Skill

> **Filing rule:** see [skills/_brain-filing-rules.md](../_brain-filing-rules.md) — read before creating any new page.
> **Convention:** see [skills/conventions/quality.md](../conventions/quality.md) — Iron Law no-silent-skip applies to every attendee.
> **Delegates to:** `skills/enrich/SKILL.md` for actual page writes. This skill
> is the decision layer (who to enrich, at what tier); enrich does the work.

## Contract

This skill guarantees:
- Every attendee on the meeting page resolves to one of: existing people page updated, new people page created, or explicit skip logged
- No attendee remains as a bare name string with no brain record of the judgment
- Notability gate applied per attendee before any write
- Tier assigned per attendee (1/2/3) and passed to enrich
- Meeting page back-links validated after enrichment pass
- Structured report returned with counts per outcome

## Iron Law: No Silent Skips

> **Convention:** see [skills/conventions/quality.md](../conventions/quality.md) — the no-silent-skip rule applies to every per-row pipeline in this skill.

Per the convention, every attendee must produce either a brain write
(create/update) OR a logged skip decision with reason. See Output Format below
for the structured shape.

## When to Run

Triggers from upstream:
- `meeting-ingestion` skill completes Phase 2 (meeting page written) and hands off
- Manual: "enrich attendees on meeting/{slug}"
- Batch sweep: "enrich any unenriched attendees from last 7 days of meetings"

Do NOT run this skill:
- Before the meeting page exists (you need the attendee list + context)
- On meetings older than 90 days without explicit instruction (low signal decay)
- On meetings where the source is marked `hipaa_flag: true` — escalate to Ramy

## Phases

### Phase 1: Load the meeting

1. `get_page(meeting_slug)` — read the full meeting page
2. Extract `attendees` from frontmatter (array of `{name, email}`)
3. Extract `date`, `title`, `summary` — needed for tier decision and timeline entries
4. Extract companies and topics from the body — used for context in Phase 3

If the meeting page has no attendees array (legacy format), parse the body's
`## Attendees` section. If neither exists, abort with error: "Meeting has no
attendees — cannot enrich. Re-run meeting-ingestion first."

### Phase 2: Attendee filtering (pre-notability)

Remove from the enrichment candidate set:
- Calendar resources (pattern: contains "conference room", "huddle", " - [Location]")
- Group addresses (email contains `team@`, `all@`, `noreply@`, `no-reply@`, `notifications@`)
- The user themselves (Ramy Barsoum / barsoum.ramy@gmail.com) — they don't get a people page
- Bots (name contains "bot", "circleback", "otter", "fireflies")

Log filtered entries to the skip log with reason `filtered_pre_gate`.

### Phase 3: Notability gate (per candidate)

> **Filing rule:** see [skills/_brain-filing-rules.md](../_brain-filing-rules.md) — the notability gate, tier criteria, and skip rules below are project-specific operationalizations of the convention defined there. The convention is the source of truth; this section is a per-skill cheat sheet for fast operation.

For each remaining attendee, apply the notability gate. This is the critical
decision — DO NOT create pages for people who don't meet the gate.

| Tier | Criteria | Examples |
|------|----------|----------|
| **1 (key)** | Co-founder, investor, board member, direct report, close collaborator, anyone with 3+ prior brain mentions | Partners, lead investors, key hires |
| **2 (notable)** | Senior role at a company in user's universe, industry figure, expert in a domain the user works in, first-time contact with substantive context | Facility admins, pillar leads, portfolio founders |
| **3 (minor)** | Worth tracking but not critical. ONLY create a page if future reference is likely | Vendor reps, occasional introducers |
| **skip** | No substantive role, one-off coordinator, admin-only | Scheduler, generic account rep, random CC'd party |

Judgment inputs:
- Email domain (matches a company already in brain → likely notable)
- Existing backlinks (`get_backlinks(person-slug)` if a guess exists → 3+ = Tier 1)
- Role inference from the meeting title and summary (e.g. "1:1 with" strongly implies Tier 1)
- Company context from the meeting body
- For AllCare concierge meetings: facility admins = Tier 2, facility line staff = Tier 3, vendors = skip

### Phase 4: Check existing brain state

For each candidate after Phase 3:

```
search("{name}")
query("{name} {company from email domain}")
```

Outcomes:
- **Hit (high confidence):** existing page. Go to UPDATE path.
- **Hit (ambiguous):** multiple candidates or name collision. Flag `needs_disambiguation`, skip enrichment, report to user.
- **Miss:** no page. Go to CREATE path with assigned tier.

### Phase 5: Delegate to enrich

For each candidate that needs work, hand off to `skills/enrich/SKILL.md`:

**UPDATE path:**
- Call enrich with `{name, existing_slug, tier, context: meeting_summary, new_timeline_entry}`
- Enrich appends a timeline entry, updates compiled truth only if material new signal

**CREATE path:**
- Call enrich with `{name, email, tier, context: meeting_summary, source_meeting_slug}`
- Enrich runs its full 7-step protocol at the specified tier
- Tier 1 → full pipeline (web + LinkedIn + company cross-ref)
- Tier 2 → moderate (web + brain cross-ref)
- Tier 3 → light (brain cross-ref + light web lookup only)

**Rate limiting:**
- Max 5 Tier 1 enrichments per meeting in one pass (Opus cost ceiling)
- Max 10 Tier 2 enrichments per meeting in one pass
- If over limit, queue the overflow as `pending_enrich` and report to user
- Tier 3: no limit (cheap), but only create pages if likely future reference

### Phase 6: Validate back-links

After all enrichments complete:

1. For each attendee who got a brain page (new or updated), verify the
   `attended` link exists from meeting → person via `get_backlinks`
2. The auto-link post-hook should have handled this on meeting put_page.
   If any are missing, call `add_link(meeting_slug, person_slug, type=attended)`
3. Add timeline entry on each person's page:
   `add_timeline_entry(person_slug, date, "Attended {meeting_title}", source="circleback:{cb_id}")`

### Phase 7: Report

Emit structured output (see Output Format below). Save a report entry:

```
reports/enrichment/YYYY-MM-DD-meeting-{meeting-slug}.md
```

Contents: attendee count, tier distribution, created vs updated counts,
skipped count with reasons, ambiguous flags, rate-limit overflow.

## Notability Gate: Decision Examples

These are the judgment calls this skill is for. When in doubt, bias TOWARD
skip and log the reason — an unenriched attendee is recoverable, an over-enriched
brain is noisy.

| Attendee | Context | Decision |
|---|---|---|
| Head of Ops at a 150-facility ALF chain | First meeting, introduced by partner | Tier 2 create |
| CEO of an AllCare portfolio facility | Recurring monthly sync | Tier 1 create |
| EA named in calendar but didn't speak | Admin coordinator role | skip (filtered_not_notable) |
| Line nurse at a facility | Discussed a specific patient workflow | Tier 3 create (role-specific) |
| Someone with 4 prior brain mentions already | Appeared again in a new meeting | Tier 1 update |
| Name collision (two "John Smith" pages exist) | Unclear which one attended | needs_disambiguation, skip |
| Vendor sales rep | One-off demo call | skip (filtered_not_notable) |

## Output Format

Return a structured report object AND a human-readable summary.

```json
{
  "meeting_slug": "meeting/2026-04-22-example-...",
  "attendee_count": 7,
  "filtered_pre_gate": [
    {"name": "YC-SF Conference Room", "reason": "calendar_resource"}
  ],
  "enriched": {
    "tier_1_created": [{"slug": "people/alice-example", "name": "Alice Example"}],
    "tier_1_updated": [],
    "tier_2_created": [{"slug": "people/bob-example", "name": "Bob Example"}],
    "tier_2_updated": [],
    "tier_3_created": []
  },
  "skipped": [
    {"name": "Generic Coordinator", "reason": "filtered_not_notable", "tier_assigned": "skip"}
  ],
  "flagged": [
    {"name": "John Smith", "reason": "needs_disambiguation", "candidates": ["people/john-smith-acme", "people/john-smith-widgetco"]}
  ],
  "overflow_pending": []
}
```

Human summary: "Enriched N/M attendees. Created K new people pages (T1: a, T2: b, T3: c). Updated P existing. Flagged Q for disambiguation. Skipped R non-notable."

## Anti-Patterns

- Creating Tier 1 pages for every attendee (cost blowup, noise in search)
- Creating stub pages for non-notable attendees just to "cover" them
- Skipping the notability gate because the meeting feels important ("everyone here must be notable" → no, the coordinator isn't)
- Running enrichment before the meeting page is written (no attendee context)
- Writing new pages without back-linking the source meeting
- Silently dropping ambiguous names instead of flagging for human review
- Running on HIPAA-flagged meetings (AllCare concierge → always escalate first)

## HIPAA Handling (AllCare-specific)

If the meeting's frontmatter contains `hipaa_flag: true` OR the meeting title
matches patterns like "Concierge", "Patient Review", "Clinical Huddle":

1. Do NOT auto-enrich any attendees
2. Do NOT add timeline entries that reference patient details
3. Emit a report with all attendees and proposed tiers, but ZERO writes
4. Escalate to Ramy: "Meeting {slug} needs manual review before attendee
   enrichment. Attendees: {list with proposed tiers}. Approve to proceed."

This is a hard gate. No exceptions.

## Tools Used

- Read meeting + person pages (get_page)
- Search existing people by name (search, query)
- List people by type (list_pages)
- Create/update person pages via enrich delegation (put_page)
- Link attendees to meeting (add_link)
- Add timeline entries on people pages (add_timeline_entry)
- Verify back-links exist (get_backlinks)
