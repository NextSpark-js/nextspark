-- Migration: 022_taxonomies_add_team_id.sql
-- Description: Add teamId to taxonomies for team-scoped tags (especially media_tag)
-- Date: 2026-02-12

-- ============================================
-- ADD teamId COLUMN
-- ============================================
ALTER TABLE public.taxonomies
  ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE;

-- ============================================
-- UPDATE UNIQUE CONSTRAINT
-- ============================================
-- Old: UNIQUE(type, slug) - global uniqueness
-- New: Two partial unique indexes to support both global and team-scoped taxonomies
--   1. Global taxonomies (teamId IS NULL): unique by (type, slug)
--   2. Team-scoped taxonomies (teamId IS NOT NULL): unique by (type, slug, teamId)

-- Drop old unique constraint
ALTER TABLE public.taxonomies
  DROP CONSTRAINT IF EXISTS unique_taxonomy_type_slug;

-- Global taxonomies: unique slug per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomies_unique_global
  ON public.taxonomies(type, slug)
  WHERE "teamId" IS NULL;

-- Team-scoped taxonomies: unique slug per type per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomies_unique_team
  ON public.taxonomies(type, slug, "teamId")
  WHERE "teamId" IS NOT NULL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_taxonomies_team_id
  ON public.taxonomies("teamId");

CREATE INDEX IF NOT EXISTS idx_taxonomies_type_team
  ON public.taxonomies(type, "teamId")
  WHERE "teamId" IS NOT NULL;

-- ============================================
-- UPDATE RLS POLICY
-- ============================================
-- Add team-scoped access: team members can see their team's taxonomies
DROP POLICY IF EXISTS "taxonomies auth can do all" ON public.taxonomies;

CREATE POLICY "taxonomies auth can do all"
ON public.taxonomies
FOR ALL TO authenticated
USING (
  "teamId" IS NULL  -- Global taxonomies visible to all authenticated
  OR "teamId" = ANY(public.get_user_team_ids())  -- Team-scoped visible to members
  OR public.is_superadmin()
)
WITH CHECK (
  "teamId" IS NULL
  OR "teamId" = ANY(public.get_user_team_ids())
  OR public.is_superadmin()
);

-- ============================================
-- MIGRATE EXISTING MEDIA TAGS
-- ============================================
-- Existing media_tag taxonomies are global (no teamId).
-- They will remain accessible but new ones will be team-scoped.
-- Teams will create their own tags going forward.
