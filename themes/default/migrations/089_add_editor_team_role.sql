-- Migration: 089_add_editor_team_role.sql
-- Description: Add 'editor' role to team_role ENUM
-- Date: 2025-12-24
-- Theme: default
-- Phase: Theme extension - demonstrates extensible team roles system
--
-- This migration adds the 'editor' team role as an example of the extensible
-- team roles system. The role is added to the PostgreSQL ENUM type.
--
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL.
-- The migration runner handles this automatically.

-- Add 'editor' value to team_role ENUM
-- Inserted after 'member' in the hierarchy order
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'editor';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Migration 089_add_editor_team_role.sql completed!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  ✅ Added "editor" to team_role ENUM';
  RAISE NOTICE '';
  RAISE NOTICE '  Team role hierarchy (config-driven):';
  RAISE NOTICE '     owner: 100 (protected)';
  RAISE NOTICE '     admin: 50';
  RAISE NOTICE '     member: 10';
  RAISE NOTICE '     editor: 5 (NEW)';
  RAISE NOTICE '     viewer: 1';
  RAISE NOTICE '';
  RAISE NOTICE '  Editor permissions (defined in app.config.ts):';
  RAISE NOTICE '     - team.view';
  RAISE NOTICE '     - team.members.view';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
