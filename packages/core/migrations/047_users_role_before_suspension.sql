-- Migration: 047_users_role_before_suspension.sql
-- Description: users."roleBeforeSuspension" keeps the role a suspended user had, so unsuspending gives it back (#486).
--
-- suspendUser sets users.role = 'suspended' and unsuspendUser used to answer 'member' whatever the user was, so a
-- suspended superadmin or developer came back demoted. suspendUser now writes the role it replaces into this column in
-- the same statement, and unsuspendUser restores COALESCE("roleBeforeSuspension", 'member') and clears it. A user
-- suspended before this migration has no stored role and comes back as 'member', as before.
--
-- The column never grants a role by itself:
-- - it is NULL for every user who is not suspended, and a CHECK refuses 'suspended' in it;
-- - 037's guard covers it as it covers role: on the RLS-enforced connection (nextspark_app) it changes only for
--   can_bypass_rls(), and never on the caller's own row ("Users self update" is not per column). A member cannot
--   write it into their own row and be restored to a role they never had: suspendUser overwrites it anyway;
-- - core's routes write it on the service connection, where the guard does nothing, and unsuspend checks
--   canActOnUser against the role it restores.
-- Idempotent.

ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "roleBeforeSuspension" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'check_users_role_before_suspension'
  ) THEN
    ALTER TABLE public."users" ADD CONSTRAINT check_users_role_before_suspension
      CHECK ("roleBeforeSuspension" IS NULL OR "roleBeforeSuspension" <> 'suspended');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.users_rls_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT row_security_active('public.users')
     OR (NEW.role IS NOT DISTINCT FROM OLD.role AND NEW."roleBeforeSuspension" IS NOT DISTINCT FROM OLD."roleBeforeSuspension") THEN
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
BEFORE UPDATE OF role, "roleBeforeSuspension" ON public."users"
FOR EACH ROW EXECUTE FUNCTION public.users_rls_role_guard();
