# GBrain Skill Resolver

This is the dispatcher. Skills are the implementation. MCPs are the tools. **Read this file before acting.** If two skills could match, read both. They are designed to chain (e.g., ingest then enrich for each entity).

## Always read first

Before any task, read these files in order:

1. **`~/RBrain/SOUL.md`** — user personality, writing style, company info, key people, product principles, decision rights.
2. **This file (RESOLVER.md)** — skill routing, MCP tool lookup, filing rules.

Never guess about people, companies, skills, or MCPs. The resolver has the answer.

## Before mutating anything in this repo (NON-NEGOTIABLE)

If you are about to **add or modify a row in this file, create a new fat file under `mcps/` or `tools/`, or add a new skill**, read `skills/conventions/router-pattern.md` first. It defines the "earn the file" test, the thin-row vs fat-file split, and the cross-linking rules. Any agent touching RBrain structure without applying that convention will break the organization the rest of this repo depends on.

## Always-on (every message)

| Trigger | Skill |
|---------|-------|
| Every inbound message (spawn parallel, don't block) | `skills/signal-detector/SKILL.md` |
| Any brain read/write/lookup/citation | `skills/brain-ops/SKILL.md` |

## Brain operations

| Trigger | Skill |
|---------|-------|
| "What do we know about", "tell me about", "search for" | `skills/query/SKILL.md` |
| "Who knows who", "relationship between", "connections", "graph query" | `skills/query/SKILL.md` (use graph-query) |
| Creating/enriching a person or company page | `skills/enrich/SKILL.md` |
| Where does a new file go? Filing rules | `skills/repo-architecture/SKILL.md` |
| Fix broken citations in brain pages | `skills/citation-fixer/SKILL.md` |
| "Research", "track", "extract from email", "investor updates", "donations" | `skills/data-research/SKILL.md` |
| Share a brain page as a link | `skills/publish/SKILL.md` |
| "Weekly signal diff", "what changed this week" | `skills/weekly-signal-diff/SKILL.md` |
| "Daily digest", "yesterday's summary", "morning brief" | `skills/daily-digest/SKILL.md` |

## Content & media ingestion

| Trigger | Skill |
|---------|-------|
| User shares a link, article, tweet, or idea | `skills/idea-ingest/SKILL.md` |
| User shares an article with learning intent ("what can I learn", "extract learnings") | `skills/article-learning/SKILL.md` (review only, can chain after idea-ingest) |
| User approves numbered article changes ("1, 3, 5", "all except 2", "apply them") | `skills/article-apply-changes/SKILL.md` |
| Video, audio, PDF, book, YouTube, screenshot | `skills/media-ingest/SKILL.md` |
| Meeting transcript received | `skills/meeting-ingestion/SKILL.md` |
| Generic "ingest this" (auto-routes to above) | `skills/ingest/SKILL.md` |
| Large file (>10MB), bulk document ingestion | `skills/heavy-file-ingestion/SKILL.md` |

## Thinking skills (from GStack)

| Trigger | Skill |
|---------|-------|
| "Brainstorm", "I have an idea", "office hours" | GStack: office-hours |
| "Review this plan", "CEO review", "poke holes" | GStack: ceo-review |
| "Grill me", "stress test this plan", "challenge this design" | `skills/grill-me/SKILL.md` |
| "Write a PRD", "create a PRD", "plan a new feature" | `skills/write-a-prd/SKILL.md` |
| "Break PRD into issues", "PRD to tickets", "create issues from PRD" | `skills/prd-to-issues/SKILL.md` |
| "Debug", "fix", "broken", "investigate" | GStack: investigate |
| "Retro", "what shipped", "retrospective" | GStack: retro |

> These skills come from GStack. If GStack is installed, the agent reads them directly.
> If not, brain-only mode still works (brain skills function without thinking skills).

## Operational

| Trigger | Skill |
|---------|-------|
| Task add/remove/complete/defer/review | `skills/daily-task-manager/SKILL.md` |
| Morning prep, meeting context, day planning | `skills/daily-task-prep/SKILL.md` |
| Daily briefing, "what's happening today" | `skills/briefing/SKILL.md` |
| Cron scheduling, quiet hours, job staggering | `skills/cron-scheduler/SKILL.md` |
| Save or load reports | `skills/reports/SKILL.md` |
| "Create a skill", "improve this skill" | `skills/skill-creator/SKILL.md` |
| "Skillify this", "is this a skill?", "make this proper" | `skills/skillify/SKILL.md` |
| "Is gbrain healthy?", morning health check, skillpack-check | `skills/skillpack-check/SKILL.md` |
| Cross-modal review, second opinion | `skills/cross-modal-review/SKILL.md` |
| "Validate skills", skill health check | `skills/testing/SKILL.md` |
| Webhook setup, external event processing | `skills/webhook-transforms/SKILL.md` |
| Continuous learning, knowledge extraction | `skills/claudeception/SKILL.md` |
| "Context rescue", "save this session", long conversation cleanup | `skills/context-rescue/SKILL.md` |
| "Spawn agent", "background task", "parallel tasks", "steer agent", "pause/resume agent" | `skills/minion-orchestrator/SKILL.md` |

## Browser interaction (live attach, user's session)

| Trigger | Skill |
|---------|-------|
| "Open the browser", "go to URL", "click this page", "scrape this site" | `skills/browser-harness/SKILL.md` |
| "Automate my Chrome", "log me into X", "take a screenshot of page Y" | `skills/browser-harness/SKILL.md` |
| User shares a site they want the agent to interact with live (uses their real cookies/session) | `skills/browser-harness/SKILL.md` |

> Use `skills/browser-harness/` over the Playwright MCP whenever the task needs the user's real browser session (cookies, logins, open tabs). Playwright spawns its own ephemeral browser; browser-harness attaches via CDP to the user's already-running Chrome and uses screenshot-first coordinate clicks. First-time install on a new machine: read `skills/browser-harness/install.md`.

## Setup & migration

| Trigger | Skill |
|---------|-------|
| "Set up GBrain", first boot | `skills/setup/SKILL.md` |
| "Migrate from Obsidian/Notion/Logseq" | `skills/migrate/SKILL.md` |
| Brain health check, maintenance run | `skills/maintain/SKILL.md` |
| "Extract links", "build link graph", "populate timeline" | `skills/maintain/SKILL.md` (extraction sections) |
| "Brain health", "what features am I missing", "brain score" | Run `gbrain features --json` |
| "Set up autopilot", "run brain maintenance", "keep brain updated" | Run `gbrain autopilot --install --repo ~/brain` |
| Agent identity, "who am I", customize agent | `skills/soul-audit/SKILL.md` |
| "Populate links", "extract links", "backfill graph" | `skills/maintain/SKILL.md` (graph population phase) |
| "Populate timeline", "extract timeline entries" | `skills/maintain/SKILL.md` (graph population phase) |

## MCP Tools

Thin rows here are the router. When a row has a **fat file** link, read that file when you need depth (auth, gotchas, operation tables).

| MCP / Tool | Purpose | Depth |
|------------|---------|-------|
| **rbrain** | Persistent knowledge base | **Fat file:** `mcps/rbrain.md` (operations, slug rules, session-start rules, gotchas) |
| **Google Workspace** (`gws` CLI) | Gmail, Calendar, Drive, Sheets, Docs, Slides, Tasks | **Fat file:** `mcps/gws.md` (subcommands, OAuth, gotchas) |
| **Browser Use** (cloud API) | Remote browsers via CDP — parallel agents, headless servers | **Fat file:** `tools/browser-use.md` (API key, remote daemon, profile sync) |
| **agentmail** | Email (max.brain@agentmail.to) | Send/receive emails, inbox management |
| **granola** | Meeting notes & transcripts | Query meeting content, get transcripts, list meetings |
| **Discord** (`mcp__plugin_discord_discord__*`) | Messaging (RStack HQ) | Send messages, read channels, thread management |
| **Slack** | Team messaging | AllCare team comms, channel messages |
| **HeroUI** (`heroui-react`) | UI component docs | Before using any HeroUI component, call for docs first |
| **Figma** | Design files | Read design specs, component designs, layouts |
| **Stedi** | Eligibility checks | Insurance eligibility verification |
| **Linear** | Project management | Issue tracking, sprint management, task boards |
| **Playwright** | Browser automation | E2E testing. For live user session, prefer `skills/browser-harness/` |
| **CodeGraph** | Code exploration | Symbol search, call graphs, impact analysis, code context |

> **Pattern:** rows with a fat-file link mirror how skills work (thin router → fat `SKILL.md`). Add a new fat file under `mcps/` or `tools/` only when a row grows complexity worth documenting in one place. Simple rows stay thin.

## Filing resolver

Content goes where its primary subject dictates, not by format:

| Content type | Directory |
|-------------|-----------|
| Person | `people/` |
| Company | `companies/` |
| Meeting | `meetings/` |
| Concept or framework | `concepts/` |
| Idea or original thinking | `ideas/` |
| Project or initiative | `projects/` |
| Active task state or resumable workspace context | `working/` |
| Raw source material | `sources/` (bulk imports only) |

Full filing rules: `skills/_brain-filing-rules.md`

## Disambiguation rules

When multiple skills could match:
1. Prefer the most specific skill (meeting-ingestion over ingest)
2. If the user mentions a URL, route by content type (link → idea-ingest, video → media-ingest)
3. If the user mentions a person/company, check if enrich or query fits better
4. Chaining is explicit in each skill's Phases section
5. When in doubt, ask the user

## Conventions (cross-cutting)

These apply to ALL brain-writing skills:
- `skills/conventions/quality.md` — citations, back-links, notability gate
- `skills/conventions/brain-first.md` — check brain before external APIs
- `skills/conventions/subagent-routing.md` — when to use Minions vs inline work
- `skills/_brain-filing-rules.md` — where files go
- `skills/_output-rules.md` — output quality standards
