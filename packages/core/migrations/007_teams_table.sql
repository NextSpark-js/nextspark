-- Migration: 009_teams_table.sql
-- Description: Teams table with ENUMs, indexes, triggers, and RLS policies
-- Date: 2025-11-26
-- Updated: 2025-12-01 - Removed team type (simplified architecture)

-- ============================================
-- ENUM TYPES (must be defined first)
-- ============================================

-- Team member roles are stored as TEXT (NOT a Postgres ENUM).
--
-- WHY: themes extend team roles via config (app.config.availableTeamRoles /
-- permissions.config.ts). A Postgres ENUM would force every theme to patch the
-- type with `ALTER TYPE team_role ADD VALUE ...`. Using TEXT lets a theme store
-- any role string without DB DDL. No privilege boundary is lost: RLS policies
-- compare against explicit literals ('owner','admin') and an unknown role fails
-- closed (matches no elevated tier). Value integrity is enforced at the app
-- layer (zod derived from availableTeamRoles + the permissions registry), so no
-- CHECK constraint is added (a CHECK with the base set would block theme roles).

-- Invitation status lifecycle
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- TEAMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public."teams" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  "ownerId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE RESTRICT,
  "avatarUrl" TEXT,
  "isGlobal" BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT name_length CHECK (length(name) >= 2 AND length(name) <= 100)
);

COMMENT ON COLUMN public."teams".metadata IS 'Business-specific attributes (segment, flags, custom fields)';

-- ============================================
-- TEAMS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_teams_owner ON public."teams"("ownerId");
CREATE INDEX IF NOT EXISTS idx_teams_slug ON public."teams"(slug);
CREATE INDEX IF NOT EXISTS idx_teams_created ON public."teams"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_teams_metadata ON public."teams" USING GIN (metadata);
-- Unique partial index: enforces only one global team can exist (single-tenant mode)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_is_global ON public."teams" ("isGlobal") WHERE "isGlobal" = TRUE;

-- ============================================
-- TEAMS TRIGGERS
-- ============================================

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS teams_set_updated_at ON public."teams";
CREATE TRIGGER teams_set_updated_at
BEFORE UPDATE ON public."teams"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TEAMS ROW LEVEL SECURITY (RLS)
-- NOTE: RLS policies moved to 012_teams_functions_triggers.sql
-- because they reference team_members table (created in 010)
-- ============================================

ALTER TABLE public."teams" ENABLE ROW LEVEL SECURITY;
