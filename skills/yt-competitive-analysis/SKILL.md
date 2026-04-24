---
name: yt-competitive-analysis
description: >-
  Analyze YouTube channels for outlier videos and packaging patterns. Identifies
  what's working (2x+ average views) across any set of channels. Use when asked for
  YouTube competitive analysis, viral video patterns, or packaging/title inspiration.
triggers:
  - "YouTube analysis"
  - "competitive analysis YouTube"
  - "viral video patterns"
  - "outlier videos"
---

# YouTube Competitive Analysis

Outlier detection and packaging pattern extraction for YouTube channels.

## When to Use

- User asks for YouTube competitive analysis
- User wants to find viral video patterns
- User wants packaging/title inspiration from specific creators
- User wants to track competitor YouTube performance

## Prerequisites

- YouTube Data API v3 key set as `$YOUTUBE_API_KEY`

## Usage

```bash
# Analyze specific channels
python3 analyze.py "$YOUTUBE_API_KEY" --channels "@handle1,@handle2" --days 30

# Use predefined sets
python3 analyze.py "$YOUTUBE_API_KEY" --set ai
python3 analyze.py "$YOUTUBE_API_KEY" --set business
python3 analyze.py "$YOUTUBE_API_KEY" --set both

# Export formats
python3 analyze.py "$YOUTUBE_API_KEY" --set both --output json
python3 analyze.py "$YOUTUBE_API_KEY" --set both --output console
```

## Predefined Channel Sets

**AI Creators:** Jeff Su, Alex Finn, Riley Brown, Dan Martell, Matt Wolfe, Nate Herk, Grace Leung, Matt Berman

**Business Creators:** Alex Hormozi, Gary Vaynerchuk, Patrick Bet-David, Codie Sanchez, Leila Hormozi, Iman Gadzhi, My First Million

## Output Interpretation

- **Multiplier**: Times above channel average (2.0x = double normal)
- **Outlier threshold**: 2x average. Study anything above this.
- **Title patterns**: Common words in outlier titles indicate proven formats
- **Cadence**: Videos per week. Higher cadence creators may have lower per-video averages.

## Packaging Skeletons (Proven Formats)

**Long-form:**
- "X, Clearly Explained"
- "X hours of Y in Z minutes"
- "The Laziest Way to X"
- "Give me X minutes and I'll Y"
- "X INSANE Use Cases for Y"

**Shorts:**
- "2024 vs 2025 X" (year comparison)
- "Bad Good Great X" (tier ranking)
- "Stop doing X, do Y instead" (contrarian)

## Contract

- Identifies outliers against each channel's own recent average (2x+ threshold by default, configurable).
- Outputs packaging patterns (title structure, thumbnail motif, topic angle) grounded in actual video IDs, not generic advice.
- Requires a YouTube Data API v3 key in `$YOUTUBE_API_KEY`. Fails loudly if missing.
- Distinguishes long-form from Shorts in the pattern table; the viral mechanics differ.
- Never scores a channel with fewer than 10 recent videos — the average is unstable below that.

## Anti-Patterns

- Reporting raw view counts without normalizing against the channel's average (a channel with 10M subs has a different floor than a channel with 50K).
- Treating one outlier as a pattern — need 3+ examples across channels to call something a pattern.
- Copying a successful title wholesale instead of extracting the underlying structure (emotion, specificity, comparison, tier, contrarian framing).
- Running on channels the user doesn't actually have a strategic reason to track.

## Output Format

- `yt-analysis-{date}.md` — human-readable report: top outliers per channel, cross-channel pattern table, suggested title/packaging variations for the user's own content.
- `yt-analysis-{date}.json` — structured rows: `{channel, video_id, title, views, avg_views, ratio, pattern_tags}`.

Summary line to user: `Analyzed {N} channels × {days}d. Found {M} outliers (2x+). Top packaging patterns: {tag1}, {tag2}, {tag3}.`
