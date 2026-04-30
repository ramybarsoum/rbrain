---
name: rbrain-supabase-schema-recovery
description: Recover legacy Supabase RBrain databases when migrations fail before running because the existing links table predates v11 and initSchema tries to create indexes on missing columns like `link_source` and `origin_page_id`.
version: 1.0.0
---

# RBrain Supabase Schema Recovery

## Contract

This skill guarantees:
- Diagnoses the specific legacy-links-table failure mode before making schema changes.
- Uses the smallest safe repair: add the missing `links` columns, then rerun migrations.
- Distinguishes this issue from normal migration reruns or fresh-install behavior.
- Verifies the brain reaches the target schema version after recovery.

## When to use

Use this when a Supabase-backed RBrain/GBrain upgrade or `scripts/migrate-supabase.ts` fails even after rerunning, especially if logs mention:
- missing `link_source`
- missing `origin_page_id`
- index creation on `links` failing during init/schema bootstrap
- a brain that is still around schema v10 or another pre-v11 state

## Recovery workflow

1. Confirm you are on the affected failure mode.
   - Read the failing migration output.
   - Verify the error is about `links` table columns that should exist in newer schemas.
   - Do **not** use this skill for auth failures, network failures, or unrelated SQL errors.

2. Add the missing columns manually on the live database:
   ```sql
   ALTER TABLE links ADD COLUMN IF NOT EXISTS link_source text;
   ALTER TABLE links ADD COLUMN IF NOT EXISTS origin_page_id uuid;
   ALTER TABLE links ADD COLUMN IF NOT EXISTS origin_field text;
   ```

3. Rerun the migration/upgrade path.
   - If using the Ramy fork workflow, rerun `scripts/migrate-supabase.ts` twice if the upgrade instructions still require two passes.
   - Watch for the schema version to advance cleanly instead of failing inside initSchema.

4. Verify success.
   - Confirm the target schema version was reached.
   - Run the relevant test or health-check command for the repo.
   - Record the recovery in the project timeline or upgrade notes.

## Why this happens

On legacy databases, `CREATE TABLE IF NOT EXISTS links` does not recreate the table, so newer schema bootstrap code can proceed to index creation assuming v11-era columns already exist. If the table predates that expansion, initSchema fails before the migration that would normally add those columns can complete.

## Output Format

Report:
- exact failing symptom
- whether the legacy-links-table diagnosis matched
- columns added manually
- migration command rerun
- final schema version / verification result

## Anti-Patterns

- Re-running migrations repeatedly without checking whether the failure happens before migrations can apply
- Applying this repair to unrelated SQL/auth failures
- Dropping or recreating the whole `links` table when additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is enough
- Declaring success without verifying the target schema version
