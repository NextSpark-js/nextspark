-- Migration: 027_rls_bypass_developer_and_system_admin_team.sql
-- Description: Resolve the System Admin Team by a metadata flag instead of a
--              hardcoded team id, auto-enroll/unenroll developer/superadmin
--              users via a trigger, and fix 4 RLS policies that hardcoded
--              their own role check instead of calling can_bypass_rls().
-- Date: 2026-09-03
-- Issues: #108, #102
--
-- Why both issues in one migration: #102's fix (make a policy call
-- can_bypass_rls()) only makes 'developer' bypass actually reachable in a
-- real (non-seeded) deployment once #108's enrollment mechanism exists —
-- fixing one without the other leaves the combination still broken.
--
-- #108 — System Admin Team enrollment:
--   can_bypass_rls() grants 'developer' a conditional bypass: membership in
--   the System Admin Team. Nothing ever enrolled anyone into it outside of
--   090_sample_data.sql's explicit INSERTs, and the team id was a literal
--   ('team-nextspark-001') duplicated in this function AND in
--   dual-auth.ts's SYSTEM_ADMIN_TEAM_ID constant. This migration:
--     1. Resolves the System Admin Team by `teams.metadata.systemAdmin =
--        true` instead of a literal id — 090_sample_data.sql's team already
--        carries this flag, so seeded deployments keep working unchanged;
--        a real deployment flags its own team, no code change needed.
--     2. Adds a trigger on users(role) that auto-enrolls a user into that
--        team (as 'owner' for superadmin, 'admin' for developer) when their
--        role becomes bypass-eligible, and removes the membership when it
--        stops being eligible. Framework-level (a Postgres trigger fires
--        regardless of which application code performed the UPDATE) rather
--        than an app-level hook, because no Server Action in core actually
--        assigns users.role today — the only code that does lives in
--        apps/dev, reimplementable by any consumer of this framework.
--     3. Backfills existing developer/superadmin users into the team, for
--        deployments that already have such users predating this trigger.
--   Deliberately NOT included here (separate, larger concern — see #108):
--   POST /api/v1/users creating a "half" user (no account/team/subscription
--   row). That depends on patterns from the not-yet-approved #98 MCP work.
--
-- #102 (+ 3 more found while auditing the same pattern) — RLS policies that
-- hardcoded `role IN ('admin','superadmin')` or `role = 'superadmin'`
-- instead of calling can_bypass_rls() have drifted from it in both
-- directions. 'admin' is NOT a valid users.role value (see check_users_role
-- in 002_auth_tables.sql: only 'member' | 'superadmin' | 'developer'), so
-- that branch never matched any real row — removing it changes nothing for
-- existing behavior. All four also silently excluded 'developer', who
-- can_bypass_rls() already grants conditional bypass everywhere else.
-- Switching to can_bypass_rls() is a pure widening for 'developer' and an
-- exact match for 'superadmin' — no regression, only fixes a gap:
--   - users_metas_owner_or_admin_all   (003_user_metas.sql)
--   - "API key owner or admin can do all" (004_api_key.sql)
--   - "API logs superadmin can select"     (005_api_audit_log.sql)
--   - "Plans superadmin write"             (012_billing_plans.sql)

-- ============================================
-- #108.1 — can_bypass_rls(): resolve System Admin Team by metadata flag
-- ============================================

CREATE OR REPLACE FUNCTION public.can_bypass_rls()
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id TEXT;
  user_role TEXT;
  admin_team_id TEXT;
  is_system_admin_member BOOLEAN;
BEGIN
  current_user_id := public.get_auth_user_id();

  SELECT role INTO user_role
  FROM public."users"
  WHERE id = current_user_id;

  IF user_role = 'superadmin' THEN
    RETURN TRUE;
  END IF;

  IF user_role = 'developer' THEN
    -- The System Admin Team is whichever team has metadata.systemAdmin =
    -- true, not a hardcoded id — each deployment can flag its own team.
    SELECT id INTO admin_team_id
    FROM public."teams"
    WHERE (metadata->>'systemAdmin')::boolean IS TRUE
    LIMIT 1;

    IF admin_team_id IS NULL THEN
      RETURN FALSE;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public."team_members"
      WHERE "userId" = current_user_id
        AND "teamId" = admin_team_id
    ) INTO is_system_admin_member;

    RETURN is_system_admin_member;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- #108.2 — auto-enroll/unenroll on role change
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_system_admin_team_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_team_id TEXT;
  new_team_role TEXT;
