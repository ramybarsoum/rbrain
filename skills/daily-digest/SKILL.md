---
name: daily-digest
version: 1.0.0
description: Morning digest of yesterday's RBrain activity, delivered to Discord.
triggers:
  - "daily digest"
  - "yesterday's summary"
  - "morning brief"
  - "what happened yesterday"
tools:
  - get_stats
  - search
  - get_ingest_log
  - circleback_search_meetings
  - circleback_read_meetings
  - circleback_search_action_items
mutating: false
---

# Daily Digest Skill

## Contract

This skill guarantees:
- Gathers yesterday's RBrain activity from stats, ingest log, search, and Circleback meetings.
- If no activity, responds with a brief "no activity" message. No padding.
- If activity exists, organizes into a scannable Discord-formatted digest under 2000 characters.
- Output is delivered as the final response. No additional routing needed.

## Phases

1. Use the RBrain MCP tools to gather yesterday's activity:
   - `mcp_rbrain_get_stats` for brain health overview
   - `mcp_rbrain_search` with a query like "today" or recent dates to find recently updated pages
   - `mcp_rbrain_get_ingest_log` (limit: 20) to see recent ingestion events
   - `mcp_circleback_search_meetings` with a date filter for yesterday to list meetings
   - `mcp_circleback_read_meetings` for full notes and summaries on the matched meetings
   - `mcp_circleback_search_action_items` (optional) for action items captured yesterday

2. If there is no activity, just respond with a brief "No new brain activity yesterday" message.

3. If there is activity, organize it into a scannable Discord digest.

## Output Format

```markdown
**RBrain Daily Digest — [today's date]**

**Brain Stats**: total pages, recent changes
**Recent Ingestions**: new pages added (grouped by source)
**Meetings**: any meetings from yesterday with key takeaways
**Action Items**: open follow-ups captured yesterday
**Top Topics/Themes**: what was captured
```

- Keep the tone concise and scannable. Morning briefing, not a novel.
- Use Discord-friendly formatting (bold headers, bullet points, emoji).
- Keep it under 2000 characters to fit nicely in Discord.
- Output the digest as your final response. It will be delivered to the Discord channel automatically.

## Anti-Patterns

- Padding a quiet day with filler. If nothing happened, say nothing happened.
- Dumping raw stats without grouping or context.
- Exceeding 2000 characters. Discord will truncate.
- Skipping the Circleback meeting check. Meetings are the highest-signal source.
