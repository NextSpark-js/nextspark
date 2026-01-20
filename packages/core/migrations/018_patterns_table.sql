-- Migration: 018_patterns_table.sql
-- Description: Patterns table for reusable block compositions
-- Date: 2025-01-15

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."patterns" CASCADE;

CREATE TABLE IF NOT EXISTS public."patterns" (
  -- Primary Key (TEXT not UUID!)
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys (team-scoped entity)
  "userId"            TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"            TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Business Fields
  title               VARCHAR(200) NOT NULL,
  slug                VARCHAR(100) NOT NULL,
  blocks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft',
  description         TEXT,

  -- System fields (always last)
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT patterns_unique_slug_team UNIQUE("teamId", slug),
  CONSTRAINT patterns_valid_slug CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT patterns_slug_length CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 100),
  CONSTRAINT patterns_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT patterns_valid_status CHECK (status IN ('draft', 'published'))
);

-- Comments
COMMENT ON TABLE  public."patterns"                 IS 'Reusable block compositions for page builder';
COMMENT ON COLUMN public."patterns"."userId"        IS 'User who created the pattern';
COMMENT ON COLUMN public."patterns"."teamId"        IS 'Team that owns the pattern';
COMMENT ON COLUMN public."patterns".title           IS 'Pattern display name';
COMMENT ON COLUMN public."patterns".slug            IS 'URL-friendly identifier, unique per team';
COMMENT ON COLUMN public."patterns".blocks          IS 'Array of BlockInstance with props (JSONB)';
COMMENT ON COLUMN public."patterns".status          IS 'Publication status: draft or published';
COMMENT ON COLUMN public."patterns".description     IS 'Brief description of pattern purpose';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS patterns_set_updated_at ON public."patterns";
CREATE TRIGGER patterns_set_updated_at
BEFORE UPDATE ON public."patterns"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_patterns_user_id
  ON public."patterns"("userId");

CREATE INDEX IF NOT EXISTS idx_patterns_team_id
  ON public."patterns"("teamId");

CREATE INDEX IF NOT EXISTS idx_patterns_slug
  ON public."patterns"(slug);

CREATE INDEX IF NOT EXISTS idx_patterns_status
  ON public."patterns"(status);

CREATE INDEX IF NOT EXISTS idx_patterns_created
  ON public."patterns"("createdAt" DESC);

-- Compound index for team + slug lookups
CREATE INDEX IF NOT EXISTS idx_patterns_team_slug
  ON public."patterns"("teamId", slug);

-- GIN index for JSONB blocks column (for querying block structure)
CREATE INDEX IF NOT EXISTS idx_patterns_blocks_gin
  ON public."patterns" USING GIN (blocks);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."patterns" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "patterns team can do all" ON public."patterns";

-- Team isolation policy (shared: true - all team members see same patterns)
-- Any authenticated user who is a member of the team can read/write patterns
CREATE POLICY "patterns team can do all"
ON public."patterns"
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
