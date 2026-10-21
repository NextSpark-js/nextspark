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
-- Locks: ALTER POLICY takes an ACCESS EXCLUSIVE lock on each table it touches, held until the migration's transaction
-- ends. It only edits the catalog, so that is milliseconds; a long transaction already open on one of these tables
-- delays the migration until it finishes.
-- Idempotent: a second run finds no unwrapped call and alters nothing.

DO $$
DECLARE
  -- an unwrapped zero-argument call: not already after SELECT, not schema-qualified, not the argument of
  -- get_user_team_ids( (that form is already inside a sub-select)
  helper_call constant text := '(?<!SELECT )(?<![.\w])(?<!get_user_team_ids\()\m(get_user_team_ids|is_superadmin|can_bypass_rls|get_auth_user_id)\(\)';
  -- = ANY (get_user_team_ids()): ANY ((SELECT ...)) would read the sub-select as a set of rows, so the array is cast
  any_call constant text := 'ANY \(get_user_team_ids\(\)\)';
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
    new_using := CASE WHEN p.qual IS NULL THEN NULL
                 ELSE regexp_replace(regexp_replace(p.qual, any_call, 'ANY ((SELECT public.get_user_team_ids())::text[])', 'g'),
                                     helper_call, '(SELECT public.\1())', 'g') END;
    new_check := CASE WHEN p.with_check IS NULL THEN NULL
                 ELSE regexp_replace(regexp_replace(p.with_check, any_call, 'ANY ((SELECT public.get_user_team_ids())::text[])', 'g'),
                                     helper_call, '(SELECT public.\1())', 'g') END;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      p.policyname, p.schemaname, p.tablename,
      CASE WHEN new_using IS NULL THEN '' ELSE format(' USING (%s)', new_using) END,
      CASE WHEN new_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', new_check) END
    );
  END LOOP;
END
$$;
