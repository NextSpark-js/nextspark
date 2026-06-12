-- Migration: 001_better_auth_and_functions.sql
-- Description: Extensiones y funciones de identidad para Better Auth
-- Date: 2025-01-19

-- =============================================================================
-- ROLES FOR RLS (Row Level Security)
-- These roles are pre-created in Supabase but not in vanilla PostgreSQL (Neon, etc.)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END
$$;

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función: obtener el user_id del contexto de app (GUC)
-- Better Auth usa TEXT para IDs, retornamos TEXT
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v TEXT;
BEGIN
  v := current_setting('app.user_id', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

-- NOTE: Previously there was an alias function `get_auth_user_id()` (without schema)
-- that called `public.get_auth_user_id()`. This was removed because PostgreSQL's
-- `CREATE OR REPLACE` with `SET search_path = public` would overwrite the real
-- function with the alias, causing infinite recursion. All RLS policies should
-- use `public.get_auth_user_id()` with the explicit schema qualifier.

-- =============================================================================
-- RLS BYPASS / VISIBILITY PRIMITIVES
-- Defined here (migration 001) so EVERY later migration's policies can use them,
-- including the auth/identity tables in 002. These are plpgsql functions, so the
-- tables they reference (users, team_members) are resolved at CALL time, not at
-- function-creation time — it is safe to define them before those tables exist.
-- They are SECURITY DEFINER so they read team_members/users without re-triggering
-- RLS (avoids recursive policy evaluation).
-- =============================================================================

-- Can the current request user bypass RLS? (superadmin always; developer if a
-- member of the System Admin Team). Mirrors app-level bypass in dual-auth.ts.
CREATE OR REPLACE FUNCTION public.can_bypass_rls()
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id TEXT;
  user_role TEXT;
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
    SELECT EXISTS(
      SELECT 1 FROM public."team_members"
      WHERE "userId" = current_user_id
        AND "teamId" = 'team-nextspark-001'
    ) INTO is_system_admin_member;

    RETURN is_system_admin_member;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Backward-compatible alias (deprecated, use can_bypass_rls).
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.can_bypass_rls();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- May the current request user SEE the row of `target_user_id`? True when they
-- share a team where either side is staff (owner/admin). Used by the `users`
-- SELECT policy (002) without a create-time dependency on team_members.
CREATE OR REPLACE FUNCTION public.auth_user_can_see_user(target_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."team_members" me
    JOIN public."team_members" them ON them."teamId" = me."teamId"
    WHERE me."userId" = public.get_auth_user_id()
      AND them."userId" = target_user_id
      AND (
        me.role   IN ('owner','admin')   -- I am staff of this team -> I see everyone in it
        OR them.role IN ('owner','admin') -- the target is staff of my team -> I see them
      )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Utilidad: updatedAt (si no existe ya en otra migration)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

-- Function to sync name field with firstName + lastName
CREATE OR REPLACE FUNCTION sync_user_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Set name as firstName + lastName, handling null values
  NEW."name" = COALESCE(
    CASE 
      WHEN NEW."firstName" IS NOT NULL AND NEW."lastName" IS NOT NULL 
      THEN NEW."firstName" || ' ' || NEW."lastName"
      WHEN NEW."firstName" IS NOT NULL 
      THEN NEW."firstName"
      WHEN NEW."lastName" IS NOT NULL 
      THEN NEW."lastName"
      ELSE ''
    END,
    ''
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;