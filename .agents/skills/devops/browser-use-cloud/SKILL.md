---
name: browser-use-cloud
description: Run AI browser automation tasks via Browser Use Cloud API v3. Send a natural-language task, get structured results back. Handles stealth browsers, CAPTCHA solving, residential proxies, profiles, file workspaces, streaming, and follow-up tasks.
tags: [browser, automation, scraping, browser-use, cloud]
---

# browser-use-cloud

Managed AI browser automation via Browser Use Cloud. The agent handles the browser — you just describe the task in natural language.

## Setup (already done)

- **SDK**: `browser-use-sdk` 3.4.3 installed in hermes venv
- **API key**: `BROWSER_USE_API_KEY` in `~/.hermes/.env` (starts with `bu_`)
- **API base**: `https://api.browser-use.com/api/v3`
- **Auth header**: `X-Browser-Use-API-Key`
- **Dashboard**: https://cloud.browser-use.com

## Quick patterns

### 1. Simple task (one-shot)

```python
import asyncio, json
from browser_use_sdk.v3 import AsyncBrowserUse

async def run_task(task: str, model: str = "claude-sonnet-4.6") -> str:
    client = AsyncBrowserUse()
    result = await client.run(task, model=model)
    return result.output

# In execute_code or terminal:
# output = asyncio.run(run_task("Go to hacker news and list the top 5 posts"))
```

### 2. Structured output (Pydantic)

```python
from pydantic import BaseModel

class Result(BaseModel):
    items: list[str]

async def run_structured(task: str, schema: type[BaseModel]) -> dict:
    client = AsyncBrowserUse()
    result = await client.run(task, output_schema=schema)
    return result.output
```

### 3. Follow-up tasks (multi-step in same browser)

```python
async def multi_step(tasks: list[str]) -> list[str]:
    client = AsyncBrowserUse()
    session = await client.sessions.create()
    results = []
    for task in tasks:
        result = await client.run(task, session_id=session.id)
        results.append(result.output)
    await client.sessions.stop(session.id)
    return results
```

### 4. Streaming messages (monitor progress)

```python
async def run_streaming(task: str):
    client = AsyncBrowserUse()
    run = client.run(task)
    async for msg in run:
        print(f"[{msg.role}] {msg.summary}")
    return run.result.output
```

### 5. Cached/deterministic rerun (cheap repeated tasks)

Use `@{{value}}` syntax + `workspace_id` for auto-caching. First call runs the agent (~$0.10, ~60s). Subsequent calls with different params are cached ($0 LLM, ~5s).

```python
async def cached_scrape(task_template: str, workspace_id: str):
    client = AsyncBrowserUse()
    result = await client.run(task_template, workspace_id=workspace_id)
    return result.output
```

### 6. Profiles (persistent login state)

```python
async def with_profile(task: str, profile_name: str):
    client = AsyncBrowserUse()
    profiles = await client.profiles.list(query=profile_name)
    if profiles.items:
        profile = profiles.items[0]
    else:
        profile = await client.profiles.create(name=profile_name)

    session = await client.sessions.create(profile_id=profile.id)
    result = await client.run(task, session_id=session.id)
    # IMPORTANT: stop session to persist profile state
    await client.sessions.stop(session.id)
    return result.output
```

### 7. File workspaces

```python
async def with_files(task: str, upload_paths: list[str] = None):
    client = AsyncBrowserUse()
    ws = await client.workspaces.create(name="task-workspace")
    if upload_paths:
        await client.workspaces.upload(ws.id, *upload_paths)
    result = await client.run(task, workspace_id=str(ws.id))
    # Download files agent created
    files = await client.workspaces.files(ws.id)
    return result.output, ws.id
```

### 8. Human-in-the-loop

```python
async def human_loop(task1: str, task2: str):
    client = AsyncBrowserUse()
    session = await client.sessions.create()
    live_url = session.live_url  # share with user
    result1 = await client.run(task1, session_id=session.id)
    # Human interacts via live_url, then:
    result2 = await client.run(task2, session_id=session.id)
    await client.sessions.stop(session.id)
    return result1.output, result2.output, live_url
```

### 9. Raw browser via CDP (Playwright/Puppeteer)

```python
async def raw_browser():
    client = AsyncBrowserUse()
    browser = await client.browsers.create(proxy_country_code="us")
    cdp_url = browser.cdp_url   # connect via Playwright/Puppeteer
    live_url = browser.live_url  # watch live
    # ... use CDP ...
    await client.browsers.stop(browser.id)
```

