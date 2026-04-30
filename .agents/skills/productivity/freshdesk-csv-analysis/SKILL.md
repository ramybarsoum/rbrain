---
name: freshdesk-csv-analysis
description: Analyze FreshDesk ticket export CSVs into structured analytical reports with quantified insights for management.
version: 1.0
---

# FreshDesk CSV Ticket Analysis

Analyzes FreshDesk ticket export CSVs to produce structured analytical reports with quantified insights for team leads and management.

## Input

FreshDesk CSV export file (typically from Exports page). Locate via:
```bash
ls ~/Downloads/FreshDesk*.csv
```

## Multi-Pass Analysis Approach

Run 3 passes of `execute_code` to build the full picture incrementally:

### Pass 1: Distributions & Counts
```python
import csv
from collections import Counter
rows = []
with open(PATH, 'r', encoding='utf-8', errors='replace') as f:
    rows = list(csv.DictReader(f))
```

Analyze these dimensions:
- **Status** distribution (Resolved/Closed/Open/Pending/Customer responded)
- **Priority** (Urgent/High/Medium/Low)
- **Source** (Email/Phone/Portal/Chat)
- **Type** — top 15 categories
- **Agent** — ticket count per agent
- **Group** — ticket count per team
- **Product**, **Tags**, custom fields relevant to the org

### Pass 2: SLA & Timing Metrics
- **Resolution Status** (Within SLA vs SLA Violated)
- **First Response Status** (Within SLA vs SLA Violated)
- **Survey results** (often empty — note if so)
- **Agent/Customer interaction counts** (mean/median)

### Pass 3: Computed Metrics from Timestamps

This is the most important pass. Compute resolution/response times from raw timestamps:

```python
from datetime import datetime
import statistics
from collections import defaultdict

# Resolution time from Created -> Resolved/Closed
for r in rows:
    created = r.get('Created time', '').strip()
    end_time = r.get('Resolved time', '').strip() or r.get('Closed time', '').strip()
    if created and end_time:
        ct = datetime.strptime(created[:19], '%Y-%m-%d %H:%M:%S')
        et = datetime.strptime(end_time[:19], '%Y-%m-%d %H:%M:%S')
        hours = (et - ct).total_seconds() / 3600

# First response time from Created -> Initial response time
for r in rows:
    created = r.get('Created time', '').strip()
    frt = r.get('Initial response time', '').strip()
    if created and frt:
        ct = datetime.strptime(created[:19], '%Y-%m-%d %H:%M:%S')
        ft = datetime.strptime(frt[:19], '%Y-%m-%d %H:%M:%S')
        hours = (ft - ct).total_seconds() / 3600
```

Cross-dimensional breakdowns:
- **SLA compliance by Agent** (resolution SLA % + first response SLA %)
- **SLA compliance by Group**
- **SLA violations by Ticket Type** (violation count / total x 100)
- **Resolution time by Agent** (median and mean hours)
- **Resolution time by Group** (median and mean hours)
- **Monthly/daily volume trends**
- **Urgent ticket analysis** (breakdown by type and status)
- **Backlog analysis** (Open + Pending + Customer Responded tickets)
- **Unassigned tickets** count and percentage

## Report Structure

Use Markdown with these H2 sections:

1. **Customer Requests** — volume, channels, top categories with table, service request types, urgency
2. **Customer Pain Points** — SLA violations by group and type, first response gaps, unassigned tickets, backlog
3. **Team Performance Analysis** — group KPIs table, agent performance tiers, resolution speed distribution

End with **Recommendations** — numbered, specific, data-backed.

### Report Conventions
- Use tables for comparative data
- Bold key metrics and percentages
- Use emoji status indicators for tiers
- Include "Report Objectives" preamble
- Keep analytical tone — no editorializing beyond what data supports
- Always note sample size (e.g., "n=2819") when computing from subset
- Save report to same directory as source CSV

## Pitfalls

- FreshDesk exports often have EMPTY numeric time columns (`First response time (in hrs)`, `Resolution time (in hrs)`) even when timestamp columns are populated. Always compute from timestamps instead.
- Use `encoding='utf-8', errors='replace'` when reading — exports often contain mixed encodings.
- "Others/Spam/Marketing" can be 40%+ of tickets — separate signal from noise.
- 71%+ of tickets may have no first response time tracked — note this as a systemic gap.
