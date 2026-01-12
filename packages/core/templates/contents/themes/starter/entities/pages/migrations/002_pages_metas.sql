-- Migration: 002_pages_metas.sql
-- Description: Create pages_metas table for flexible key-value metadata storage
-- Date: 2025-01-25

-- Create pages_metas table
CREATE TABLE IF NOT EXISTS "pages_metas" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pageId" UUID NOT NULL REFERENCES public."pages"(id) ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  "isSearchable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pages_metas_unique_key UNIQUE ("pageId", "metaKey")
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_pages_metas_page_id ON "pages_metas"("pageId");
CREATE INDEX IF NOT EXISTS idx_pages_metas_key ON "pages_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_pages_metas_composite ON "pages_metas"("pageId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_pages_metas_searchable ON "pages_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_pages_metas_public ON "pages_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_pages_metas_value_gin ON "pages_metas" USING GIN ("metaValue");

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS pages_metas_set_updated_at ON "pages_metas";
CREATE TRIGGER pages_metas_set_updated_at
BEFORE UPDATE ON "pages_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE "pages_metas" ENABLE ROW LEVEL SECURITY;

-- Public can read public metadata
DROP POLICY IF EXISTS "pages_metas_public_select" ON "pages_metas";
CREATE POLICY "pages_metas_public_select"
ON "pages_metas" FOR SELECT TO anon
USING ("isPublic" = TRUE);

-- Authenticated users can manage all metadata
DROP POLICY IF EXISTS "pages_metas_auth_all" ON "pages_metas";
CREATE POLICY "pages_metas_auth_all"
ON "pages_metas" FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE "pages_metas" IS 'Flexible key-value metadata storage for pages';
COMMENT ON COLUMN "pages_metas"."pageId" IS 'Reference to the parent page';
COMMENT ON COLUMN "pages_metas"."metaKey" IS 'Unique key identifier for the metadata';
COMMENT ON COLUMN "pages_metas"."metaValue" IS 'JSONB value for flexible data storage';
COMMENT ON COLUMN "pages_metas"."isPublic" IS 'If true, this metadata can be read by anyone';
