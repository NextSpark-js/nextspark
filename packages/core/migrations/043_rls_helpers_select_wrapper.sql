-- Migration: 043_rls_helpers_select_wrapper.sql
-- Description: Policies call the RLS helpers as (SELECT public.helper()) so Postgres evaluates them once per statement (#323).
--
-- A policy that calls get_user_team_ids(), is_superadmin(), can_bypass_rls() or get_auth_user_id() directly can have
-- the call re-evaluated for every row it checks. Wrapped as (SELECT public.helper()), the call has no reference to the
-- row, so the planner runs it once per statement (an InitPlan) and reuses the result. The helpers are STABLE and read
-- only per-transaction state (app.user_id and the user's rows), so the result is the same either way: nothing about
-- who can read or write what changes.
--
-- This rewrites, in place, every policy of the public schema whose USING or WITH CHECK still has an unwrapped
-- zero-argument call: core's tables, the entity tables a project created from the earlier templates, and a project's
-- own policies alike. It keeps each policy's name, command and roles (ALTER POLICY), changes only the expression, and
-- leaves function bodies, triggers and the one-argument calls get_user_team_ids(get_auth_user_id()) as they are (those
-- already run inside a sub-select). Tables that do not exist in a project are simply not visited.
--
-- A policy the rewrite cannot or should not touch is left exactly as it was, with a warning naming it: one whose
-- expression has a quoted string that contains a helper call (the text would change meaning), or whose rewritten
-- expression Postgres rejects. That is safe, only slower; wrap those by hand.
--
-- Locks: ALTER POLICY takes an ACCESS EXCLUSIVE lock on each table it touches, and the migration keeps every lock it has
-- taken until its transaction ends, while it waits for the next table. It only edits the catalog, so it takes
-- milliseconds on a quiet database; behind a long-running transaction on one of the tables, reads of the tables it
-- already holds queue until that transaction ends, and a transaction that touches those tables in another order can
-- deadlock with it. Run it in a quiet window, or SET lock_timeout = '5s' first: on a timeout the migration fails as a
-- whole and nothing changes, and it is safe to retry.
-- Idempotent: a second run finds no unwrapped call and alters nothing.

DO $$
DECLARE
  -- an unwrapped zero-argument call: not already after SELECT, not schema-qualified, not the argument of
  -- get_user_team_ids( (that form is already inside a sub-select)
  helper_call constant text := '(?<!SELECT )(?<![.\w])(?<!get_user_team_ids\()\m(get_user_team_ids|is_superadmin|can_bypass_rls|get_auth_user_id)\(\)';
  -- = ANY / <> ALL (get_user_team_ids()): ANY ((SELECT ...)) would read the sub-select as a set of rows, so the array is cast
  any_call constant text := '(ANY|ALL) \(get_user_team_ids\(\)\)';
  -- a quoted string ('' inside is an escaped quote) with a helper call inside is data, not a call
  quoted constant text := '(''(?:[^'']|'''')*'')';
  helper_name constant text := '(get_user_team_ids|is_superadmin|can_bypass_rls|get_auth_user_id)\(\)';
  p record;
  new_using text;
  new_check text;
BEGIN
  -- pg_policies prints names unqualified when public is on the search_path; the rewrite below relies on that
  PERFORM set_config('search_path', 'public, pg_catalog', true);

  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ helper_call
  LOOP
    IF EXISTS (
      SELECT 1 FROM regexp_matches(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''), quoted, 'g') AS m
      WHERE m[1] ~ helper_name
    ) THEN
      RAISE WARNING '% on % left unchanged: a string literal contains a helper call', p.policyname, p.tablename;
      CONTINUE;
    END IF;

    BEGIN
      new_using := CASE WHEN p.qual IS NULL THEN NULL
                   ELSE regexp_replace(regexp_replace(p.qual, any_call, '\1 ((SELECT public.get_user_team_ids())::text[])', 'g'),
                                       helper_call, '(SELECT public.\1())', 'g') END;
      new_check := CASE WHEN p.with_check IS NULL THEN NULL
                   ELSE regexp_replace(regexp_replace(p.with_check, any_call, '\1 ((SELECT public.get_user_team_ids())::text[])', 'g'),
                                       helper_call, '(SELECT public.\1())', 'g') END;

      EXECUTE format(
        'ALTER POLICY %I ON %I.%I%s%s',
        p.policyname, p.schemaname, p.tablename,
        CASE WHEN new_using IS NULL THEN '' ELSE format(' USING (%s)', new_using) END,
        CASE WHEN new_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', new_check) END
      );
    EXCEPTION WHEN others THEN
      RAISE WARNING '% on % left unchanged: %', p.policyname, p.tablename, SQLERRM;
    END;
  END LOOP;
END
$$;
