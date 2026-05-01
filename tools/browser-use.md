---
name: browser-use
type: cloud-api
description: Browser Use cloud API — the remote side of browser-harness. Spawns isolated browsers for parallel agents and headless servers. The local-Chrome attach side is documented in skills/browser-harness/.
---

# Browser Use (cloud API)

> **Router entry:** `skills/RESOLVER.md` → "MCP Tools" table, row "Browser Use".
> **Related skill:** `skills/browser-harness/SKILL.md` — runtime contract. This file covers the cloud side (remote daemons, profile sync, API key conventions). Local Chrome attach is in the skill file.

## What it is

A cloud service that runs Chromium browsers on demand and exposes them over CDP (Chrome DevTools Protocol). The `browser-harness` harness connects to a cloud browser the same way it connects to local Chrome — one `start_remote_daemon(name)` call and the next `browser-harness <<'PY'` block runs against the cloud browser.

**When to reach for it (vs local Chrome attach):**

- **Parallel sub-agents.** Each gets its own isolated browser via a distinct `BU_NAME`. No fighting over `/tmp/bu-default.sock`.
- **Headless servers.** No local Chrome available (OpenClaw reference deployment running in a remote VM, etc.).
- **Clean-room automation.** No user cookies or open tabs to interfere with.
- **Specific-country proxies.** `proxyCountryCode="de"` routes through a German exit for geo-locked sites.

**When NOT to reach for it:**

- The task needs the user's real session (their logins, their open tabs, their cookies). Use local attach per `skills/browser-harness/`.
- The task is a single read. Local attach has zero cloud latency.

## API key

`BROWSER_USE_API_KEY` (format `bu_...`). Per-machine `.env` file:

- **Ramy's MacBook:** `~/Projects/browser-harness/.env`, mode 0600, gitignored.
- **cole-macbook (Hermes):** same pattern, wherever the harness is installed.
- **Shell export wins.** `helpers.py:_load_env` uses `os.environ.setdefault` — exported `BROWSER_USE_API_KEY` in zsh profile overrides `.env`. Intentional, so machine-level keys beat per-repo keys.

Only required for remote-daemon operations. Local Chrome attach works without it.

## Runtime surface (inside the harness)

```python
start_remote_daemon("work")                            # clean browser, no profile
start_remote_daemon("work", profileName="my-work")     # reuse a cloud profile (already logged in)
start_remote_daemon("work", profileId="<uuid>")        # same, by UUID
start_remote_daemon("work", proxyCountryCode="de", timeout=120)  # DE proxy, 2-hour timeout
start_remote_daemon("work", proxyCountryCode=None)     # disable the default Browser Use proxy
list_cloud_profiles()                                  # enumerate saved logged-in profiles
list_local_profiles()                                  # local Chrome profiles (for sync_local_profile)
sync_local_profile(name_or_path)                       # upload a local profile to the cloud
```

After `start_remote_daemon`, set `BU_NAME` in the environment for subsequent harness calls:

```bash
BU_NAME=work browser-harness <<'PY'
new_tab("https://example.com")
print(page_info())
PY
```

## Profile sync (cookies / login state)

Profiles are cookies-only login state that live in Browser Use cloud. Use when the agent needs a pre-authenticated browser without replaying a login flow each time.

- **First time:** `sync_local_profile("my-work")` uploads your local Chrome profile's cookies to the cloud.
- **Subsequent:** `start_remote_daemon("work", profileName="my-work")` — cloud browser boots with those cookies in place.
- **Persistence:** cookies mutated during a remote session only persist on a clean `PATCH /browsers/{id}` with `{"action":"stop"}`. The daemon does this automatically on graceful shutdown when `BU_BROWSER_ID` + `BROWSER_USE_API_KEY` are set (default for remote daemons). Sessions that hit `timeout` lose in-session cookie updates.

Full mechanic: `interaction-skills/profile-sync.md` in the upstream browser-harness repo.

## Pricing / billing

Running remote daemons bill until timeout. Don't start-and-forget. Set `timeout` explicitly (default is short). On shutdown, the daemon calls `PATCH /browsers/{id}` with `action: stop` to persist profile state and end billing.

## Live URL

`start_remote_daemon` prints `liveUrl` and auto-opens it in the local browser (if a GUI is detected) so the user can watch the remote session. Headless servers print only — share the URL with the user so they can observe.

## Gotchas

- **`cdpUrl` is HTTPS, not ws.** Resolve the websocket URL via `/json/version` on the returned `cdpUrl`.
- **Remote API is camelCase on the wire.** `cdpUrl`, `proxyCountryCode`, `profileName` — not snake_case.
- **Use `BU_BROWSER_ID` + `BROWSER_USE_API_KEY` together.** Just one doesn't let the daemon stop the cloud browser on shutdown. Without both, cookie mutations in the session are lost.
- **Start with `proxyCountryCode=None` for debugging geo issues.** The default proxy may be the cause of what looks like a site bug.
- **Do NOT use for user-session tasks.** If the task needs Ramy's logged-in state on a site, remote browser is the wrong tool — it won't have his cookies unless you've synced a profile for that site. Local attach is the default for anything user-personal.

## See also

- Runtime: `skills/browser-harness/SKILL.md`
- Install (local CLI): `skills/browser-harness/install.md`
- Upstream docs: `https://docs.browser-use.com/cloud/llms.txt`
- Router row: `skills/RESOLVER.md` → MCP Tools → "Browser Use"
