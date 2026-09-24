-- Migration: 089_add_editor_team_role.sql
-- Description: (No-op) 'editor' team role — now config-driven, no DDL required
-- Date: 2025-12-24
-- Theme: default
-- Phase: Theme extension - demonstrates extensible team roles system
--
-- HISTORICAL NOTE:
-- This migration used to run `ALTER TYPE team_role ADD VALUE 'editor'` because
-- team roles were a Postgres ENUM. As of core beta.167, `team_members.role` /
-- `team_invitations.role` are TEXT (see core migration 007), so themes extend
-- team roles purely via config — no DB DDL, no ENUM patching.
--
-- The 'editor' role is declared in this theme's config:
--   - app.config.ts            -> availableTeamRoles
--   - config/permissions.config.ts -> roles.additionalRoles + entity permissions
--
-- This file is kept as a no-op so the migration sequence/tracking stays stable.

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Migration 089_add_editor_team_role.sql (no-op)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  ℹ️  team_members.role is now TEXT (core 007).';
  RAISE NOTICE '  ℹ️  The "editor" role is config-driven (availableTeamRoles +';
  RAISE NOTICE '      permissions.config.ts) — no ALTER TYPE needed.';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
