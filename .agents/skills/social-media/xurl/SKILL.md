---
name: xurl
description: Official X/Twitter CLI by X Dev Platform. curl-like tool for the X API with shortcut commands for posting, reading, searching, liking, DMs, media upload, and raw API access. Built for agents. Supports OAuth 1.0a, OAuth 2.0, and app-only (bearer token) auth.
version: 1.0.0
platforms: [linux, macos]
prerequisites:
  commands: [xurl]
---

# xurl — Official X API CLI

`xurl` is the official CLI from X's dev platform (github.com/xdevplatform/xurl). It's purpose-built for OpenClaw agents with shortcut commands, JSON output, and multi-app auth support.

**Use this instead of x-cli (xitter skill).** xurl is maintained by X's own dev team.

## Auth Status

**Do not assume auth mode from this skill. Check it live with `xurl auth status` at the start of any task.**

Common cases:
- **Bearer/app-only** supports read operations like search, tweet reads, user lookups, and some public timelines.
- **OAuth 1.0a or OAuth 2.0 user context** is required for write operations like posting, liking, reposting, bookmarks, follows, DMs, and `whoami`.

If `xurl auth status` shows multiple credential types (for example `oauth1: ✓` and `bearer: ✓`), prefer the least-privileged mode needed for the task and avoid assuming writes are unavailable.

## Secret Safety

- **NEVER** read, print, cat, or send `~/.xurl` contents to LLM context
- **NEVER** use `--verbose` / `-v` in agent sessions (leaks auth headers)
- **NEVER** use these flags in agent commands: `--bearer-token`, `--consumer-key`, `--consumer-secret`, `--access-token`, `--token-secret`, `--client-id`, `--client-secret`
- To verify auth: `xurl auth status`

## Installation

Already installed via Homebrew. To install fresh:
```bash
brew install --cask xdevplatform/tap/xurl
# OR
npm install -g @xdevplatform/xurl
# OR
curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash
```

## Quick Reference

| Action | Command |
|---|---|
| Search | `xurl search "QUERY" -n 10` |
| Read tweet | `xurl read POST_ID_OR_URL` |
| User lookup | `xurl user @handle` |
| Your mentions | `xurl mentions -n 10` |
| Home timeline | `xurl timeline -n 20` |
| Post | `xurl post "Hello world!"` |
| Reply | `xurl reply POST_ID "Nice post!"` |
| Quote | `xurl quote POST_ID "My take"` |
| Delete | `xurl delete POST_ID` |
| Like | `xurl like POST_ID` |
| Repost | `xurl repost POST_ID` |
| Bookmark | `xurl bookmark POST_ID` |
| Follow | `xurl follow @handle` |
| Followers | `xurl followers -n 20` |
| Following | `xurl following -n 20` |
| Send DM | `xurl dm @handle "message"` |
| Upload media | `xurl media upload path/to/file` |
| Auth status | `xurl auth status` |
| Raw API GET | `xurl /2/users/me` |
| Raw API POST | `xurl -X POST /2/tweets -d '{"text":"hi"}'` |

**Post IDs vs URLs:** You can pass full URLs like `https://x.com/user/status/123` anywhere a POST_ID is expected. xurl extracts the ID automatically.

**Usernames:** Leading `@` is optional. Both `@elonmusk` and `elonmusk` work.

## Search Operators

The search command supports full X search syntax:
```bash
xurl search "from:elonmusk" -n 20
xurl search "#buildinpublic lang:en" -n 15
xurl search "\"AI agents\" healthcare" -n 10
xurl search "from:barsoumramy" -n 10
```

## RBrain Search Queries

The x-collector config tracks these searches. Use xurl to run them ad-hoc:
```bash
xurl search "\"AI agents healthcare\"" -n 10
xurl search "\"senior care AI\" OR \"elderly care AI\"" -n 10
xurl search "\"healthcare automation\"" -n 10
xurl search "\"AllCare\" OR \"allcare.ai\"" -n 10
xurl search "\"barsoumramy\" OR \"Ramy Barsoum\"" -n 10
xurl search "\"AI agents\" OR \"LLM agents\"" -n 10
xurl search "\"personal AI\" OR \"AI assistant\"" -n 10
xurl search "\"MCP protocol\" OR \"model context protocol\"" -n 10
xurl search "\"Claude Code\" OR \"Anthropic\"" -n 10
xurl search "\"Supabase\"" -n 10
```

## Common Workflows

### Direct read when you already have the URL or tweet ID
**Default rule:** if the user provides a tweet URL, tweet ID, or specific X post to inspect, **do not search first**. Read it directly:

```bash
xurl read 'https://x.com/user/status/1234567890'
xurl read 1234567890
```

Use search only when the target post is unknown and must be discovered.

### Search and read
```bash
xurl search "AI agents healthcare" -n 5
xurl read TWEET_ID_FROM_RESULTS
```

### Read full X Article body from a tweet URL
When a tweet links to an X Article, `xurl read` often only returns the tweet shell plus the article title. To fetch the full article body, do it in two steps:

