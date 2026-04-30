---
name: rbrain-schema-ci-debugging
description: Debug and fix RBrain CI/E2E failures caused by database schema drift, missing migrations, PGLite parity gaps, or RLS verification failures.
version: 1.0.0
---

# RBrain Schema CI Debugging

## When to use

Use this when RBrain CI, E2E, BrainBench, code-indexing, or doctor tests fail with database/schema errors such as:

- `column "..." of relation "..." does not exist`
- missing Cathedral/code-indexing columns like `parent_symbol_path`
- PGLite/local tests passing differently from Supabase/Postgres tests
- RLS verification failures for newly added tables
- code chunk, code edge, symbol, content chunk, or FTS schema drift

## Contract

This skill guarantees:

- Treat CI logs as the source of truth before guessing
- Fix schema drift at the migration/schema source, not only at the failing importer
- Keep Supabase/Postgres migrations and PGLite/local test schema in parity
- Enable and verify RLS for any new persistent tables that doctor/RLS tests cover
- Run targeted Bun tests locally before pushing
- Keep urgent CI-fix commits separate from unrelated dirty dashboard/product work

## Workflow

1. **Read the failing CI logs first.**
   - Use `gh run view <run-id> --log-failed` or `gh run watch` output.
   - Capture the exact table/column/policy/test that failed.
   - Do not infer the fix from memory alone.

2. **Classify the failure.**
   - Missing column during import/indexing → migration/schema drift.
   - Test-only DB missing tables/columns → PGLite/local schema parity gap.
   - RLS doctor failure → table exists but lacks `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and/or expected policies.
   - Fallback chunking failure → importer may need resilience, but still check schema first.

3. **Find all schema definitions for the affected table.**
   - Search migrations and schema bootstrap files for the table/column.
   - For RBrain code-indexing/Cathedral work, check both real migrations and PGLite test schema.
   - If a column was introduced only in application code, add an additive migration such as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`.

4. **Patch schema source, not only symptoms.**
   - Add a new migration for missing persistent columns/tables.
   - Use additive/idempotent DDL where possible (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
   - Mirror required columns/tables in PGLite/local schema used by tests.
   - For new tables, explicitly enable RLS and add required policies if the suite verifies RLS.

5. **Patch importer resilience only after schema root cause is handled.**
   - If code chunking falls back to module chunks or optional metadata is absent, make the importer tolerate the fallback.
   - Do not use importer try/catch to hide a missing required migration.

6. **Verify with targeted tests.**
   Run the narrow tests that cover the failure before the full/CI path, for example:

   ```bash
   bun run typecheck
   bun test test/code-edges.test.ts test/cathedral-ii-brainbench.test.ts test/e2e/code-indexing.test.ts
   ```

   Adjust test names to the failing CI area.

7. **Commit and push only the CI fix scope.**
   - Check `git status --short` before staging.
   - Avoid mixing dashboard/product feature work into schema/CI fix commits.
   - Use focused messages such as `fix: restore code chunk schema migrations` and `fix: enable RLS for code edge tables`.

8. **Verify GitHub after push.**
   - Watch the relevant workflow runs until they finish.
   - If a first schema fix reveals a second failure (common: missing RLS after missing columns), repeat from CI logs rather than bundling guesses.

## Anti-Patterns

- Fixing only the application write path while leaving migrations stale
- Adding a column to Supabase migrations but forgetting PGLite/local schema
- Creating new tables without enabling RLS when doctor tests enforce it
- Mixing urgent CI schema fixes with unrelated dashboard/product changes
- Treating the first green local test as enough when the failure was CI-specific
- Hiding missing migrations behind broad importer error handling

## Output Format

When reporting back, include:

- Root cause in one sentence
- Files/commits changed
- Local verification commands and results
- GitHub workflow/run status
- Any unrelated dirty state deliberately left untouched
