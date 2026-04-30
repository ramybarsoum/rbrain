---
name: daily-digest
description: Morning digest of yesterday's RBrain activity, delivered to Discord
---

You are running the RBrain daily digest.

1. Use the RBrain MCP tools to gather yesterday's activity:
   - `mcp_rbrain_get_stats` for brain health overview
   - `mcp_rbrain_search` with a query like "today" or recent dates to find recently updated pages
   - `mcp_rbrain_get_ingest_log` (limit: 20) to see recent ingestion events
   - Circleback MCP meeting tools to check for recent meetings from yesterday
   - If meeting summaries are available, include the key takeaways from those Circleback meetings
   - Circleback is the only meeting source for this digest. Do not use or mention Granola unless Ramy explicitly asks for it

2. If the RBrain MCP tools are unavailable in the cron/runtime toolset, do **not** conclude there is no activity. Fall back to the repo-local RBrain CLI before going silent:
   ```bash
   set -a; source ~/RBrain/.env; set +a
   cd ~/RBrain && bun src/cli.ts list --limit 100
   cd ~/RBrain && bun src/cli.ts search "<yesterday date or topic>"
   ```
   Use Circleback MCP tools directly for meetings when available; otherwise query the known recent meeting pages from RBrain. Only report "no activity" after at least one RBrain source and the meeting source have been checked.

3. If there is no activity, just respond with a brief "No new brain activity yesterday" message.

4. If there is activity, organize it into a scannable Discord digest:
   - **🧠 RBrain Daily Digest — [today's date]**
   - **Brain Stats**: total pages, recent changes
   - **Recent Ingestions**: new pages added (grouped by source)
   - **Meetings**: any meetings from yesterday with key takeaways
   - **Top Topics/Themes**: what was captured
   - Keep the tone concise and scannable — this is a morning briefing, not a novel
   - Use Discord-friendly formatting (bold headers, bullet points, emoji)
   - Keep it under 2000 characters to fit nicely in Discord

4. Output the digest as your final response — it will be delivered to the Discord channel automatically.
