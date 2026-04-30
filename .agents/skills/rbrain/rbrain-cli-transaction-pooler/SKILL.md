---
name: rbrain-cli-transaction-pooler
description: |
  Use the local gbrain CLI against Ramy's live Supabase-backed RBrain when the default
  session pooler URL on port 5432 fails with auth/session-pool exhaustion. Switch to the
  transaction pooler on 6543 for read-oriented CLI access.
version: 1.0.0
triggers:
  - "gbrain list/get/query fails with max clients reached"
  - "EMAXCONNSESSION"
  - "RBrain CLI auth works intermittently"
  - "Need local readonly gbrain access to live RBrain"
tools:
  - terminal
  - read_file
mutating: false
---

# RBrain CLI via transaction pooler (6543)

## Prerequisite: verify gbrain config

Before troubleshooting pooler issues, check `~/.gbrain/config.json`:

```bash
cat ~/.gbrain/config.json
```

It must say `"engine": "postgres"` with the Supabase DATABASE_URL. If it says `"engine": "pglite"` or points to a temp directory (e.g. `/var/folders/.../gbrain-home-isolation-.../brain.pglite`), gbrain CLI commands will fail with `relation "pages" does not exist` because they hit an empty local DB.

**Fix:**

```json
{
  "engine": "postgres",
  "database_url": "postgresql://postgres.<ref>:<pass>@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
}
```

Read the correct URL from `~/RBrain/.env` (`RBRAIN_DATABASE_URL` or `DATABASE_URL`).

**Why this happens:** `gbrain init` defaults to PGLite. If init was run in an isolated test environment, the config can persist with a stale temp path. The config is global at `~/.gbrain/config.json`, not per-project.

## When to use

Use this when local `bun run src/cli.ts ...` commands inside `~/RBrain` fail against the live Supabase brain with errors like:

- `relation "pages" does not exist` ← **check config first (above)**
- `password authentication failed for user "postgres"`
- `EMAXCONNSESSION max clients reached in session mode`
- session-pool exhaustion on `aws-1-us-east-1.pooler.supabase.com:5432`

This is especially useful for **read-oriented** operations during investigation/content mining:

- `list`
- `get`
- `timeline`
- `search`
- `query`

## Why this works

Ramy's `.env` may point `RBRAIN_DATABASE_URL` / `DATABASE_URL` at the **session pooler** on port `5432`. That can fail under load or pool exhaustion.

Switching the same URL to port **`6543`** uses the **transaction pooler**, which works reliably for one-shot CLI reads. GBrain detects this and disables prepared statements automatically.

Expected stderr note:

```text
[gbrain] Prepared statements disabled (PgBouncer transaction-mode convention on port 6543)
```

## Procedure

1. Work in `~/RBrain`.
2. Read `.env` and extract `RBRAIN_DATABASE_URL` (or `DATABASE_URL`).
3. Replace `:5432/` with `:6543/`.
4. Export both `RBRAIN_DATABASE_URL` and `DATABASE_URL` to that modified URL for the subprocess only.
5. Run the needed `bun run src/cli.ts ...` command.

## Reliable pattern

Use a Python wrapper so secrets stay in-process and the override only applies to the child command:

```bash
python - <<'PY'
import os, re, subprocess
from pathlib import Path
text = Path('.env').read_text()
m = re.search(r'^RBRAIN_DATABASE_URL=(.*)$', text, re.M)
if not m:
    m = re.search(r'^DATABASE_URL=(.*)$', text, re.M)
url = m.group(1).strip().strip('"').strip("'")
url = url.replace(':5432/', ':6543/')
env = os.environ.copy()
env['RBRAIN_DATABASE_URL'] = url
env['DATABASE_URL'] = url
res = subprocess.run(
    ['bun', 'run', 'src/cli.ts', 'list', '-n', '20'],
    cwd='.',
    env=env,
    capture_output=True,
    text=True,
)
print(res.stdout)
print(res.stderr)
print('EXIT', res.returncode)
PY
```

Then swap `list -n 20` for `get <slug>`, `timeline <slug>`, `search <query>`, etc.

## Verification

Success usually looks like:

- command exits `0`
- stderr includes the prepared-statements-disabled message
- stdout returns real page data

## Pitfalls

- Do **not** edit `.env` just to switch ports for a one-off inspection; prefer subprocess env overrides.
- This skill is for **live RBrain access**, not repo-local markdown search.
- Query quality can still be noisy; when exact pages are known, prefer `get` and `timeline` over `query`.
- Some meeting slugs use `meeting/...`, others use `meetings/...`; if `get` fails, use `list --type meeting -n 30` first.
