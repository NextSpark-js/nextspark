-- Migration: 019_pattern_usages_table.sql
-- Description: Pattern usages tracking table for usage reports
-- Date: 2025-01-16

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."pattern_usages" CASCADE;

CREATE TABLE IF NOT EXISTS public."pattern_usages" (
  -- Primary Key (TEXT not UUID!)
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "patternId"         TEXT NOT NULL REFERENCES public."patterns"(id) ON DELETE CASCADE,
  "teamId"            TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Business Fields
  "entityType"        VARCHAR(50) NOT NULL,  -- 'pages', 'posts', etc.
  "entityId"          TEXT NOT NULL,

  -- System fields (always last)
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT pattern_usages_unique UNIQUE("patternId", "entityType", "entityId")
);

-- Comments
COMMENT ON TABLE  public."pattern_usages"                 IS 'Tracks which entities use each pattern';
COMMENT ON COLUMN public."pattern_usages"."patternId"     IS 'Pattern being referenced';
COMMENT ON COLUMN public."pattern_usages"."teamId"        IS 'Team that owns the usage record';
COMMENT ON COLUMN public."pattern_usages"."entityType"    IS 'Type of entity using the pattern (pages, posts, etc.)';
COMMENT ON COLUMN public."pattern_usages"."entityId"      IS 'ID of the entity using the pattern';

-- ============================================
-- INDEXES
-- ============================================
-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_pattern_usages_pattern_id
  ON public."pattern_usages"("patternId");

CREATE INDEX IF NOT EXISTS idx_pattern_usages_entity
  ON public."pattern_usages"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS idx_pattern_usages_team_id
  ON public."pattern_usages"("teamId");

-- Compound index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pattern_usages_pattern_entity
  ON public."pattern_usages"("patternId", "entityType");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."pattern_usages" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "pattern_usages team can do all" ON public."pattern_usages";

-- Team isolation policy (same as patterns)
CREATE POLICY "pattern_usages team can do all"
ON public."pattern_usages"
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);
