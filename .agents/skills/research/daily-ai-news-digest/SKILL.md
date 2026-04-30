---
name: daily-ai-news-digest
description: Build a concise AI news digest from major blogs, Hacker News, and X with fallbacks when sources block scraping or APIs fail.
version: 1.0.0
---

# Daily AI News Digest

Use this when the user wants a daily or last-24-hours AI news summary sourced from major AI company blogs, Hacker News, and public X posts.

## Sources
Typical source set:
- Anthropic newsroom/blog
- OpenAI blog/news
- Google DeepMind blog
- Hacker News front page
- Selected X accounts (for example `@sama`, `@karpathy`, `@AnthropicAI`)

## Workflow

1. **Get the live current time first**
   - Use `terminal("date ...")` to get both UTC and local time.
   - On macOS, do **not** use GNU-style `date -d` flags. Prefer a portable Python one-liner to compute the 24-hour cutoff:
     - `python3 - <<'PY'\nfrom datetime import datetime, timedelta, timezone\nnow=datetime.now(timezone.utc)\nprint('UTC_NOW', now.strftime('%Y-%m-%dT%H:%M:%SZ'))\nprint('UTC_CUTOFF', (now-timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ'))\nPY`
   - Define the exact 24-hour cutoff before filtering posts.

2. **Check X auth before any X work**
   - Run `xurl auth status` first.
   - Never use `-v` / `--verbose`.
   - Never read `~/.xurl`.

3. **Try `web_extract` for blogs and HN first**
   - Use it for the requested pages because it is cheap and structured when it works.
   - If it fails or returns malformed internal errors, fall back immediately to `browser_navigate` or `execute_code` / `requests`.

4. **Anthropic newsroom fallback**
   - `browser_navigate("https://www.anthropic.com/news")` works well for listing recent entries.
   - The accessibility snapshot usually exposes headline, category, and date directly.

5. **OpenAI blog/news fallback**
   - `openai.com/blog` and article pages may return bot-protection pages in browser and direct HTTP fetches.
   - Best fallback: use `https://openai.com/news/rss.xml`.
   - When fetching RSS from Python or shell, send a browser-like `User-Agent` header. Direct `urllib`/default-client requests may return `403 Forbidden`, while the same URL works with a normal UA.
   - Parse RSS items for title, link, description, and `pubDate`. `lastBuildDate` is also useful as a quick freshness check before deeper parsing.
   - This is the most reliable way to determine whether OpenAI posted something in the last 24 hours.

6. **DeepMind blog fallback**
   - If the landing page is hard to parse, fetch `https://deepmind.google/blog/` with `requests` in `execute_code`.
   - The page often exposes titles and links, but the landing page may only show month-level dates.
   - For any candidate item, open the individual article and look for `datePublished`, `article:published_time`, or visible article-meta date before including it.
   - Do not infer “last 24 hours” from a month-only card.

7. **Hacker News fallback**
   - If `web_extract` fails, prefer the official Firebase API over scraping HTML:
     - `https://hacker-news.firebaseio.com/v0/topstories.json`
     - `https://hacker-news.firebaseio.com/v0/newstories.json`
     - then `.../item/ID.json` for candidate stories.
   - This is more reliable than parsing HN HTML and gives title, URL, score, timestamp, and comment count directly.
   - Only include AI-related items with real signal; ignore generic tech/news unless it clearly matters to AI.

8. **X account workflow**
   - Run `xurl auth status` first, but do not assume `search` will work just because auth looks healthy.
   - In practice, `xurl search ...` may be inconsistent: some searches succeed while other queries still return `401 Unauthorized` even when `oauth1: ✓` and `bearer: ✓` are present.
   - For daily digests, prefer account timelines over search whenever possible:
     - Resolve each account ID with `xurl user @handle`.
     - Fetch recent tweets with:
       - `xurl '/2/users/USER_ID/tweets?max_results=10&exclude=retweets,replies&tweet.fields=created_at,public_metrics,entities,referenced_tweets'`
   - Filter by `created_at` against the 24-hour cutoff yourself.
   - If a quoted or linked tweet seems important, use `xurl read TWEET_ID` to inspect the referenced post.
   - If a timeline tweet is part of a reply chain and looks truncated or incomplete, read the reply itself and then read its parent tweet ID too. The actual operator insight is often split across the two posts.
   - If search is required and fails, fall back to curated account timelines plus direct reads instead of retrying the same search endpoint.
   - If X access broadly fails, fall back to `web_search` for recent posts from that account.

9. **Signal filter**
   Include only:
   - major launches
   - model releases
   - product/API updates
   - substantive research announcements
   - materially interesting AI-related HN discussions
   - high-signal X posts that change perception of a launch or trend

   Exclude:
   - recruiting posts
   - generic hype
   - reposts without new information
   - low-signal banter
   - month-old items that merely appear on a front page

10. **Compose the digest tightly**
   - Prefer 3–5 shipped items max.
   - Prefer 2–3 discussion items max.
   - Prefer 1–2 links max.
   - If nothing meaningful happened, output the quiet-day fallback exactly as requested.

## Practical findings
- `web_extract` can fail with internal scrape errors even on normal public pages; do not get stuck retrying the same call repeatedly.
- `web_search` may also fail transiently in this environment; keep a direct-HTTP fallback via `execute_code` / `requests` for major sources.
- For broad topical digests where official source RSS is unavailable, use news RSS fallbacks from `execute_code`:
  - Google News RSS: `https://news.google.com/rss/search?q=<urlencoded query>&hl=en-US&gl=US&ceid=US:en`
  - Bing News RSS: `https://www.bing.com/news/search?q=<urlencoded query>&format=rss`
  - Bing News RSS often exposes cleaner destination URLs inside `apiclick.aspx?...&url=<encoded destination>` than Google News article wrapper URLs.
- Do not feed Google News `/rss/articles/...` wrapper links directly to `web_extract`; they may return an empty Google syndication shell or internal scrape errors. Resolve to the publisher URL when possible, or use the RSS item title/source/date as the source record and fetch the publisher page separately.
- For publisher pages, a robust fallback is `requests` + `BeautifulSoup`: remove `script/style/nav/header/footer`, then print title plus keyword-filtered text lines. This worked for Yahoo/BusinessWire, MobiHealthNews, Healthcare IT News, AHA, and HealthTech Magazine when `web_extract` was broken.
- Some healthcare/news publishers return Cloudflare/403 pages (for example FierceHealthcare, Becker's, MedCityNews in one run). If blocked, use an alternate syndicated copy (Yahoo/MSN), another outlet covering the same announcement, or the RSS headline/date without pretending you extracted article body.
- OpenAI pages are especially likely to block browser/direct fetches, but `news/rss.xml` remains usable and should be the default fallback.
- For DeepMind, verify exact publish dates on article pages before inclusion; landing cards may only show `April 2026`.
- Hacker News is useful for “what people are talking about,” not just launches from official blogs.

## Output style
Keep final output:
- concise
- scannable
- Discord-friendly
- with no process notes or source dump unless the user explicitly asks for them.
