-- ============================================================================
-- Custom Team Roles Migration
-- ============================================================================
-- This migration adds custom team roles defined in your theme's app.config.ts
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- The migration runner handles this automatically.
--
-- When adding new custom roles:
-- 1. Add the role to teamRoles.additionalTeamRoles in app.config.ts
-- 2. Add translations in messages/{locale}.json under "teams.roles.{role}"
-- 3. Add the ALTER TYPE statement below
--
-- @see core/docs/06-authentication/09-extensible-roles.md
-- ============================================================================

-- Add 'editor' role to team_role ENUM
-- Position: after 'member' (hierarchy: member=10, editor=25, admin=50)
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'editor' AFTER 'member';

-- ============================================================================
-- To add more custom roles, add more ALTER TYPE statements:
-- ============================================================================
-- ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'moderator' AFTER 'editor';
-- ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'guest' BEFORE 'viewer';
