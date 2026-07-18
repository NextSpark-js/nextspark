-- Migration: 024_teams_soft_delete.sql
-- Description: Add `deletedAt` column to teams for soft-delete support.
-- Date: 2026-07-18
--
-- Why this is needed:
--   Commit 11f62e17 ("enhance team retrieval logic to exclude soft-deleted
--   teams") added `t."deletedAt" IS NULL` predicates to TeamService.switchActive
--   (team.service.ts) and GET /api/v1/teams (templates/app/api/v1/teams/route.ts),
--   on the assumption that a soft-delete marker already existed on `teams`. It
--   never did — 007_teams_table.sql's CREATE TABLE has no such column, and no
--   migration since has added one. Both call sites throw a real Postgres
--   "column deletedAt does not exist" error against a database built purely
--   from this package's own migrations.
--
--   A team is never hard-deleted (TeamService.delete() does perform a real
--   DELETE today, but a consuming app implementing its own "delete team"
--   feature is expected to soft-delete instead, to preserve history) — this
--   column is what the two call sites above already assume is available.
--
--   100% additive: NULL = active team (unchanged prior behavior for every
--   existing row).

ALTER TABLE public."teams"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

COMMENT ON COLUMN public."teams"."deletedAt"
  IS 'Soft-delete marker. NULL = team active. NOT NULL = team soft-deleted; '
     'the row is preserved for historical/audit purposes. '
     'TeamService.switchActive() and GET /api/v1/teams exclude non-NULL rows '
     'from active-team resolution.';

-- Partial index for active-team lookups (deletedAt IS NULL) — keeps the two
-- call sites above fast without a sequential scan as `teams` grows.
CREATE INDEX IF NOT EXISTS idx_teams_active
  ON public."teams" (id)
  WHERE "deletedAt" IS NULL;
