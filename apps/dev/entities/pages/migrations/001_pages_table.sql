-- Migration: 008_pages_table.sql
-- Description: Create pages table for dynamic page builder system with blocks
-- Date: 2025-01-21
-- Updated: 2025-12-17 (Add userId, teamId system fields + team isolation RLS)

-- ============================================
-- TABLE: pages
-- ============================================
DROP TABLE IF EXISTS public.pages CASCADE;

CREATE TABLE IF NOT EXISTS public.pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relational Fields (at the beginning)
  "userId"        TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  slug            VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  blocks          JSONB NOT NULL DEFAULT '[]'::JSONB,
  locale          VARCHAR(10) NOT NULL DEFAULT 'en',

  -- SEO fields
  "seoTitle"       VARCHAR(255),
  "seoDescription" TEXT,
  "seoKeywords"    TEXT,
  "ogImage"        TEXT,
  noindex          BOOLEAN DEFAULT FALSE,
  nofollow         BOOLEAN DEFAULT FALSE,

  -- Meta fields
  published        BOOLEAN DEFAULT FALSE,
  "authorId"       TEXT REFERENCES public."users"(id) ON DELETE SET NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_slug_locale UNIQUE(slug, locale),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT valid_locale CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT slug_length CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 100),
  CONSTRAINT title_not_empty CHECK (LENGTH(TRIM(title)) > 0)
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE  public.pages                  IS 'Dynamic pages created via block editor system';
COMMENT ON COLUMN public.pages."userId"         IS 'User who created this page';
COMMENT ON COLUMN public.pages."teamId"         IS 'Team context for isolation';
COMMENT ON COLUMN public.pages.blocks           IS 'Array of block instances with props (JSONB)';
COMMENT ON COLUMN public.pages.slug             IS 'URL-friendly identifier (lowercase, hyphens only)';
COMMENT ON COLUMN public.pages.locale           IS 'Language/locale code (e.g., en, es, en-US)';

-- ============================================
-- TRIGGER: updatedAt
-- ============================================
DROP TRIGGER IF EXISTS pages_set_updated_at ON public.pages;
CREATE TRIGGER pages_set_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pages_user_id            ON public.pages("userId");
CREATE INDEX IF NOT EXISTS idx_pages_team_id            ON public.pages("teamId");
CREATE INDEX IF NOT EXISTS idx_pages_slug               ON public.pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_locale             ON public.pages(locale);
CREATE INDEX IF NOT EXISTS idx_pages_published          ON public.pages(published);
CREATE INDEX IF NOT EXISTS idx_pages_author             ON public.pages("authorId");
CREATE INDEX IF NOT EXISTS idx_pages_created            ON public.pages("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_pages_slug_locale        ON public.pages(slug, locale);
CREATE INDEX IF NOT EXISTS idx_pages_published_locale   ON public.pages(published, locale) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS idx_pages_blocks_gin         ON public.pages USING GIN (blocks);
CREATE INDEX IF NOT EXISTS idx_pages_team_created       ON public.pages("teamId", "createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pages public can select" ON public.pages;
DROP POLICY IF EXISTS "pages auth can do all"   ON public.pages;
DROP POLICY IF EXISTS "Pages team can do all"   ON public.pages;

-- Public can read published pages
CREATE POLICY "pages public can select"
ON public.pages
FOR SELECT TO anon
USING (published = TRUE);

-- ============================
-- RLS: TEAM ISOLATION ONLY
-- ============================
-- IMPORTANT: RLS only verifies team membership
-- access.shared logic (user isolation) is handled at APP LEVEL
CREATE POLICY "Pages team can do all"
ON public.pages
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation only: user must be member of the team
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);