BEGIN
  SELECT id INTO admin_team_id
  FROM public."teams"
  WHERE (metadata->>'systemAdmin')::boolean IS TRUE
  LIMIT 1;

  -- No team flagged as the System Admin Team in this deployment yet —
  -- nothing to enroll into. Not an error: same as no bypass being possible.
  IF admin_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IN ('developer', 'superadmin') THEN
    new_team_role := CASE WHEN NEW.role = 'superadmin' THEN 'owner' ELSE 'admin' END;

    INSERT INTO public."team_members" ("teamId", "userId", role)
    VALUES (admin_team_id, NEW.id, new_team_role)
    ON CONFLICT ("teamId", "userId") DO UPDATE SET role = EXCLUDED.role;

  ELSIF TG_OP = 'UPDATE' AND OLD.role IN ('developer', 'superadmin') THEN
    -- Role changed away from a bypass-eligible tier: revoke membership.
    DELETE FROM public."team_members"
    WHERE "teamId" = admin_team_id AND "userId" = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_admin_team_membership ON public."users";
CREATE TRIGGER trg_sync_system_admin_team_membership
AFTER INSERT OR UPDATE OF role ON public."users"
FOR EACH ROW
EXECUTE FUNCTION public.sync_system_admin_team_membership();

-- ============================================
-- #108.3 — backfill existing developer/superadmin users
-- ============================================

DO $$
DECLARE
  admin_team_id TEXT;
BEGIN
  SELECT id INTO admin_team_id
  FROM public."teams"
  WHERE (metadata->>'systemAdmin')::boolean IS TRUE
  LIMIT 1;

  IF admin_team_id IS NOT NULL THEN
    INSERT INTO public."team_members" ("teamId", "userId", role)
    SELECT admin_team_id, u.id, CASE WHEN u.role = 'superadmin' THEN 'owner' ELSE 'admin' END
    FROM public."users" u
    WHERE u.role IN ('developer', 'superadmin')
    ON CONFLICT ("teamId", "userId") DO UPDATE SET role = EXCLUDED.role;
  END IF;
END $$;

-- ============================================
-- #102 + siblings — switch drifted policies to can_bypass_rls()
-- ============================================

DROP POLICY IF EXISTS "users_metas_owner_or_admin_all" ON "users_metas";
CREATE POLICY "users_metas_owner_or_admin_all" ON "users_metas"
  FOR ALL
  TO authenticated
  USING ("userId" = public.get_auth_user_id() OR public.can_bypass_rls())
  WITH CHECK ("userId" = public.get_auth_user_id() OR public.can_bypass_rls());

DROP POLICY IF EXISTS "API key owner or admin can do all" ON "api_key";
CREATE POLICY "API key owner or admin can do all" ON "api_key"
  FOR ALL TO authenticated
  USING ("userId" = public.get_auth_user_id() OR public.can_bypass_rls())
  WITH CHECK ("userId" = public.get_auth_user_id() OR public.can_bypass_rls());

DROP POLICY IF EXISTS "API logs superadmin can select" ON "api_audit_log";
CREATE POLICY "API logs superadmin can select" ON "api_audit_log"
  FOR SELECT TO authenticated
  USING (public.can_bypass_rls());

DROP POLICY IF EXISTS "Plans superadmin write" ON public."plans";
CREATE POLICY "Plans superadmin write"
ON public."plans"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());
