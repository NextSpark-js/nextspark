-- Migration: 012_teams_functions_triggers.sql
-- Description: Helper functions for teams system including Phase 2 RLS optimization functions
-- Date: 2025-11-26
-- Updated: 2025-12-01 - Removed team type references (simplified architecture)

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's teams with membership details
CREATE OR REPLACE FUNCTION get_user_teams(user_id_param TEXT)
RETURNS TABLE (
  team_id TEXT,
  team_name TEXT,
  team_slug TEXT,
  user_role team_role,
  joined_at TIMESTAMPTZ,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    tm.role,
    tm."joinedAt",
    COUNT(tm2.id) as member_count
  FROM public."teams" t
  INNER JOIN public."team_members" tm ON t.id = tm."teamId"
  LEFT JOIN public."team_members" tm2 ON t.id = tm2."teamId"
  WHERE tm."userId" = user_id_param
  GROUP BY t.id, t.name, t.slug, tm.role, tm."joinedAt"
  ORDER BY t."createdAt" DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user has permission in team
CREATE OR REPLACE FUNCTION has_team_permission(
  user_id_param TEXT,
  team_id_param TEXT,
  required_roles team_role[]
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role team_role;
BEGIN
  SELECT role INTO user_role
  FROM public."team_members"
  WHERE "teamId" = team_id_param
    AND "userId" = user_id_param;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_role = ANY(required_roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get team member count
CREATE OR REPLACE FUNCTION get_team_member_count(team_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM public."team_members"
  WHERE "teamId" = team_id_param;

  RETURN COALESCE(count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Cleanup expired invitations (can be called via cron or periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public."team_invitations"
  SET status = 'expired'
  WHERE status = 'pending'
    AND "expiresAt" <= now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PHASE 2: RLS OPTIMIZATION FUNCTIONS
-- ============================================

-- Get user's team IDs (for RLS performance optimization)
-- Returns an array of team IDs where the user is a member
-- Used to optimize RLS policies by avoiding subqueries
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS TEXT[] AS $$
DECLARE
  user_teams TEXT[];
BEGIN
  SELECT ARRAY_AGG(tm."teamId") INTO user_teams
  FROM public."team_members" tm
  WHERE tm."userId" = public.get_auth_user_id();

  RETURN COALESCE(user_teams, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is superadmin
-- Returns true if the authenticated user has 'superadmin' role
-- Used for RLS policies to grant superadmins full access
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public."users"
  WHERE id = public.get_auth_user_id();

  RETURN user_role = 'superadmin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- TEAMS RLS POLICIES
-- (Moved from 009 because they reference team_members)
-- Updated: 2025-12-01 - Removed team type references
-- ============================================

-- Teams: users can view teams where they are members
DROP POLICY IF EXISTS "teams_select_policy" ON public."teams";
CREATE POLICY "teams_select_policy" ON public."teams"
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR
    id IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- Teams: authenticated users can create teams
DROP POLICY IF EXISTS "teams_insert_policy" ON public."teams";
CREATE POLICY "teams_insert_policy" ON public."teams"
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User must be creating the team for themselves
    "ownerId" = public.get_auth_user_id()
  );

-- Teams: only owners can update their teams
DROP POLICY IF EXISTS "teams_update_policy" ON public."teams";
CREATE POLICY "teams_update_policy" ON public."teams"
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR
    "ownerId" = public.get_auth_user_id()
  )
  WITH CHECK (
    public.is_superadmin()
    OR
    "ownerId" = public.get_auth_user_id()
  );

-- Teams: only owners can delete their teams
DROP POLICY IF EXISTS "teams_delete_policy" ON public."teams";
CREATE POLICY "teams_delete_policy" ON public."teams"
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR
    "ownerId" = public.get_auth_user_id()
  );
