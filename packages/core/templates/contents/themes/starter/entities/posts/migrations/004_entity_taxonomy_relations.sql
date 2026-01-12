-- Migration: 003_entity_taxonomy_relations.sql
-- Description: Generic entity-taxonomy relations table
-- Date: 2025-12-17
-- Session: builder-entities-unification-v2
-- Note: Placed in posts entity to ensure posts and pages tables exist first

-- ============================================
-- TABLE: entity_taxonomy_relations
-- Replaces specific post_taxonomy_relations with a generic system
-- ============================================
CREATE TABLE IF NOT EXISTS public."entity_taxonomy_relations" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityType" VARCHAR(50) NOT NULL,  -- 'posts', 'pages', 'products', etc.
  "entityId" TEXT NOT NULL,
  "taxonomyId" TEXT NOT NULL REFERENCES public."taxonomies"(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_entity_taxonomy UNIQUE("entityType", "entityId", "taxonomyId")
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public."entity_taxonomy_relations" IS 'Generic many-to-many relation between any entity and taxonomies';
COMMENT ON COLUMN public."entity_taxonomy_relations"."entityType" IS 'Type of entity (posts, pages, products, etc.)';
COMMENT ON COLUMN public."entity_taxonomy_relations"."entityId" IS 'ID of the entity (UUID as text)';
COMMENT ON COLUMN public."entity_taxonomy_relations"."taxonomyId" IS 'Reference to taxonomy';
COMMENT ON COLUMN public."entity_taxonomy_relations"."order" IS 'Display order of taxonomy within entity';

-- ============================================
-- INDEXES for common queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_etr_entity_type ON public."entity_taxonomy_relations"("entityType");
CREATE INDEX IF NOT EXISTS idx_etr_entity_id ON public."entity_taxonomy_relations"("entityId");
CREATE INDEX IF NOT EXISTS idx_etr_taxonomy_id ON public."entity_taxonomy_relations"("taxonomyId");
CREATE INDEX IF NOT EXISTS idx_etr_entity_lookup ON public."entity_taxonomy_relations"("entityType", "entityId");

-- ============================================
-- MIGRATE existing data from post_taxonomy_relations (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_taxonomy_relations' AND table_schema = 'public') THEN
    INSERT INTO public."entity_taxonomy_relations" ("entityType", "entityId", "taxonomyId", "order", "createdAt")
    SELECT
      'posts' as "entityType",
      "postId"::text as "entityId",
      "taxonomyId",
      "order",
      "createdAt"
    FROM public."post_taxonomy_relations"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."entity_taxonomy_relations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity taxonomy relations public read" ON public."entity_taxonomy_relations";
DROP POLICY IF EXISTS "Entity taxonomy relations authenticated read" ON public."entity_taxonomy_relations";
DROP POLICY IF EXISTS "Entity taxonomy relations authenticated insert" ON public."entity_taxonomy_relations";
DROP POLICY IF EXISTS "Entity taxonomy relations authenticated delete" ON public."entity_taxonomy_relations";

-- Public can read relations for published entities
CREATE POLICY "Entity taxonomy relations public read"
ON public."entity_taxonomy_relations"
FOR SELECT TO anon
USING (
  -- Posts: check status = published
  ("entityType" = 'posts' AND EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id::text = "entityId" AND p.status = 'published'
  ))
  OR
  -- Pages: check status = published
  ("entityType" = 'pages' AND EXISTS (
    SELECT 1 FROM public.pages p WHERE p.id::text = "entityId" AND p.status = 'published'
  ))
);

-- Authenticated users can manage all relations
CREATE POLICY "Entity taxonomy relations authenticated read"
ON public."entity_taxonomy_relations"
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Entity taxonomy relations authenticated insert"
ON public."entity_taxonomy_relations"
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Entity taxonomy relations authenticated delete"
ON public."entity_taxonomy_relations"
FOR DELETE TO authenticated
USING (true);

-- ============================================
-- CLEANUP TRIGGER function
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_entity_taxonomy_relations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public."entity_taxonomy_relations"
  WHERE "entityType" = TG_ARGV[0] AND "entityId" = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for posts
DROP TRIGGER IF EXISTS cleanup_post_entity_taxonomy ON public."posts";
CREATE TRIGGER cleanup_post_entity_taxonomy
AFTER DELETE ON public."posts"
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_entity_taxonomy_relations('posts');

-- Trigger for pages
DROP TRIGGER IF EXISTS cleanup_page_entity_taxonomy ON public."pages";
CREATE TRIGGER cleanup_page_entity_taxonomy
AFTER DELETE ON public."pages"
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_entity_taxonomy_relations('pages');

-- ============================================
-- Additional indexes using status
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pages_status_locale ON public."pages"("status", locale) WHERE "status" = 'published';
CREATE INDEX IF NOT EXISTS idx_posts_status_locale ON public."posts"("status", locale) WHERE "status" = 'published';
