-- Migration: 031_users_role_suspended.sql
-- Description: users.role accepts 'suspended' (lib/auth/suspension.ts).
--
-- The superadmin "suspend" action sets users.role = 'suspended', which check_users_role (002: member, superadmin,
-- developer) refused. This adds 'suspended' to the roles the constraint already accepts and keeps every other one,
-- including roles a project added to it. Idempotent: a constraint that already accepts 'suspended' is left alone. A
-- constraint that is not a plain list of roles is left alone too, with a notice (add 'suspended' to it yourself).

DO $$
DECLARE
  def   TEXT;
  roles TEXT[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.users'::regclass AND c.conname = 'check_users_role';

  IF def IS NULL THEN
    ALTER TABLE public."users" ADD CONSTRAINT check_users_role
      CHECK ("role" IN ('member', 'superadmin', 'developer', 'suspended'));
    RETURN;
  END IF;

  IF def ~ '\msuspended\M' THEN
    RETURN;
  END IF;

  -- "role" IN (...) is stored as: CHECK ((role = ANY (ARRAY['member'::text, ...])))
  IF def !~ '^CHECK \(\(+"?role"?\)?(::text)? = ANY \(\(?ARRAY\[' THEN
    RAISE NOTICE 'check_users_role is not a plain list of roles (%); add ''suspended'' to it to use the suspend action', def;
    RETURN;
  END IF;

  SELECT array_agg(m[1]) INTO roles FROM regexp_matches(def, '''([^'']+)''', 'g') AS m;

  ALTER TABLE public."users" DROP CONSTRAINT check_users_role;
  EXECUTE format(
    'ALTER TABLE public."users" ADD CONSTRAINT check_users_role CHECK ("role" IN (%s))',
    (SELECT string_agg(quote_literal(r), ', ') FROM unnest(array_append(roles, 'suspended')) AS r)
  );
END $$;
