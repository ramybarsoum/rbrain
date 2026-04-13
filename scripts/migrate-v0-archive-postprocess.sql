-- Phase 3 of the v0_archive → public migration.
-- Run AFTER `bun src/cli.ts import /tmp/v0-export --no-embed --workers 8` finishes.
-- Reads v0_archive tables and writes structured timeline + links into public.
--
-- Lookup strategy: every page produced by Phase 1 carries `v0_id` and
-- `v0_table` in its frontmatter jsonb, so we resolve V0 IDs → RBrain page IDs
-- by joining on `((pages.frontmatter #>> '{}')::jsonb)->>'v0_id'`.
--
-- Idempotent: ON CONFLICT DO NOTHING on every insert. Safe to re-run.

\set ON_ERROR_STOP on

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. Timeline entries: join v0_archive.timeline_entries → compiled_truth
--    → matched person/project/topic page in public.pages
-- ────────────────────────────────────────────────────────────────────

-- Helper CTE: resolve every compiled_truth row to its corresponding
-- public.pages.id (could be a person, project, or orphan/topic).
WITH ct_to_page AS (
  SELECT
    ct.id AS ct_id,
    COALESCE(
      -- entity-bound: people or projects
      (SELECT p.id FROM public.pages p
       WHERE ((p.frontmatter #>> '{}')::jsonb)->>'v0_id' = ct.entity_id::text
         AND ((p.frontmatter #>> '{}')::jsonb)->>'v0_table' IN ('people','projects')
       LIMIT 1),
      -- orphans + topics: stored with v0_table='compiled_truth'
      (SELECT p.id FROM public.pages p
       WHERE ((p.frontmatter #>> '{}')::jsonb)->>'v0_id' = ct.id::text
         AND ((p.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'compiled_truth'
       LIMIT 1)
    ) AS page_id
  FROM v0_archive.compiled_truth ct
)
INSERT INTO public.timeline_entries (page_id, date, source, summary, detail)
SELECT
  ctp.page_id,
  te.occurred_at::date,
  COALESCE(te.source_type, ''),
  te.summary,
  COALESCE(te.detail, '')
FROM v0_archive.timeline_entries te
JOIN ct_to_page ctp ON ctp.ct_id = te.compiled_truth_id
WHERE ctp.page_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_entries te2
    WHERE te2.page_id = ctp.page_id
      AND te2.date = te.occurred_at::date
      AND te2.summary = te.summary
      AND te2.source = COALESCE(te.source_type, '')
  );

-- ────────────────────────────────────────────────────────────────────
-- 2. Links: follow_ups → person
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.links (from_page_id, to_page_id, link_type, context)
SELECT fp.id, pp.id, 'about', 'follow-up tied to person'
FROM v0_archive.follow_ups fu
JOIN public.pages fp ON ((fp.frontmatter #>> '{}')::jsonb)->>'v0_id' = fu.id::text
  AND ((fp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'follow_ups'
JOIN public.pages pp ON ((pp.frontmatter #>> '{}')::jsonb)->>'v0_id' = fu.contact_id::text
  AND ((pp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'people'
WHERE fu.contact_id IS NOT NULL
ON CONFLICT (from_page_id, to_page_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- 3. Links: interactions → person (contact_id and/or person_id)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.links (from_page_id, to_page_id, link_type, context)
SELECT DISTINCT ip.id, pp.id, 'with', 'interaction with person'
FROM v0_archive.interactions i
JOIN public.pages ip ON ((ip.frontmatter #>> '{}')::jsonb)->>'v0_id' = i.id::text
  AND ((ip.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'interactions'
JOIN public.pages pp ON (
       ((pp.frontmatter #>> '{}')::jsonb)->>'v0_id' = i.contact_id::text
    OR ((pp.frontmatter #>> '{}')::jsonb)->>'v0_id' = i.person_id::text
  )
  AND ((pp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'people'
WHERE i.contact_id IS NOT NULL OR i.person_id IS NOT NULL
ON CONFLICT (from_page_id, to_page_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- 4. Links: feature_requests → project (linked_project)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.links (from_page_id, to_page_id, link_type, context)
SELECT frp.id, pp.id, 'requested_for', 'feature request linked to project'
FROM v0_archive.feature_requests fr
JOIN public.pages frp ON ((frp.frontmatter #>> '{}')::jsonb)->>'v0_id' = fr.id::text
  AND ((frp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'feature_requests'
JOIN public.pages pp ON ((pp.frontmatter #>> '{}')::jsonb)->>'v0_id' = fr.linked_project::text
  AND ((pp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'projects'
WHERE fr.linked_project IS NOT NULL
ON CONFLICT (from_page_id, to_page_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- 5. Links: meeting_participants (meeting → person)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.links (from_page_id, to_page_id, link_type, context)
SELECT mp_page.id, pp.id, 'attended_by', COALESCE(mp.email, mp.name, '')
FROM v0_archive.meeting_participants mp
JOIN public.pages mp_page ON ((mp_page.frontmatter #>> '{}')::jsonb)->>'v0_id' = mp.meeting_id::text
  AND ((mp_page.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'meetings'
JOIN public.pages pp ON ((pp.frontmatter #>> '{}')::jsonb)->>'v0_id' = mp.person_id::text
  AND ((pp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'people'
WHERE mp.person_id IS NOT NULL
ON CONFLICT (from_page_id, to_page_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- 6. Timeline: meeting_action_items become timeline entries on meeting pages
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.timeline_entries (page_id, date, source, summary, detail)
SELECT
  mp.id,
  COALESCE(mai.due_date, mai.created_at::date),
  'action_item',
  mai.action,
  CASE
    WHEN mai.assignee IS NOT NULL THEN 'assigned to: ' || mai.assignee
    ELSE COALESCE(mai.status, '')
  END
FROM v0_archive.meeting_action_items mai
JOIN public.pages mp ON ((mp.frontmatter #>> '{}')::jsonb)->>'v0_id' = mai.meeting_id::text
  AND ((mp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'meetings'
WHERE NOT EXISTS (
  SELECT 1 FROM public.timeline_entries te2
  WHERE te2.page_id = mp.id AND te2.summary = mai.action AND te2.source = 'action_item'
);

-- ────────────────────────────────────────────────────────────────────
-- 7. Timeline: decisions get a timeline entry on their decided_at date
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.timeline_entries (page_id, date, source, summary, detail)
SELECT
  dp.id,
  COALESCE(d.decided_at::date, d.created_at::date),
  'decision_made',
  d.title,
  COALESCE(d.outcome, '')
FROM v0_archive.decisions d
JOIN public.pages dp ON ((dp.frontmatter #>> '{}')::jsonb)->>'v0_id' = d.id::text
  AND ((dp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'decisions'
WHERE (d.decided_at IS NOT NULL OR d.created_at IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_entries te2
    WHERE te2.page_id = dp.id AND te2.source = 'decision_made' AND te2.summary = d.title
  );

-- ────────────────────────────────────────────────────────────────────
-- 8. Timeline: follow_ups with due dates
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.timeline_entries (page_id, date, source, summary, detail)
SELECT
  fp.id,
  fu.due_date,
  'follow_up_due',
  fu.title,
  COALESCE(fu.notes, '')
FROM v0_archive.follow_ups fu
JOIN public.pages fp ON ((fp.frontmatter #>> '{}')::jsonb)->>'v0_id' = fu.id::text
  AND ((fp.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'follow_ups'
WHERE fu.due_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_entries te2
    WHERE te2.page_id = fp.id AND te2.source = 'follow_up_due' AND te2.summary = fu.title
  );

-- ────────────────────────────────────────────────────────────────────
-- 9. Timeline: interactions on their occurred_at date
-- ────────────────────────────────────────────────────────────────────

INSERT INTO public.timeline_entries (page_id, date, source, summary, detail)
SELECT
  ip.id,
  i.occurred_at::date,
  COALESCE('interaction_' || i.platform, 'interaction'),
  COALESCE(i.subject, i.type, 'interaction'),
  COALESCE(i.snippet, '')
FROM v0_archive.interactions i
JOIN public.pages ip ON ((ip.frontmatter #>> '{}')::jsonb)->>'v0_id' = i.id::text
  AND ((ip.frontmatter #>> '{}')::jsonb)->>'v0_table' = 'interactions'
WHERE NOT EXISTS (
  SELECT 1 FROM public.timeline_entries te2
  WHERE te2.page_id = ip.id
    AND te2.date = i.occurred_at::date
    AND te2.summary = COALESCE(i.subject, i.type, 'interaction')
);

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Sanity counts after post-process
-- ────────────────────────────────────────────────────────────────────

SELECT 'pages' AS what, count(*) FROM public.pages
UNION ALL SELECT 'links', count(*) FROM public.links
UNION ALL SELECT 'timeline_entries', count(*) FROM public.timeline_entries
UNION ALL SELECT 'tags', count(*) FROM public.tags;
