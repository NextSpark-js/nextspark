-- Migration: 037_users_role_guard.sql
-- Description: users.role changes through RLS only for can_bypass_rls(), and never on the caller's own row.
--
-- The "Users self update" policy (002) lets a user update their own row, and no policy is per column, so the role
-- column needs its own rule, as 035 gave teams."ownerId" one:
-- - on the RLS-enforced connection (nextspark_app), a role change is refused unless the caller passes
--   can_bypass_rls() (a superadmin or a developer, 036), and always on the caller's own row;
-- - core's routes already decide who assigns which role (lib/auth/assignable-roles.ts) and suspend on the service
--   connection, so they are unaffected.
-- On a connection that bypasses RLS (the table owner, or the service connection) the trigger does nothing. Idempotent.

CREATE OR REPLACE FUNCTION public.users_rls_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT row_security_active('public.users') OR NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  IF OLD.id = public.get_auth_user_id() OR NOT public.can_bypass_rls() THEN
    RAISE EXCEPTION 'A user''s role cannot change here' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_rls_role_guard ON public."users";
CREATE TRIGGER users_rls_role_guard
BEFORE UPDATE OF role ON public."users"
FOR EACH ROW EXECUTE FUNCTION public.users_rls_role_guard();