1. Read the tweet first to confirm it has an `article` object and capture the tweet ID.
2. Call the raw v2 tweet endpoint with `tweet.fields=article,entities,created_at,public_metrics,attachments&expansions=author_id`.

Example:
```bash
xurl read 'https://x.com/user/status/1234567890'
xurl '/2/tweets/1234567890?tweet.fields=article,entities,created_at,public_metrics,attachments&expansions=author_id'
```

What to look for in the JSON:
- `data.article.title` — article title
- `data.article.preview_text` — short teaser
- `data.article.plain_text` — the full article body
- `includes.users[0]` — author name / username

Use this when:
- browser navigation to `x.com/i/article/...` returns login wall or page not found
- `web_extract` fails on the X article URL
- you need the actual longform text for summarization or analysis

### Screenshot-heavy posts: read media too
Some posts are just a short caption plus a screenshot of the real content. In those cases, `xurl read` gives the post text but not the screenshot text.

Workflow:
1. `xurl read <url-or-id>` first.
2. Inspect the returned media/attachments metadata to confirm the post is image-heavy.
3. If the meaning depends on the screenshot, use a vision/OCR path on the attached image rather than guessing from the caption alone.
4. If API search is unavailable or returns 401, do **not** switch to search-first. Stay on the direct-post workflow and inspect the known URL/ID plus its media.

Rule of thumb:
- **Known post URL/ID** → direct read first
- **Known post with screenshot doing the real work** → direct read + media inspection/OCR
- **Unknown post** → only then use search/discovery if the account/plan supports it

### User research
```bash
xurl user barsoumramy
xurl user @elonmusk
```

### Get a user's latest posts
Use this when you need the last 24 hours from a specific account.

1. Resolve the user ID:
```bash
xurl user @sama
```
2. Fetch recent tweets from the user timeline:
```bash
xurl '/2/users/1605/tweets?max_results=10&tweet.fields=created_at,public_metrics,entities,referenced_tweets'
```
3. If a post is part of a launch thread, read the important tweet IDs individually to pull more complete text:
```bash
xurl read TWEET_ID
```

Notes:
- Filter by `created_at` yourself for “last 24 hours”.
- The timeline endpoint is often the most reliable way to monitor specific public accounts for recent posts.
- The first tweet in a thread may be teaser copy; read later tweets in the same thread for rollout details, availability, and feature specifics.

### Post with media
```bash
xurl media upload photo.jpg          # note media_id from response
xurl post "Check this out" --media-id MEDIA_ID
```

## Global Flags

| Flag | Description |
|---|---|
| `--app NAME` | Use specific registered app |
| `--auth TYPE` | Force auth type: oauth1, oauth2, or app |
| `--username / -u` | Which OAuth2 account to use |
| `--verbose / -v` | **FORBIDDEN** in agent sessions |

## Raw API Access

For any X API v2 endpoint not covered by shortcuts:
```bash
xurl /2/users/me
xurl -X POST /2/tweets -d '{"text":"Hello world!"}'
xurl -X DELETE /2/tweets/1234567890
xurl https://api.x.com/2/users/me
```

Streaming endpoints are auto-detected. Force with `-s`:
```bash
xurl -s /2/tweets/search/stream
```

## Output Format

All commands return JSON. Typical success:
```json
{"data": {"id": "123", "text": "Hello world!"}}
```

Error:
```json
{"errors": [{"message": "Not authorized", "code": 403}]}
```

## Pitfalls

1. **Bearer token only covers read operations.** whoami, posting, liking, DMs all need OAuth 1.0a or OAuth 2.0 user context.
2. **403 on /2/users/me** means you're using app-only auth. Expected with bearer token setup.
3. **Rate limits** are per-endpoint. 429 = wait and retry.
4. **Search requires Basic tier ($200/mo) or above.** Free tier does not support search.
5. **Never use -v/--verbose** in agent sessions. It leaks auth headers in output.
6. **~/.xurl is off-limits.** Never read or cat this file.
7. **Large search results get truncated by terminal output caps.** `xurl search -n 100` can return 50+ KB of JSON. When using `terminal()` or `execute_code` to run xurl, the output may be silently truncated, causing JSON parse failures. **Fix:** pipe output to a temp file first (`xurl search "query" -n 100 > /tmp/xurl_out.json 2>&1`), then `json.load()` from the file. This reliably handles large payloads.
8. **OR queries with multiple quoted terms must be single-quoted for the shell.** Commands like `xurl search "AI agents" OR "LLM agents" -n 100` will fail with `Error: accepts 1 arg(s), received 3` because the shell splits the OR into separate arguments. **Fix:** wrap the entire query string in single quotes: `xurl search '"AI agents" OR "LLM agents"' -n 100`. In Python scripts using `terminal()`, construct the command as `f"xurl search '{query}' -n 100"`. Simple single-term queries like `xurl search "Supabase" -n 100` work fine without extra quoting.
