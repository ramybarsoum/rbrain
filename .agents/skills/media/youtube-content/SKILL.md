---
name: youtube-content
description: >
  Fetch YouTube video transcripts and transform them into structured content
  (chapters, summaries, threads, blog posts). Use when the user shares a YouTube
  URL or video link, asks to summarize a video, requests a transcript, or wants
  to extract and reformat content from any YouTube video.
---

# YouTube Content Tool

Extract transcripts from YouTube videos and convert them into useful formats.

## Setup

```bash
pip install youtube-transcript-api
```

## Helper Script

`SKILL_DIR` is the directory containing this SKILL.md file. The script accepts any standard YouTube URL format, short links (youtu.be), shorts, embeds, live links, or a raw 11-character video ID.

```bash
# JSON output with metadata
python3 SKILL_DIR/scripts/fetch_transcript.py "https://youtube.com/watch?v=VIDEO_ID"

# Plain text (good for piping into further processing)
python3 SKILL_DIR/scripts/fetch_transcript.py "URL" --text-only

# With timestamps
python3 SKILL_DIR/scripts/fetch_transcript.py "URL" --timestamps

# Specific language with fallback chain
python3 SKILL_DIR/scripts/fetch_transcript.py "URL" --language tr,en
```

## Output Formats

After fetching the transcript, format it based on what the user asks for:

- **Chapters**: Group by topic shifts, output timestamped chapter list
- **Summary**: Concise 5-10 sentence overview of the entire video
- **Chapter summaries**: Chapters with a short paragraph summary for each
- **Thread**: Twitter/X thread format — numbered posts, each under 280 chars
- **Blog post**: Full article with title, sections, and key takeaways
- **Quotes**: Notable quotes with timestamps

### Example — Chapters Output

```
00:00 Introduction — host opens with the problem statement
03:45 Background — prior work and why existing solutions fall short
12:20 Core method — walkthrough of the proposed approach
24:10 Results — benchmark comparisons and key takeaways
31:55 Q&A — audience questions on scalability and next steps
```

## Workflow

1. **Fetch** the transcript using the helper script with `--text-only --timestamps`.
2. **Validate**: confirm the output is non-empty and in the expected language. If empty, retry without `--language` to get any available transcript. If still empty, tell the user the video likely has transcripts disabled.
3. **Chunk if needed**: if the transcript exceeds ~50K characters, split into overlapping chunks (~40K with 2K overlap) and summarize each chunk before merging.
4. **Transform** into the requested output format. If the user did not specify a format, default to a summary.
5. **Verify**: re-read the transformed output to check for coherence, correct timestamps, and completeness before presenting.

## Error Handling

- **Transcript disabled**: tell the user; suggest they check if subtitles are available on the video page.
- **Private/unavailable video**: relay the error and ask the user to verify the URL.
- **No matching language**: retry without `--language` to fetch any available transcript, then note the actual language to the user.
- **Dependency missing**: run `pip install youtube-transcript-api` and retry.
- **YouTube download blocked / yt-dlp 403 / SABR issues**: do not stop. Fall back to transcript + page metadata. Use the browser tool to open the YouTube URL and extract:
  - `document.title`
  - `meta[property="og:title"]`
  - `meta[name="description"]`
  - `meta[name="keywords"]`
  - `window.ytInitialPlayerResponse.videoDetails` (author, title, shortDescription, keywords, lengthSeconds)
  This is often enough to infer genre, mood, structure, and production style when the user wants an analysis rather than a pristine audio rip.
- **Music/style reverse-engineering requests**: prefer an audio-first workflow when possible:
  1. Install/use `yt-dlp` + `ffmpeg` and try `yt-dlp -x --audio-format mp3 URL`.
  2. If yt-dlp prints JS challenge / signature / `n` warnings, note them but still check whether an audio-only format downloaded successfully. These warnings do **not** always mean failure.
  3. If needed, retry with `--remote-components ejs:github`.
  4. Extract transcript via `fetch_transcript.py` and metadata via `yt-dlp -J --no-download URL`.
  5. Run `songsee` for a quick multi-panel spectrogram and use Python/librosa for BPM, key, harmonic-vs-percussive balance, and coarse energy-over-time.
  6. Combine audio findings + transcript hooks/repetition + runtime + keyword metadata + title phrasing + channel branding to infer a probable generation prompt/style.
  7. Be explicit about confidence: distinguish **audio-backed inference** from **metadata/transcript-only inference**.
- **web_extract on youtu.be fails**: if `web_extract` returns empty content or an invalid scrape error for a `youtu.be` shortlink, do not spend time retrying the extractor. Switch to `yt-dlp`, transcript extraction, or browser metadata extraction instead.

## Music / Suno style extraction workflow

When the user asks to "extract the Suno style," clarify internally that the exact hidden Suno style field usually cannot be recovered from the rendered song. The practical goal is to reconstruct the closest probable style string.

Recommended output structure:
1. **Short verdict** — one-line genre/style summary.
2. **Inferred style box** — concise Suno-ready style string.
3. **Why this fits** — cite title/tags/description, lyric themes, and audio findings.
4. **Recreation prompt** — one paragraph prompt for Suno/Udio.
5. **Fallback tools** — if extraction failed, list the concrete tools to use (`yt-dlp`, `ffmpeg`, transcript API, Whisper, `songsee`, `librosa`, `ffplay`/VLC).

Useful audio cues to report:
- approximate BPM (and halftime feel if relevant)
- approximate key / mode
- whether the track is harmonic-dominant or percussion-dominant
- dynamic arc: intro, build, chorus/drop, breakdown, finale
- vocal profile: solo male/female, choir, stacked harmonies, chant, spoken prayer, etc.
- production palette: cinematic/orchestral, tribal drums, pads, folk textures, EDM, trap hats, guitars, etc.
