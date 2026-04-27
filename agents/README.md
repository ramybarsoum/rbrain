# Agent Profiles

This directory is the forkable agent layer for RBrain.

RBrain should be the source of truth for agent identity, operating rules, and shared protocols. Runtime homes such as `~/.hermes` or `~/.openclaw` should point back here instead of each inventing their own shape.

## What Is Tracked

- `README.md` explains the pattern.
- `registry.example.yaml` is the forkable example registry.
- `templates/` contains copyable profile templates.

## What Is Local

These files are intentionally ignored by git:

- `agents/<agent-id>/SOUL.md`
- `agents/<agent-id>/IDENTITY.md`
- `agents/<agent-id>/RUNTIME.md`
- `agents/registry.yaml`

They may contain personal preferences, local paths, Discord channel IDs, bot names, or company-specific operating rules. Do not commit them.

## Standard Shape

Each agent gets the same profile surface:

```text
agents/
  <agent-id>/
    SOUL.md       # personality, role, boundaries
    IDENTITY.md   # stable metadata and ownership
    RUNTIME.md    # local runtime paths, service names, handoff notes
```

The runtime then links to the RBrain-owned profile:

```text
~/.hermes/SOUL.md                  -> ~/RBrain/agents/max/SOUL.md
~/.hermes/IDENTITY.md              -> ~/RBrain/agents/max/IDENTITY.md
~/.hermes/RUNTIME.md               -> ~/RBrain/agents/max/RUNTIME.md

~/.openclaw/workspace/SOUL.md      -> ~/RBrain/agents/cole/SOUL.md
~/.openclaw/workspace/IDENTITY.md  -> ~/RBrain/agents/cole/IDENTITY.md
~/.openclaw/workspace/RUNTIME.md   -> ~/RBrain/agents/cole/RUNTIME.md
```

## Fork Setup

1. Copy `agents/registry.example.yaml` to `agents/registry.yaml`.
2. Create one folder per agent under `agents/<agent-id>/`.
3. Copy the files from `agents/templates/` into each folder and customize them.
4. Run `scripts/install-agent-profile-links.sh`.

Keep the harness thin and the skills fat. Agent profiles should define identity, boundaries, and routing. Durable methods belong in `skills/`, docs, recipes, cron jobs, or the brain itself.

## Secrets

Use 1Password for shared secrets when possible. Keep plaintext `.env` files local and gitignored, or replace them with secret-reference env files that `op run` resolves at runtime.

Example:

```bash
op run --env-file agents/secrets.env -- npm start
```

For automated services, use a least-privilege 1Password Service Account scoped to the vault/environment that agent needs. Store the service-account token outside the repo, preferably in the macOS Keychain, then launch agents through:

```bash
scripts/op-run-rbrain-agents.sh <env-file> <command> [args...]
```

That wrapper retrieves the service-account token from Keychain, runs `op run`, and removes `OP_SERVICE_ACCOUNT_TOKEN` before the real agent process starts. This avoids making the human 1Password app unlock a restart bottleneck while keeping the bootstrap credential out of launchd plists and git.

Remember that any unattended machine credential is still powerful. Keep the vault narrow, use read-only access, rotate the service-account token if the machine or OS user is compromised, and do not grant access to broad personal vaults.

See `agents/templates/secrets.env.example` for the copyable shape.
