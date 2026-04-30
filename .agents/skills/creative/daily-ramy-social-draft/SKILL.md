---
name: daily-ramy-social-draft
description: Create Ramy Barsoum daily social-content drafts from recent Circleback meetings plus session recall, then format a concise Discord-ready report with top candidates, chosen angle, X post, longer post, and alt hooks.
version: 1.0.0
author: Hermes
license: MIT
metadata:
  hermes:
    tags: [ramy, content, social, circleback, discord, x, linkedin]
---

# Daily Ramy Social Draft

Use this when asked to produce a daily draft tweet/post for Ramy Barsoum based on his real work.

Always load `ramy-voice` first before drafting the copy.

## Goal

Find one high-signal topic from Ramy's actual recent work, not generic AI news, then draft short-form social copy in Ramy's voice.

## Source priority

1. **Circleback first** for real operator signal.
2. **session_search** second to match current focus and prior content direction.
3. **web_search** only for an optional hook. Do not force news.

## Working method

### 1) Start with Circleback, but use a fallback path immediately if query is weak

Preferred first move:
- Use Circleback meeting search/read tools to pull operator pain points, product priorities, contrarian takes, and concrete healthcare AI lessons from the last 14 days.

If the primary Circleback pass returns weak or empty output:
- Switch to `SearchMeetings` with a narrow date window, then shortlist likely-relevant meetings by title.
- Pull a shortlist of likely-relevant meetings by title.
- Use `ReadMeetings` on the best 5 to 8 meetings.
- If you need sharper language or quotable mechanics, use `GetTranscriptsForMeetings` on the top 1 to 2 meetings.

### 2) What to prioritize in Circleback

Look for:
- recurring operator pain points
- specific deployment failures
- product truths discovered in production
- concrete workflow changes
- healthcare-domain specifics: concierge, pharmacy, routing, care coordination, med rec, senior care ops, scoped memory, assignments, multi-tenancy, auditability

Strong content topics usually have:
- one clear pain point
- one concrete example
- one product or operational fix
- one contrarian line

### 3) Use session_search to match current direction

Search recent sessions for:
- `AllCare OR healthcare AI OR senior care OR product OR GTM OR operators OR content OR X OR Twitter OR marketing`
- then run narrower follow-ups using quoted phrases from the best Circleback findings

Important lesson:
- `session_search` often returns raw previews, not clean summaries. Treat it as a direction signal, not a primary source.
- Narrow quoted searches work better than broad conceptual searches when you already have a candidate theme.

### 4) Use web_search only as an optional hook

If there is an obvious current hook, use it.
If `web_search` errors or gives low-signal results, skip it and continue. Do not downgrade the draft by forcing public news into it.

## Topic scoring rubric

Score candidate topics on 1 to 5 for:
- relevance to Ramy's current work
- specificity and concrete detail
- contrarian or insightful angle
- fit for a short social post

Prefer topics that are:
- close to live product decisions
- easy to explain in one sentence
- backed by operational evidence
- inside Ramy's lane

## What usually wins

The best daily posts are often about:
- workflow design mistakes, not model quality
- operator pain, not AI hype
- one accountable owner, not more touchpoints
- quality and control loops, not speed theater
- deployment truth from senior care environments

## Reliability lessons from actual use

- Circleback query flows can be weak on broad pulls. Fall back fast to `SearchMeetings` + `ReadMeetings`.
- If broad Circleback synthesis is weak, shortlist meetings first and then read full notes/transcripts directly. Do not rely on one broad query path.
- Granola natural-language query calls may time out on broad synthesis requests. If that happens, skip synthesis and use `list_meetings` + `get_meetings` + 1 to 2 transcripts as the primary evidence path.
- The best evidence often comes from full meeting reads plus 1 transcript for stronger language.
- `web_search` may fail outright. Keep it optional.

## Drafting rules

Follow `ramy-voice` strictly:
- answer first
- no em dashes
- blunt, technical, operator tone
- no generic AI commentary
- no corporate filler
- use concrete nouns and trade-offs

Keep Ramy in lane:
- healthcare AI
- senior care
- pharmacy
- concierge
- routing
- care coordination
- product and deployment reality

## Default output format for Discord

```markdown
**Daily Draft — YYYY-MM-DD**
**Top candidates**
- Topic 1: one-line why-now (include source citations when available)
- Topic 2: one-line why-now (include source citations when available)
- Topic 3: one-line why-now (include source citations when available)

**Chosen angle**
One short paragraph on why this is the best topic today. Preserve Circleback citations here when available.

**Draft X post**
1-3 sentences. Strong enough to post as-is. Keep under 280 characters.

**Draft longer post**
80-150 words. Use short paragraphs or bullets if helpful.

**Alt hooks**
- Hook A
- Hook B
```

## Selection heuristics from experience

A post is usually strong enough when:
- the main claim is understandable in under 10 seconds
- the post contains one real operational mechanism, not just a take
- the topic could only have been written by someone actually shipping in this domain
- the last line sounds screenshot-worthy

## Example pattern

Best structure for the longer post:
1. state the real problem
2. explain why most teams get it wrong
3. give 3 to 4 concrete mechanics
4. end with a line that reframes the category

Example category shift:
- "concierge, not call center"
- "workflow discipline, not model magic"
- "quality loop, not revenue theater"
