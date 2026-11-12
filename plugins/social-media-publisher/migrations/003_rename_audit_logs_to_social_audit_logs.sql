-- Migration: 003_rename_audit_logs_to_social_audit_logs.sql
-- Plugin: social-media-publisher
--
-- A plugin's tables are named `<prefix>_<table>`, the prefix being the first segment of the plugin's name
-- ("social" here), so they cannot collide with a project's tables or another plugin's. The audit log table was
-- created as "audit_logs" (001); this renames it, with its indexes, constraints and policies, to
-- "social_audit_logs". Rows, grants and the foreign key come along with the table.
--
-- Idempotent: it renames only when "audit_logs" exists with this plugin's columns and "social_audit_logs" does not,
-- and each object only while it still has its old name. On a new database 001 creates "audit_logs" and this
-- renames it right away.

DO $$
DECLARE
  old_name TEXT;
  new_name TEXT;
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL AND to_regclass('public.social_audit_logs') IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name IN ('accountId', 'ipAddress', 'userAgent')
      GROUP BY table_name HAVING count(*) = 3
    ) THEN
      RAISE NOTICE 'social-media-publisher: "audit_logs" is not this plugin''s table (it lacks accountId, ipAddress or userAgent); it is left as it is';
      RETURN;
    END IF;
    ALTER TABLE public."audit_logs" RENAME TO "social_audit_logs";
  ELSIF to_regclass('public.audit_logs') IS NOT NULL THEN
    RAISE NOTICE 'social-media-publisher: both "audit_logs" and "social_audit_logs" exist; "audit_logs" is left as it is';
  END IF;

  IF to_regclass('public.social_audit_logs') IS NULL THEN
    RETURN;
  END IF;

  -- Indexes (001), the primary key's included
  FOREACH old_name IN ARRAY ARRAY[
    'audit_logs_pkey',
    'idx_audit_logs_user_created',
    'idx_audit_logs_account_action',
    'idx_audit_logs_action_created',
    'idx_audit_logs_created_desc'
  ] LOOP
    new_name := replace(old_name, 'audit_logs', 'social_audit_logs');
    IF to_regclass('public.' || quote_ident(new_name)) IS NULL
       AND EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.' || quote_ident(old_name))
                   AND indrelid = 'public.social_audit_logs'::regclass) THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', old_name, new_name);
    END IF;
  END LOOP;

  -- Constraints other than the primary key (renamed with its index above): the CHECK on action (002) and the
  -- foreign key to users (001)
  FOR old_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.social_audit_logs'::regclass AND contype <> 'p' AND conname LIKE 'audit\_logs\_%'
  LOOP
    EXECUTE format('ALTER TABLE public."social_audit_logs" RENAME CONSTRAINT %I TO %I',
      old_name, replace(old_name, 'audit_logs', 'social_audit_logs'));
  END LOOP;

  -- Policies (001)
  FOR old_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_audit_logs' AND policyname LIKE 'audit\_logs\_%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public."social_audit_logs" RENAME TO %I',
      old_name, replace(old_name, 'audit_logs', 'social_audit_logs'));
  END LOOP;

  -- The runtime role keeps the grants it had on the table; a database that never had it (a project before core's
  -- runtime roles) gets nothing to grant.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextspark_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_audit_logs" TO nextspark_app;
  END IF;

  COMMENT ON TABLE public."social_audit_logs" IS
    'Immutable audit trail for all social media actions (security & compliance)';
END $$;
