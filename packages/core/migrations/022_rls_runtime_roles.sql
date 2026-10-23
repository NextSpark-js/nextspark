-- ============================================================================
-- 022 · RLS runtime roles — nextspark_app (non-owner runtime role) + grants
-- ============================================================================
-- Generic framework migration: creates the non-owner runtime role the app
-- connects as so RLS is actually evaluated on the app path.
--
-- WHY: by default the app connects to Postgres as the table OWNER, so RLS
-- policies are never evaluated on the app path (owner skips RLS unless FORCE).
-- This migration creates the non-owner runtime role the app connects as after
-- the runtime cutover. Until the cutover nothing changes for the running app:
-- migrations and seeds keep running as the owner.
--
-- Design decisions:
-- - nextspark_app is NOLOGIN here; the LOGIN credential is created per environment
--   at cutover time (deploy-time secret), never in a migration.
-- - nextspark_app is a member of `authenticated` (INHERIT): every existing policy
--   declared `TO authenticated` applies to it without rewriting.
-- - NO `FORCE ROW LEVEL SECURITY`: nextspark_app is not the owner so plain ENABLE
--   is enough, and FORCE would break owner-run seeds/sample-data on Supabase
--   (where `postgres` is owner but not superuser).
-- - NO `BYPASSRLS` role here: that attribute requires superuser (not available
--   on Supabase). The service context for machine actors (webhooks, scheduled
--   actions) is a CORE/environment workstream: the app uses a separate service
--   connection (DATABASE_SERVICE_URL) for system operations.
-- - `anon` gets an explicit REVOKE + default privileges revoke: on Supabase the
--   default privileges grant to anon automatically; abstaining is not enough.
--
-- Ordering: runs after all core table DDL (<= 021) so `GRANT ... ON ALL TABLES`
-- covers every existing table; `ALTER DEFAULT PRIVILEGES` covers tables created
-- later (theme/entity migrations) by the same migration owner.

-- ----------------------------------------------------------------------------
-- 1. Runtime role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextspark_app') THEN
    CREATE ROLE nextspark_app NOLOGIN NOINHERIT;
  END IF;
END $$;

-- INHERIT membership in `authenticated` so policies `TO authenticated` apply.
-- Changing a role you did not create, or granting a role you have no ADMIN OPTION on,
-- needs CREATEROLE (or superuser). On a shared cluster or a managed host where
-- nextspark_app already exists, the migration role may have neither: the migration
-- then goes on with a WARNING instead of aborting. Only insufficient_privilege is
-- caught; any other error still stops the migration.
DO $$
BEGIN
  ALTER ROLE nextspark_app INHERIT;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Role setup: could not run ALTER ROLE nextspark_app INHERIT (%). Ask a superuser to run it if nextspark_app is not already INHERIT.', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT pg_has_role('nextspark_app', 'authenticated', 'MEMBER') THEN
    GRANT authenticated TO nextspark_app;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Role setup: could not run GRANT authenticated TO nextspark_app (%). Ask a superuser to run it: policies written TO authenticated do not apply to nextspark_app until it is a member.', SQLERRM;
END $$;

-- Allow the migration/validation user to SET ROLE nextspark_app (e.g. an RLS
-- isolation test suite can run its checks as this role without a LOGIN credential).
DO $$
BEGIN
  EXECUTE format('GRANT nextspark_app TO %I', current_user);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'GRANT nextspark_app TO current_user skipped: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Grants for nextspark_app (RLS does the row filtering; grants gate the tables)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO nextspark_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextspark_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nextspark_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nextspark_app;

-- Future objects created by the migration owner inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nextspark_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nextspark_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nextspark_app;

-- ----------------------------------------------------------------------------
-- 3. anon: explicit lockdown (defense for PostgREST/Data API surfaces)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  COMMENT ON ROLE nextspark_app IS
    'Non-owner runtime role for the NextSpark app. Member of authenticated (policies TO authenticated apply). RLS is evaluated for every query once DATABASE_URL connects as this role instead of the table owner.';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Role setup: could not set the comment on role nextspark_app (%). It is only a description; nothing depends on it.', SQLERRM;
END $$;
