-- Migration: 015_posts_table.sql
-- Description: Posts table for blog system (similar structure to pages)
-- Date: 2025-12-16
-- Updated: 2025-12-17 (Add userId, teamId system fields + team isolation RLS)

-- ============================================
-- TABLE: posts
-- ============================================
DROP TABLE IF EXISTS public.posts CASCADE;

CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relational Fields (at the beginning)
  "userId"        TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  slug            VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  excerpt         TEXT,
  "featuredImage" TEXT,
  blocks          JSONB NOT NULL DEFAULT '[]'::JSONB,
  locale          VARCHAR(10) NOT NULL DEFAULT 'en',

  -- SEO fields (same as pages)
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
  CONSTRAINT unique_post_slug_locale UNIQUE(slug, locale),
  CONSTRAINT valid_post_slug CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT valid_post_locale CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT post_slug_length CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 100),
  CONSTRAINT post_title_not_empty CHECK (LENGTH(TRIM(title)) > 0)
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE  public.posts                  IS 'Blog posts with block-based content';
COMMENT ON COLUMN public.posts."userId"         IS 'User who created this post';
COMMENT ON COLUMN public.posts."teamId"         IS 'Team context for isolation';
COMMENT ON COLUMN public.posts.blocks           IS 'Array of block instances with props (JSONB)';
COMMENT ON COLUMN public.posts.slug             IS 'URL-friendly identifier';
COMMENT ON COLUMN public.posts.excerpt          IS 'Short summary for previews and SEO';
COMMENT ON COLUMN public.posts."featuredImage"  IS 'Main image URL for post';

-- ============================================
-- TRIGGER: updatedAt
-- ============================================
DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_posts_user_id            ON public.posts("userId");
CREATE INDEX IF NOT EXISTS idx_posts_team_id            ON public.posts("teamId");
CREATE INDEX IF NOT EXISTS idx_posts_slug               ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_locale             ON public.posts(locale);
CREATE INDEX IF NOT EXISTS idx_posts_published          ON public.posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_author             ON public.posts("authorId");
CREATE INDEX IF NOT EXISTS idx_posts_created            ON public.posts("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug_locale        ON public.posts(slug, locale);
CREATE INDEX IF NOT EXISTS idx_posts_published_locale   ON public.posts(published, locale) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS idx_posts_blocks_gin         ON public.posts USING GIN (blocks);
CREATE INDEX IF NOT EXISTS idx_posts_team_created       ON public.posts("teamId", "createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts public can select" ON public.posts;
DROP POLICY IF EXISTS "posts auth can do all"   ON public.posts;
DROP POLICY IF EXISTS "Posts team can do all"   ON public.posts;

-- Public can read published posts
CREATE POLICY "posts public can select"
ON public.posts
FOR SELECT TO anon
USING (published = TRUE);

-- ============================
-- RLS: TEAM ISOLATION ONLY
-- ============================
-- IMPORTANT: RLS only verifies team membership
-- access.shared logic (user isolation) is handled at APP LEVEL
CREATE POLICY "Posts team can do all"
ON public.posts
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
