---
name: notebooklm
version: 1.0.0
description: |
  Turn expert podcasts and video content into personalized, cited protocols via Google NotebookLM.
  Load YouTube channels from terminal, run expert-informed Q&A with citations, and build experiments.
  Use when user says "notebooklm", "load channel", "expert interview", "notebooklm ask",
  "health protocol", or wants to turn expert content into actionable knowledge.
triggers:
  - "notebooklm"
  - "load channel"
  - "expert interview"
  - "notebooklm ask"
  - "health protocol"
  - "cite podcast"
  - "notebooklm query"
tools:
  - terminal
  - browser
mutating: true
---

# NotebookLM — Expert Knowledge to Action

> **Router entry:** `skills/RESOLVER.md` → "Content & research" table, row "notebooklm".
> **Upstream source:** [ArtemXTech/personal-os-skills/skills/notebooklm](https://github.com/ArtemXTech/personal-os-skills/tree/main/skills/notebooklm)
> **Related skills:** `skills/idea-ingest/SKILL.md`, `skills/media-ingest/SKILL.md`, `skills/article-learning/SKILL.md`

## Contract

This skill guarantees:
- Prerequisites installed and authenticated before any workflow runs
- Every recommendation links back to the exact source episode and passage
- Bulk channel loading works from terminal (no manual upload)
- Q&A answers come with `[N]` citations resolved to clickable links
- Skill adapts to any expert/domain (Huberman, Lenny, Hormozi, etc.)

## Prerequisites

### 1. nlm CLI (for queries, source listing, management)

```bash
uv tool install notebooklm-mcp-cli
```

### 2. notebooklm-py (for notebook creation and channel loading)

```bash
mkdir -p ~/projects/notebooklm-loader
cd ~/projects/notebooklm-loader
uv venv --python 3.13
source .venv/bin/activate
uv pip install 'notebooklm-py[browser]'
playwright install chromium
```

> **Why Python 3.13?** `notebooklm-py` uses `str | None` type unions (3.10+ syntax). The system Python 3.9 will crash on import.

### 3. Authenticate

```bash
# nlm auth (for queries and source listing)
nlm login

# notebooklm-py auth (for notebook creation and loading)
cd ~/projects/notebooklm-loader && source .venv/bin/activate && notebooklm login
```

Both open a browser window for Google login. `nlm` saves to its own config. `notebooklm-py` saves cookies to `~/.notebooklm/storage_state.json`.

> **Note:** Auth requires interactive browser login. Run these commands yourself on the machine — Max cannot complete this step remotely.

## Workflow Routing

| User says | Workflow |
|-----------|----------|
| "load channel", "youtube channel", "bulk load videos" | [workflows/youtube-channel.md](workflows/youtube-channel.md) |
| "notebooklm ask", "ask notebook", "Q&A" | [workflows/ask.md](workflows/ask.md) |
| "import notebook", "import sources" | [workflows/import.md](workflows/import.md) |
| "notebooklm auth", "notebooklm login" | [workflows/auth.md](workflows/auth.md) |

## The Full Pipeline

### 1. Pick your expert and goal

```
Goal: "I want to improve my health and focus"
Expert: Andrew Huberman (@hubermanlab on YouTube)
```

### 2. Load their content

```bash
# Scrape channel videos
python3 scripts/load_channel.py scrape \
  --channel "https://www.youtube.com/@hubermanlab" \
  --output /tmp/huberman-videos.json

# Create notebook
cd ~/projects/notebooklm-loader && source .venv/bin/activate && notebooklm create "Andrew Huberman - Health"

# Load 200 most recent episodes
python3 scripts/load_channel.py load \
  --videos /tmp/huberman-videos.json \
  --notebook <notebook-id> \
  --count 200 \
  --concurrency 20
```

### 3. Ask expert-informed questions

```bash
nlm notebook query <notebook-id> \
  "What does Huberman recommend for sustaining deep focus for 4+ hours daily?" --json
```

Each answer comes with `[N]` citations back to the exact source and passage.

### 4. Run a cited interview

Claude queries NotebookLM informed by the user's specific goal. Generates questions. User answers. Claude builds a personalized protocol where each recommendation is tied to an exact episode.

### 5. Resolve citations

```bash
python3 scripts/resolve_citations.py \
  --qa /tmp/qa-output.json \
  --sources /tmp/nlm-sources.json \
  --slug {notebook-slug} \
  --title "Focus Protocol" \
  --output /tmp/resolved-qa.md \
  --vault .
```

Replaces `[N]` with clickable links to cited passages in source files.

## Quick Reference

```bash
# List your notebooks
nlm notebook list

# Ask a question with citations
nlm notebook query <notebook-id> "question text" --json

# List sources
nlm source list <notebook-id> --json

# Get source content
nlm source content <source-id> --json
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/load_channel.py` | Scrape YouTube channel + bulk-load into NotebookLM |
| `scripts/resolve_citations.py` | Replace `[N]` with clickable wikilinks to cited passages |
| `scripts/import_sources.py` | Import sources as vault files with metadata |
| `scripts/extract_passages.py` | Extract cited passages from Q&A into source files |
| `scripts/backfill_fulltext.py` | Fetch full transcripts for source files |

## Limits

- **300 sources per notebook.** For channels with 300+ videos, create multiple notebooks.
- **Some videos may fail** if private, deleted, or region-locked.
- **Processing time:** NotebookLM indexes server-side after upload. Sources may show as "processing" initially.
- **Auth expiry:** Google cookies typically last weeks. Re-run `nlm login` when commands start failing.

## Output Format

- Q&A notes with inline `[N]` citations resolved to clickable passage links
- Source files with full transcript content
- Dashboard with Dataview queries for sources and Q&A log

## Anti-Patterns

- Querying a notebook without verifying auth first
- Loading a channel without creating a notebook first
- Trusting citation resolution output without spot-checking 2-3 links
- Using system Python 3.9 with notebooklm-py (will crash on import)
- Skipping transcript backfill — citations will all fail without source content
- Running `load_channel.py` without first scraping the video list

## See also

- `skills/RESOLVER.md` — router entry for this skill
- `skills/idea-ingest/SKILL.md` — for ingesting individual links/articles
- `skills/media-ingest/SKILL.md` — for video/audio/PDF ingestion
- `skills/article-learning/SKILL.md` — for deep article analysis
- [Upstream skill](https://github.com/ArtemXTech/personal-os-skills/tree/main/skills/notebooklm) — original source
- [nlm CLI](https://github.com/jacob-bd/notebooklm-mcp-cli) — query and management tool
