-- Migration: 006_posts_metas.sql
-- Description: Create posts_metas table for flexible key-value metadata storage
-- Date: 2025-12-17

-- Create posts_metas table
CREATE TABLE IF NOT EXISTS "posts_metas" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "postId" UUID NOT NULL REFERENCES public."posts"(id) ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  "isSearchable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_metas_unique_key UNIQUE ("postId", "metaKey")
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_posts_metas_post_id ON "posts_metas"("postId");
CREATE INDEX IF NOT EXISTS idx_posts_metas_key ON "posts_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_posts_metas_composite ON "posts_metas"("postId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_posts_metas_searchable ON "posts_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_posts_metas_public ON "posts_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_posts_metas_value_gin ON "posts_metas" USING GIN ("metaValue");

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS posts_metas_set_updated_at ON "posts_metas";
CREATE TRIGGER posts_metas_set_updated_at
BEFORE UPDATE ON "posts_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE "posts_metas" ENABLE ROW LEVEL SECURITY;

-- Public can read public metadata
DROP POLICY IF EXISTS "posts_metas_public_select" ON "posts_metas";
CREATE POLICY "posts_metas_public_select"
ON "posts_metas" FOR SELECT TO anon
USING ("isPublic" = TRUE);

-- Authenticated users can manage all metadata
DROP POLICY IF EXISTS "posts_metas_auth_all" ON "posts_metas";
CREATE POLICY "posts_metas_auth_all"
ON "posts_metas" FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE "posts_metas" IS 'Flexible key-value metadata storage for posts';
COMMENT ON COLUMN "posts_metas"."postId" IS 'Reference to the parent post';
COMMENT ON COLUMN "posts_metas"."metaKey" IS 'Unique key identifier for the metadata';
COMMENT ON COLUMN "posts_metas"."metaValue" IS 'JSONB value for flexible data storage';
COMMENT ON COLUMN "posts_metas"."isPublic" IS 'If true, this metadata can be read by anyone';
