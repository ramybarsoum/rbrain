---
name: team-ops
description: AI-powered team performance analysis and meeting intelligence. Runs ruthless performance audits using the Elon Algorithm, stack-ranks team members A/B/C, and extracts action items + decisions + follow-ups from meeting transcripts. Optionally pushes action items to HubSpot as tasks.
triggers:
  - "Team performance audit"
  - "stack rank"
  - "meeting action items"
  - "extract decisions from meeting"
---

# AI Team Ops

## Preamble (runs on skill start)

```bash
# Version check (silent if up to date)
python3 telemetry/version_check.py 2>/dev/null || true

# Telemetry opt-in (first run only, then remembers your choice)
python3 telemetry/telemetry_init.py 2>/dev/null || true
```

> **Privacy:** This skill logs usage locally to `~/.ai-marketing-skills/analytics/`. Remote telemetry is opt-in only. No code, file paths, or repo content is ever collected. See `telemetry/README.md`.

---

AI-powered team performance analysis and meeting intelligence: ruthless performance audits using the "Elon Algorithm" + automatic extraction of action items, decisions, and follow-ups from meeting transcripts.

## When to Use

Use this skill when:
- Evaluating team performance against OKRs/KPIs with a structured framework
- Stack ranking team members to identify A/B/C players
- Finding redundant roles, bottlenecks, and automation opportunities in your org
- Extracting action items and decisions from meeting transcripts
- Processing batch meeting notes into structured follow-up lists
- Pushing meeting action items to CRM (HubSpot) as tasks

## Tools

### Team Performance

| Script | Purpose | Key Command |
|--------|---------|-------------|
| `team_performance_audit.py` | Elon Algorithm: 5-step team audit + stack rank + scorecards | `python3 team_performance_audit.py --input team_data.json --output report.md` |

### Meeting Intelligence

| Script | Purpose | Key Command |
|--------|---------|-------------|
| `meeting_action_extractor.py` | Extract decisions, actions, follow-ups from transcripts | `python3 meeting_action_extractor.py --transcript meeting.txt --format markdown` |

## Configuration

All scripts use environment variables for LLM API access. Copy `.env.example` to `.env` and fill in your values.

### Required Environment Variables

- `ANTHROPIC_API_KEY` — Anthropic API key (Claude for analysis)
- `OPENAI_API_KEY` — OpenAI API key (alternative LLM provider)

### Optional Environment Variables

- `HUBSPOT_API_KEY` — HubSpot private app token (for pushing meeting action items as tasks)
- `LLM_PROVIDER` — `anthropic` (default) or `openai`
- `LLM_MODEL` — Model name override (default: `claude-sonnet-4-20250514` or `gpt-4o`)

## Data Flow

```
Role Descriptions + OKRs + Output Data (CSV/JSON)
        │
        ▼
┌──────────────────────────────────┐
│   team_performance_audit.py      │
│   5-Step Elon Algorithm:         │
│   1. Question requirements       │
│   2. Delete redundancies         │
│   3. Simplify workflows          │
│   4. Accelerate bottlenecks      │
│   5. Automate what's possible    │
│                                  │
│   + Score: velocity, quality,    │
│     independence, initiative     │
│   + Stack rank: A/B/C players    │
│   + Actions: promote/coach/exit  │
└──────────────────────────────────┘
        │
        ▼
Executive Summary + Individual Scorecards + Org Recommendations


Meeting Transcripts (text files or stdin)
        │
        ▼
┌──────────────────────────────────┐
│   meeting_action_extractor.py    │
│   Extract:                       │
│   • Decisions (who + context)    │
│   • Action items (owner +        │
│     deadline + priority)         │
│   • Open questions               │
│   • Key insights / quotes        │
│   • Follow-up meetings needed    │
│   • Implicit commitments         │
│   + Confidence scores            │
└──────────────────────────────────┘
        │
        ▼
Structured JSON / Markdown + Optional CRM Push
```

## Dependencies

- Python 3.9+
- `anthropic` or `openai` (for LLM-powered analysis)
- `requests` (for optional HubSpot integration)

## Contract

- Performance audits rank every team member A, B, or C against OKRs/KPIs with explicit reasoning per rating.
- Every meeting transcript produces: action items (with owner + due date), decisions, follow-ups, and implicit commitments.
- Output always distinguishes extracted facts from inferred intent; confidence scores accompany inferred items.
- HubSpot push is opt-in per run and confirms each task before creating it.
- No PHI or protected personal data is ever pushed to a third-party CRM.

## Anti-Patterns

- Ranking team members without evidence from real OKR/KPI data — the output becomes gut feel dressed up as a framework.
- Extracting "decisions" from a transcript that only contains discussion — mark as "proposed" if no owner or timeline was stated.
- Pushing action items to CRM without naming the owner — results in orphan tasks.
- Running on transcripts flagged `hipaa_flag: true` or concierge/clinical meetings — escalate instead.
- Using this skill on 1:1 performance conversations without explicit consent from the manager.

## Output Format

Every run returns:

- `team-audit-{date}.md` or `meeting-{slug}-followups.md` — human-readable summary.
- `team-audit-{date}.json` or `meeting-{slug}-followups.json` — structured payload with per-item confidence scores.
- CRM push (optional): count of tasks created + HubSpot IDs returned to caller.

Summary line to user: `Audited N team members (A: a, B: b, C: c)` or `Extracted N action items, M decisions, K follow-ups from meeting {slug}.`