### 10. Direct curl (no SDK needed)

```bash
# Create session
curl -X POST https://api.browser-use.com/api/v3/sessions \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "Go to example.com and extract the main heading"}'

# Poll for result
curl https://api.browser-use.com/api/v3/sessions/SESSION_ID \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY"
```

## Models (v3)

| Model | API String | Input/1M | Output/1M | Best for |
|-------|-----------|----------|-----------|----------|
| Claude Sonnet 4.6 | `claude-sonnet-4.6` | $3.60 | $18.00 | Default, best balance |
| Claude Opus 4.6 | `claude-opus-4.6` | $6.00 | $30.00 | Hardest tasks, max accuracy |
| GPT-5.4 mini | `gpt-5.4-mini` | $0.90 | $5.40 | Simple/well-defined tasks |

**Default**: `claude-sonnet-4.6` (recommended by Browser Use).

## Key parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `task` | str | Natural language task. 1-50K chars. |
| `model` | str | Model override. Default: `claude-sonnet-4.6`. |
| `session_id` | str | Reuse existing session for follow-ups. |
| `profile_id` | str | Load persistent browser profile (cookies, localStorage). |
| `workspace_id` | str | Workspace for file upload/download. |
| `output_schema` | Pydantic class | Structured output validation. |
| `proxy_country_code` | str | Proxy country (e.g. `us`, `de`, `jp`). 195+ countries. Default: US. |
| `enable_recording` | bool | Get MP4 recording of session. |
| `keep_alive` | bool | Keep session alive between tasks. |
| `cache_script` | bool/None | Auto-detect from `@{{}}` syntax. Force enable/disable. |
| `agentmail` | bool | Enable email inbox for 2FA. Default: True. |

## Session lifecycle

1. **Create**: `client.sessions.create()` → returns `id`, `live_url`
2. **Run task**: `client.run(task, session_id=id)` → polls until done, returns result
3. **Follow-up**: `client.run(next_task, session_id=id)` → same browser, new agent
4. **Stop**: `client.sessions.stop(id)` → always call this to persist profiles and stop billing
5. **Timeout**: Sessions auto-timeout after 15 min inactivity (max 4 hours)

## When to use what

| Scenario | Pattern |
|----------|---------|
| Quick one-off scrape | Simple task (#1) |
| Extract typed data | Structured output (#2) |
| Multi-page flow (login → navigate → extract) | Follow-up tasks (#3) |
| Watch progress live | Streaming (#4) |
| Repeated same-site scraping | Cached rerun (#5) |
| Site requiring login | Profiles (#6) |
| Agent needs input files or creates output | Workspaces (#7) |
| Human needs to interact mid-task | Human-in-the-loop (#8) |
| Full CDP control (Playwright/Puppeteer) | Raw browser (#9) |
| No Python available | curl (#10) |

## Costs

- Browser Use charges per session + LLM tokens + browser/proxy time
- First agent run: ~$0.05-$1.00 depending on complexity
- Cached rerun: **$0 LLM cost**, ~$0.01-0.05 infra
- Recording MP4s: presigned URLs expire after 1 hour

## Gotchas

- **Always `sessions.stop()`** when done — profile state only persists on clean stop, and sessions bill until timeout.
- **v3 only**. v2 uses different method names (`llm` instead of `model`, `AsyncBrowserUse` from `browser_use_sdk` not `browser_use_sdk.v3`).
- **Recording URLs expire** in 1 hour. Download promptly.
- **Session timeout**: 15 min idle, 4 hours max. Send lightweight tasks to reset timer.
- **`output_schema` returns typed objects** via Pydantic — use `.model_dump()` if you need raw dict.
- **`proxy_country_code=None`** disables the residential proxy (for localhost/QA testing).
- **Agent Mail is on by default** — each session gets an email address for 2FA flows.
- **`keep_alive=True`** keeps the session open after task completion for follow-ups.
- **`allowed_domains`** restricts the agent — supports wildcards like `*.example.com`.

## Relationship to browser-harness skill

- **`browser-use-cloud`** (this skill): Agent-driven via Browser Use Cloud API. You describe the task, their AI handles the browser. Best for: scraping, form filling, research, multi-step web workflows.
- **`browser-harness`**: Direct CDP control of a local or remote browser. You write the exact clicks/types. Best for: precise UI testing, when you need pixel-perfect control, complex iframe/shadow DOM work.

Use Browser Use Cloud when you want to say *what* to do. Use browser-harness when you need to say *exactly how* to do it.
