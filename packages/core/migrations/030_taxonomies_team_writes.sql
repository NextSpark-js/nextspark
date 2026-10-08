-- Migration: 030_taxonomies_team_writes.sql
-- Description: Taxonomy rows are written by members of their team; rows without a team only by a superadmin.
--
-- 021 let any authenticated user write a taxonomy row with "teamId" IS NULL. Post categories are now created in
-- the caller's team (lib/api/post-categories.ts), and the rows without a team that earlier releases created stay
-- readable by everyone but are changed only by a superadmin. This policy says the same on the RLS-enforced
-- connection: reads are as before, writes need the row's team (or is_superadmin()).
-- is_superadmin() also accepts a developer enrolled in the System Admin Team; the API (lib/api/post-categories.ts) is
-- stricter and lets only users.role = 'superadmin' change a row without a team.
-- Idempotent; the anon read policy from 006 is unchanged.

DROP POLICY IF EXISTS "taxonomies auth can do all" ON public.taxonomies;
DROP POLICY IF EXISTS "taxonomies auth can select" ON public.taxonomies;
DROP POLICY IF EXISTS "taxonomies team can write" ON public.taxonomies;

CREATE POLICY "taxonomies auth can select"
ON public.taxonomies
FOR SELECT TO authenticated
USING (
  "teamId" IS NULL
  OR "teamId" = ANY(public.get_user_team_ids())
  OR public.is_superadmin()
);

CREATE POLICY "taxonomies team can write"
ON public.taxonomies
FOR ALL TO authenticated
USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin())
WITH CHECK ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());
