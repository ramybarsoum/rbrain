---
type: mcp
title: Circleback
name: circleback
description: >-
  OAuth-protected meeting intelligence MCP with transcripts, attendee and domain
  lookup, and meeting-search quirks that matter for RBrain ingestion.
tags:
  - circleback
  - mcp
  - meetings
  - oauth
---

# Circleback MCP

Circleback exposes an OAuth-protected MCP endpoint at `https://app.circleback.ai/api/mcp` and advertises protected-resource, authorization, and token metadata through standard OAuth discovery. [Source: Hermes session `20260421_165439_90f8ba3c.jsonl`, 2026-04-21]

The discovered Circleback MCP surface is broader than the current Granola integration for meeting ingestion: meetings, transcripts, full meeting reads, attendee profiles, domains, emails, action items, calendar events, and tags were all available when the connector was loaded. [Source: Hermes session `20260421_165439_90f8ba3c.jsonl`, 2026-04-21]

## Non-obvious integration notes

- If OAuth tokens already exist in `~/.hermes/mcp-tokens/`, Hermes can hot-load Circleback mid-session with `discover_mcp_tools()`; a full restart is not required. [Source: Hermes session `20260421_165439_90f8ba3c.jsonl`, 2026-04-21]
- `SearchMeetings` requires `intent` and `pageIndex`; `searchTerm` is optional. Pagination is fixed at 20 meetings per page and the `pageIndex` only remains valid when the search parameters stay identical across pages. [Source: Hermes session `20260421_165439_90f8ba3c.jsonl`, 2026-04-21]
- The durable ingestion architecture is Circleback webhook -> thin receiver -> persist raw payload -> async processor -> dedupe/filter -> RBrain writes, rather than direct inline writes from Circleback into the brain. [Source: Hermes session `20260421_171159_3024a43e.jsonl`, 2026-04-21]
- Before giving Circleback a webhook URL, verify that webhook config exists, subscriptions are wired, and the local listener is actually running; during the first setup attempt an ngrok URL existed but the webhook server behind it was not live. [Source: Hermes session `20260421_171159_3024a43e.jsonl`, 2026-04-21]
- As of 2026-04-22, Circleback is the live default for meeting workflows and daily briefings. Ramy explicitly retired Granola from active use and directed Hermes to replace Granola meeting workflows with Circleback-first paths. [Source: User, Discord, 2026-04-22; Hermes session `session_20260422_234130_edfc3eb7.json`]
