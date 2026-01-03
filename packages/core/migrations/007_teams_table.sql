-- Migration: 009_teams_table.sql
-- Description: Teams table with ENUMs, indexes, triggers, and RLS policies
-- Date: 2025-11-26
-- Updated: 2025-12-01 - Removed team type (simplified architecture)

-- ============================================
-- ENUM TYPES (must be defined first)
-- ============================================

-- Team member roles: owner (creator), admin, member, viewer
DO $$ BEGIN
  CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
