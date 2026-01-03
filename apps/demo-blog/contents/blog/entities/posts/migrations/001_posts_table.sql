-- ============================================================================
-- Posts Table Migration
-- Blog theme: Personal blog posts
-- ============================================================================

-- Create posts table
CREATE TABLE IF NOT EXISTS "posts" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255) NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "featuredImage" VARCHAR(500),
  "category" VARCHAR(100),
  "tags" JSONB DEFAULT '[]'::jsonb,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published', 'scheduled')),
  "publishedAt" TIMESTAMPTZ,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index for slug per user
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_userId_idx" ON "posts" ("slug", "userId");

-- Index for team isolation queries
CREATE INDEX IF NOT EXISTS "posts_teamId_idx" ON "posts" ("teamId");

-- Index for user queries
CREATE INDEX IF NOT EXISTS "posts_userId_idx" ON "posts" ("userId");

-- Index for public listing (published posts)
CREATE INDEX IF NOT EXISTS "posts_status_publishedAt_idx" ON "posts" ("status", "publishedAt" DESC) 
  WHERE "status" = 'published';

-- Index for category filtering
CREATE INDEX IF NOT EXISTS "posts_category_idx" ON "posts" ("category");

-- Enable RLS
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "posts_select_policy" ON "posts";
DROP POLICY IF EXISTS "posts_insert_policy" ON "posts";
DROP POLICY IF EXISTS "posts_update_policy" ON "posts";
DROP POLICY IF EXISTS "posts_delete_policy" ON "posts";
DROP POLICY IF EXISTS "posts_public_select_policy" ON "posts";

-- Policy: Users can select their own posts (or superadmin can see all)
CREATE POLICY "posts_select_policy" ON "posts"
  FOR SELECT TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Public can see published posts (anonymous access)
CREATE POLICY "posts_public_select_policy" ON "posts"
  FOR SELECT TO anon
  USING (
    "status" = 'published'
    AND "publishedAt" <= NOW()
  );

-- Policy: Users can insert their own posts
CREATE POLICY "posts_insert_policy" ON "posts"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Users can update their own posts (or superadmin)
CREATE POLICY "posts_update_policy" ON "posts"
  FOR UPDATE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Users can delete their own posts (or superadmin)
CREATE POLICY "posts_delete_policy" ON "posts"
  FOR DELETE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Trigger for auto-updating updatedAt
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at_trigger ON "posts";
CREATE TRIGGER posts_updated_at_trigger
  BEFORE UPDATE ON "posts"
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE "posts" IS 'Blog posts for personal blog theme';
COMMENT ON COLUMN "posts"."slug" IS 'URL-friendly identifier, unique per user';
COMMENT ON COLUMN "posts"."status" IS 'draft, published, or scheduled';
COMMENT ON COLUMN "posts"."tags" IS 'JSON array of tag strings';
