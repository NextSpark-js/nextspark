-- Migration: 004_pages_slug_check.sql
-- Description: The slug CHECK follows `access.allowNestedSlugs` of the pages entity (#332)
--   true  -> segments of lowercase letters, digits and hyphens joined by single `/`: `a`, `a/b`, `a/b/c`
--   false -> one segment, as before: `a`
-- The runner (db:migrate) sets nextspark.pages_allow_nested_slugs to 'on' or 'off' from the entity config.
-- Run by hand without it, the single-segment rule is applied. After changing the option, run the DO block below
-- again (with the setting) or replace the constraint yourself: a migration runs once.
-- The constraint is added NOT VALID: new and updated rows are checked, rows already stored never make the
-- migration fail (a table whose constraint was edited by hand may hold slugs the new rule refuses).

DO $$
BEGIN
  IF to_regclass('public.pages') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS valid_slug;

  IF current_setting('nextspark.pages_allow_nested_slugs', true) = 'on' THEN
    ALTER TABLE public.pages
      ADD CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+(/[a-z0-9-]+)*$') NOT VALID;
  ELSE
    ALTER TABLE public.pages
      ADD CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$') NOT VALID;
  END IF;
END $$;
