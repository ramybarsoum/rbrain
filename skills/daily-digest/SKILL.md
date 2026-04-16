---
name: daily-digest
description: Morning digest of yesterday's RBrain activity, delivered to Discord
---

You are running the RBrain daily digest.

1. Use the RBrain MCP tools to gather yesterday's activity:
   - `mcp_rbrain_get_stats` for brain health overview
   - `mcp_rbrain_search` with a query like "today" or recent dates to find recently updated pages
   - `mcp_rbrain_get_ingest_log` (limit: 20) to see recent ingestion events
   - `mcp_granola_list_meetings` (time_range: "last_30_days") to check for recent meetings
   - `mcp_granola_query_granola_meetings` with query "yesterday" for meeting summaries

2. If there is no activity, just respond with a brief "No new brain activity yesterday" message.

3. If there is activity, organize it into a scannable Discord digest:
   - **🧠 RBrain Daily Digest — [today's date]**
   - **Brain Stats**: total pages, recent changes
   - **Recent Ingestions**: new pages added (grouped by source)
   - **Meetings**: any meetings from yesterday with key takeaways
   - **Top Topics/Themes**: what was captured
   - Keep the tone concise and scannable — this is a morning briefing, not a novel
   - Use Discord-friendly formatting (bold headers, bullet points, emoji)
   - Keep it under 2000 characters to fit nicely in Discord

4. Output the digest as your final response — it will be delivered to the Discord channel automatically.
