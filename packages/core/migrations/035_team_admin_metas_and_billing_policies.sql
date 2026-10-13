-- Migration: 035_team_admin_metas_and_billing_policies.sql
-- Description: More RLS policies follow the API's rules: team edits by admins, the metas of pages and posts, and the
-- billing tables.
--
-- teams (010 let only the owner update the team row, while PATCH /api/v1/teams/:teamId allows team.edit, which admins
-- hold):
-- - the owner and the team's admins update the team; a superadmin as before;
-- - an admin changes only what the route writes: name, slug, description, avatarUrl and settings;
-- - nobody changes "ownerId" through RLS: an ownership transfer runs on the service connection.
-- pages_metas and posts_metas (the pages and posts entity migrations let any signed-in user read and write every row):
-- - a row is read and written only when its page or post belongs to one of the caller's teams, as tasks_metas does;
-- - is_superadmin() keeps every row; the anonymous read of public metadata is unchanged.
-- subscriptions, usage, usage_events and billing_events (owners and admins could write them, and any signed-in user
-- could add usage events to any team):
-- - they are written by core's billing services, jobs and payment webhooks on the service connection, so through RLS
--   only can_bypass_rls() writes them;
-- - reads are unchanged.
-- On a connection that bypasses RLS (the table owner, or the service connection) nothing changes. Idempotent. The metas
-- part runs only when the tables exist; the pages and posts entity migrations of the templates declare the same policies
-- for projects created later.

-- ============================================
-- teams
-- ============================================

DROP POLICY IF EXISTS "teams_update_policy" ON public."teams";
CREATE POLICY "teams_update_policy" ON public."teams"
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR "ownerId" = public.get_auth_user_id()
    OR public.auth_team_role(id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_superadmin()
    OR "ownerId" = public.get_auth_user_id()
    OR public.auth_team_role(id) IN ('owner', 'admin')
  );

CREATE OR REPLACE FUNCTION public.teams_rls_update_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT row_security_active('public.teams') OR public.is_superadmin() THEN
    RETURN NEW;
  END IF;
  IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
    RAISE EXCEPTION 'A team''s owner cannot change here' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."ownerId" IS DISTINCT FROM public.get_auth_user_id()
     AND (to_jsonb(NEW) - ARRAY['name', 'slug', 'description', 'avatarUrl', 'settings', 'updatedAt'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name', 'slug', 'description', 'avatarUrl', 'settings', 'updatedAt']) THEN
    RAISE EXCEPTION 'A team admin cannot change these team fields' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_rls_update_limits ON public."teams";
CREATE TRIGGER teams_rls_update_limits
BEFORE UPDATE ON public."teams"
FOR EACH ROW EXECUTE FUNCTION public.teams_rls_update_limits();

-- ============================================
-- pages_metas and posts_metas
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.pages_metas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "pages_metas_auth_all" ON public."pages_metas";
    CREATE POLICY "pages_metas_auth_all"
    ON public."pages_metas" FOR ALL TO authenticated
    USING (
      public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public."pages" p
        WHERE p.id = "pages_metas"."pageId"
          AND p."teamId" = ANY(public.get_user_team_ids())
      )
    )
    WITH CHECK (
      public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public."pages" p
        WHERE p.id = "pages_metas"."pageId"
          AND p."teamId" = ANY(public.get_user_team_ids())
      )
    );
  END IF;

  IF to_regclass('public.posts_metas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "posts_metas_auth_all" ON public."posts_metas";
    CREATE POLICY "posts_metas_auth_all"
    ON public."posts_metas" FOR ALL TO authenticated
    USING (
      public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public."posts" p
        WHERE p.id = "posts_metas"."postId"
          AND p."teamId" = ANY(public.get_user_team_ids())
      )
    )
    WITH CHECK (
      public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public."posts" p
        WHERE p.id = "posts_metas"."postId"
          AND p."teamId" = ANY(public.get_user_team_ids())
      )
    );
  END IF;
END $$;

-- ============================================
-- billing: written on the service connection only
-- ============================================

DROP POLICY IF EXISTS "Subscriptions elevated insert" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions elevated update" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions elevated delete" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions bypass insert" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions bypass update" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions bypass delete" ON public."subscriptions";

CREATE POLICY "Subscriptions bypass insert"
ON public."subscriptions"
FOR INSERT TO authenticated
WITH CHECK (public.can_bypass_rls());

CREATE POLICY "Subscriptions bypass update"
ON public."subscriptions"
FOR UPDATE TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());

CREATE POLICY "Subscriptions bypass delete"
ON public."subscriptions"
FOR DELETE TO authenticated
USING (public.can_bypass_rls());

DROP POLICY IF EXISTS "Usage system write" ON public."usage";
CREATE POLICY "Usage system write"
ON public."usage"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());

DROP POLICY IF EXISTS "Usage events system write" ON public."usage_events";
CREATE POLICY "Usage events system write"
ON public."usage_events"
FOR INSERT TO authenticated
WITH CHECK (public.can_bypass_rls());

DROP POLICY IF EXISTS "Billing events elevated insert" ON public."billing_events";
DROP POLICY IF EXISTS "Billing events bypass insert" ON public."billing_events";
CREATE POLICY "Billing events bypass insert"
ON public."billing_events"
FOR INSERT TO authenticated
WITH CHECK (public.can_bypass_rls());
