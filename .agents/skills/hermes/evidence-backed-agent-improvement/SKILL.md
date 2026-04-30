---
name: evidence-backed-agent-improvement
description: Default operating rule for improving Hermes/Max. Prefer measured meta-loop improvements over hype, trivial changes, or unrestricted self-editing.
version: 2.0.0
---

# Evidence-Backed Agent Improvement

Use this when:
- the user asks how Hermes/Max should improve itself
- considering prompt, memory, routing, tool, or workflow changes
- deciding whether a paper/framework should become a standing system rule

## Contract

This skill guarantees:
- prioritize improvements to the meta-loop: routing, memory, evaluation, promotion logic, retry policy, and strategy selection
- push back on hype, trivial gains, local optimizations, and unrestricted self-editing
- prefer bounded, reviewable changes over freeform self-rewriting
- require evidence, transfer, or at least non-regression before promoting a change to default behavior

## What to improve first

1. Strategy selection
2. Tool/routing policy
3. Memory and failure recall
4. Verification/eval loops
5. Promotion and rollback rules

## What to treat skeptically

- endless prompt mutation
- autonomous rewriting of core behavior without review
- changes that only help one benchmark or one-off task
- lineage/archive systems without repeated task classes or measurable outcomes

## Promotion gate

Do not recommend a change as a default rule unless it has:
- a repeated task class
- a clear success metric
- evidence of improvement over current behavior
- no meaningful regression in adjacent task classes

## Production-safe implementation pattern

When turning this rule into a Hermes feature, prefer this architecture:
- collect **strategy telemetry** first (task class, chosen strategy, retries, verification result, latency, tool count)
- aggregate into a **strategy registry** with candidate/promoted/retired states
- apply promoted strategies through **bounded runtime guidance**, preferably `ephemeral_system_prompt` or equivalent per-turn injection
- keep the stable cached system prompt as unchanged as possible
- make rollback immediate and reviewable

### Good editable surfaces
- routing policy
- memory recall behavior
- verification and eval loops
- retry and fallback policy
- delegation thresholds
- promotion / rollback rules

### Forbidden or manual-only surfaces
- core identity prompt mutation
- tool permissions / tool availability changes
- safety or approval boundary changes
- autonomous runtime code rewriting
- broad self-editing with no explicit review path

## Output format

When advising on agent improvement, answer in this order:
1. Position
2. What already exists
3. What adds real value
4. What is hype / low value
5. Recommended default rule
6. Next implementation step

## Implementation status

### Phase 1: Strategy telemetry (shipped)

**Files changed:**
- `hermes_state.py` — `strategy_events` table (schema v7), `record_strategy_event()` (best-effort), `get_strategy_events()`
- `run_agent.py` — `_record_tool_telemetry()` helper, wired into sequential (line ~7548) and concurrent (line ~7214) paths
- `tests/test_hermes_state.py` — 10 tests in `TestStrategyEvents`

**Schema:** `strategy_events(id, session_id, timestamp, event_type, tool_name, strategy, task_class, result, latency_ms, token_delta, metadata_json)`

**Event types (Phase 1):** `tool_call`, `tool_result`, `retry`, `session_end`

### Phase 2: Strategy registry with scored promotion/retirement (shipped)

**Schema v8:** `strategy_registry(id, name UNIQUE, description, state, score, strategy_type, task_class, sample_count, success_count, failure_count, avg_latency_ms, baseline_latency_ms, config_json, created_at, updated_at, promoted_at, retired_at)`

**State machine:** `candidate → promoted → retired` (one-way transitions)

**Methods on `SessionDB`:**
- `register_strategy(name, ...)` — upsert: creates candidate or updates existing fields
- `get_strategy(name)` / `list_strategies(state=, strategy_type=, task_class=)`
- `aggregate_tool_stats(since=)` — SQL GROUP BY over strategy_events → per-tool stats
- `recompute_strategy_score(name)` — recalculates from raw events
- `evaluate_promotion(name)` — checks all gates, returns per-check pass/fail dict
- `promote_strategy(name)` — executes promotion if gates pass
- `retire_strategy(name, reason=)` — demotes, stores reason in config_json
- `get_promoted_strategies()` — returns all promoted, highest score first

**Scoring formula (0.0–1.0):**
```
score = success_rate × 0.5 + log_confidence(samples) × 0.2 + latency_bonus × 0.3
```
- `log_confidence`: `min(0.2, 0.2 * log1p(N) / log1p(100))` — logarithmic, saturates at 100 samples
- `latency_bonus`: `max(0, min(0.3, 0.3 * (baseline - avg) / baseline))` — only when baseline exists

