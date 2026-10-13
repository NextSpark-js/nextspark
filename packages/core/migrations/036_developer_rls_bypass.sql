-- Migration: 036_developer_rls_bypass.sql
-- Description: can_bypass_rls() is true for a developer as for a superadmin.
--
-- The developer role has every superadmin capability, plus devtools. Until now (027) can_bypass_rls() gave a developer
-- the bypass only as a member of the team flagged `metadata.systemAdmin = true`, and a deployment without sample data
-- has no such team: on the nextspark_app connection a developer saw only their own rows where a superadmin saw all.
-- - can_bypass_rls() is true when the request user's role is superadmin or developer; is_superadmin() is its alias
--   (001), so every policy that calls either follows;
-- - the System Admin Team keeps its role at the application layer (the x-admin-bypass team-context check), and 027's
--   enrollment trigger is unchanged.
-- On a connection that bypasses RLS (the table owner, or the service connection) nothing changes. Idempotent.

CREATE OR REPLACE FUNCTION public.can_bypass_rls()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public."users"
  WHERE id = public.get_auth_user_id();

  RETURN COALESCE(user_role IN ('superadmin', 'developer'), FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
