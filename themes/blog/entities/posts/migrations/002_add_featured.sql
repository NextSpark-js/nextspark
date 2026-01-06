-- ============================================================================
-- Posts Migration: Add Featured Column
-- Blog theme: Allows marking posts as featured for homepage display
-- ============================================================================

-- Add featured column
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- Create index for featured posts queries
CREATE INDEX IF NOT EXISTS "posts_featured_idx" ON "posts" ("featured") WHERE "featured" = true;

-- Create composite index for featured + published posts
CREATE INDEX IF NOT EXISTS "posts_featured_published_idx" ON "posts" ("featured", "status", "publishedAt" DESC)
  WHERE "featured" = true AND "status" = 'published';

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON COLUMN "posts"."featured" IS 'Whether this post should be featured on the homepage';