**Promotion gate thresholds (class-level, patchable in tests):**
| Check | Threshold |
|-------|-----------|
| `PROMOTE_MIN_SAMPLES` | ≥ 20 |
| `PROMOTE_MIN_SUCCESS_RATE` | ≥ 0.80 |
| `PROMOTE_MAX_AVG_LATENCY_MS` | ≤ 30,000 |
| `PROMOTE_LATENCY_IMPROVEMENT_PCT` | ≥ 0.10 (only if baseline exists) |

**Tests:** 25 new tests across `TestStrategyRegistrySchema`, `TestStrategyRegistryCRUD`, `TestStrategyAggregation`, `TestStrategyPromotion`, `TestStrategyRetirement`

**Pending phases:**
- Phase 3: bounded prompt injection (promoted strategies → runtime guidance via prompt builder)
- Phase 4: CLI surface (`/insights --strategies`)

### SQLite migration pitfalls (hermes_state.py)

When adding a new table/column to `hermes_state.py`:

1. **Add to BOTH `SCHEMA_SQL` AND the migration block.** Fresh databases execute `SCHEMA_SQL` directly (they skip migrations since `schema_version` starts at current). Migration-only additions mean fresh DBs (including test DBs) won't have the table.

2. **Bump `SCHEMA_VERSION`** and add a `if current_version < N:` migration block in `_init_schema()`.

3. **Update existing tests** that hardcode `assert version == N` in `TestSchemaInit`.

4. **Migration tests need full column sets.** A minimal "v(N-1) database" for migration testing must include all columns referenced by `SCHEMA_SQL` indexes (e.g., `parent_session_id`, `started_at DESC`). Missing columns cause `cursor.executescript(SCHEMA_SQL)` to fail on the index creation.

### run_agent.py instrumentation pattern

- `_record_tool_telemetry()` is a standalone method on `AIAgent` that wraps `self._session_db.record_strategy_event()` in a try/except.
- It is called in two places: the sequential path (after `_detect_tool_failure`) and the concurrent path (after `is_error` detection in the results loop).
- Both calls are guarded: `if not self._session_db: return` at the top, bare `except: pass` at the bottom. Telemetry must never block tool execution.

### Strategy registry implementation notes

- **`recompute_strategy_score()` uses global events** (all `tool_call` events, not filtered by strategy name). This is the Phase 2 simplification. Phase 3+ should filter by `strategy` or `task_class` column when strategies are linked to specific event subsets.
- **Promotion checks are class-level constants** (`PROMOTE_MIN_SAMPLES`, etc.) so tests can monkeypatch them without DB changes.
- **`register_strategy()` does upsert, not replace** — calling it again with a new description updates only that field, preserving state/score/counts.
- **`retire_strategy()` stores reason in `config_json`**, not a dedicated column. Keeps schema lean but requires `json.loads()` to inspect.

## Implemented phases

### Phase 1: Strategy telemetry (shipped)
- `hermes_state.py`: `strategy_events` table, `record_strategy_event()`, `get_strategy_events()`
- `run_agent.py`: `_record_tool_telemetry()` wired into both sequential and concurrent paths
- Best-effort only, never blocks tool execution
- Schema v7

### Phase 2: Strategy registry (shipped)
- `hermes_state.py`: `strategy_registry` table with candidate/promoted/retired states
- Methods: `register_strategy()`, `get_strategy()`, `list_strategies()`, `aggregate_tool_stats()`, `recompute_strategy_score()`, `evaluate_promotion()`, `promote_strategy()`, `retire_strategy()`, `get_promoted_strategies()`
- Scoring: success_rate×0.5 + log_confidence×0.2 + latency_bonus×0.3
- Promotion gate: 4 checks (min samples ≥20, success rate ≥80%, latency ceiling ≤30s, latency improvement ≥10%)
- Schema v8

### Phase 3: Bounded prompt injection (shipped)
- `agent/prompt_builder.py`: `STRATEGY_GUIDANCE_HEADER` constant
- `run_agent.py`: `_build_strategy_guidance()` reads promoted strategies, formats as guidance
- Injected into `ephemeral_system_prompt` at agent init (not cached system prompt)
- Never persisted, easily reversible, zero-cost when no strategies are promoted

### Phase 4: CLI surface (shipped)
- `agent/insights.py`: `generate_strategy_report()`, `format_strategy_terminal()`, `format_strategy_gateway()`
- `cli.py`: `_show_insights` extended with `--strategies` flag
- `gateway/run.py`: `_handle_insights_command` extended with `--strategies` flag
- `hermes_cli/commands.py`: Updated args_hint to show `[--days N] [--strategies]`
- Usage: `/insights --strategies` (CLI or Discord/Telegram/Slack)

### Remaining phases (not yet built)
- Phase 5: Automated periodic evaluation + rollback

## Anti-patterns

- confusing architectural novelty with production leverage
- proposing self-modification because it sounds advanced
- recommending broad core changes before evals exist
- treating style mutations as equally valuable to routing or verification changes
- adding tables only to the migration block (fresh DBs skip migrations)
