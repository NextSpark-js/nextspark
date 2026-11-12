-- Migration: 005_social_accounts_policies.sql
-- Plugin: social-media-publisher
--
-- The policies of "social_accounts" (001) read app.current_user_id, a setting the app never sets (core sets
-- app.user_id, which get_auth_user_id reads). On the nextspark_app runtime role they matched no row, so the
-- plugin's routes found no account. A social account belongs to the user who connected it: its owner reads and
-- changes it, a superadmin (or developer) bypasses, as in core's policies.
--
-- Idempotent: every statement can run again without changing what the first run did.

DROP POLICY IF EXISTS "social_accounts_select_own" ON public."social_accounts";
DROP POLICY IF EXISTS "social_accounts_insert_own" ON public."social_accounts";
DROP POLICY IF EXISTS "social_accounts_update_own" ON public."social_accounts";
DROP POLICY IF EXISTS "social_accounts_delete_own" ON public."social_accounts";

ALTER TABLE public."social_accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_select_own"
  ON public."social_accounts"
  FOR SELECT TO authenticated
  USING ((SELECT public.is_superadmin()) OR "userId" = (SELECT public.get_auth_user_id()));

CREATE POLICY "social_accounts_insert_own"
  ON public."social_accounts"
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_superadmin()) OR "userId" = (SELECT public.get_auth_user_id()));

CREATE POLICY "social_accounts_update_own"
  ON public."social_accounts"
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_superadmin()) OR "userId" = (SELECT public.get_auth_user_id()))
  WITH CHECK ((SELECT public.is_superadmin()) OR "userId" = (SELECT public.get_auth_user_id()));

CREATE POLICY "social_accounts_delete_own"
  ON public."social_accounts"
  FOR DELETE TO authenticated
  USING ((SELECT public.is_superadmin()) OR "userId" = (SELECT public.get_auth_user_id()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextspark_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_accounts" TO nextspark_app;
  END IF;
END $$;
