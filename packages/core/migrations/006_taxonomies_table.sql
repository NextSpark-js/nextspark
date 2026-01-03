-- Migration: 021_taxonomies_table.sql
-- Description: Generic taxonomies system (categories, tags, etc.)
-- Date: 2025-12-16
-- Updated: 2025-12-17 - Changed type from ENUM to TEXT for flexibility

-- ============================================
-- TABLE: taxonomies
-- ============================================
-- Note: Using TEXT for 'type' instead of ENUM for flexibility.
-- Each theme/plugin can define its own taxonomy types via EntityConfig.
-- Examples: 'post_category', 'product_tag', 'portfolio_category', etc.

DROP TABLE IF EXISTS public.taxonomies CASCADE;

CREATE TABLE IF NOT EXISTS public.taxonomies (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT REFERENCES public."users"(id) ON DELETE SET NULL,

  -- Classification
  type         TEXT NOT NULL,  -- Flexible: 'post_category', 'tag', 'product_category', etc.
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,

  -- Visual customization
  icon         TEXT,
  color        TEXT,

  -- Hierarchy support (for nested categories)
  "parentId"   TEXT REFERENCES public.taxonomies(id) ON DELETE SET NULL,

  -- Metadata and ordering
  metadata     JSONB DEFAULT '{}',
  "order"      INTEGER DEFAULT 0,

  -- Status flags
  "isDefault"  BOOLEAN DEFAULT FALSE,
  "isActive"   BOOLEAN DEFAULT TRUE,

  -- System fields
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"  TIMESTAMPTZ,  -- Soft delete

  -- Constraints
  CONSTRAINT valid_taxonomy_slug CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT taxonomy_slug_length CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 100),
  CONSTRAINT taxonomy_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT unique_taxonomy_type_slug UNIQUE(type, slug)
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE  public.taxonomies              IS 'Generic taxonomy system for categories, tags, etc.';
COMMENT ON COLUMN public.taxonomies.type         IS 'Type of taxonomy (post_category, tag, etc.)';
COMMENT ON COLUMN public.taxonomies.slug         IS 'URL-friendly identifier';
COMMENT ON COLUMN public.taxonomies."parentId"   IS 'Parent taxonomy for hierarchical structures';
COMMENT ON COLUMN public.taxonomies."isDefault"  IS 'Default taxonomy for its type';
COMMENT ON COLUMN public.taxonomies."deletedAt"  IS 'Soft delete timestamp';

-- ============================================
-- TRIGGER: updatedAt
-- ============================================
DROP TRIGGER IF EXISTS taxonomies_set_updated_at ON public.taxonomies;
CREATE TRIGGER taxonomies_set_updated_at
BEFORE UPDATE ON public.taxonomies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_taxonomies_type           ON public.taxonomies(type);
CREATE INDEX IF NOT EXISTS idx_taxonomies_slug           ON public.taxonomies(slug);
CREATE INDEX IF NOT EXISTS idx_taxonomies_user_id        ON public.taxonomies("userId");
CREATE INDEX IF NOT EXISTS idx_taxonomies_parent_id      ON public.taxonomies("parentId");
CREATE INDEX IF NOT EXISTS idx_taxonomies_type_slug      ON public.taxonomies(type, slug);
CREATE INDEX IF NOT EXISTS idx_taxonomies_active         ON public.taxonomies("isActive") WHERE "isActive" = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxonomies_order          ON public.taxonomies("order");
CREATE INDEX IF NOT EXISTS idx_taxonomies_metadata_gin   ON public.taxonomies USING GIN (metadata);

-- Partial index for non-deleted
CREATE INDEX IF NOT EXISTS idx_taxonomies_active_not_deleted
  ON public.taxonomies(type, "isActive")
  WHERE "deletedAt" IS NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.taxonomies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxonomies public can select" ON public.taxonomies;
DROP POLICY IF EXISTS "taxonomies auth can do all"   ON public.taxonomies;

-- Public can read active taxonomies (for frontend filtering)
CREATE POLICY "taxonomies public can select"
ON public.taxonomies
FOR SELECT TO anon
USING ("isActive" = TRUE AND "deletedAt" IS NULL);

-- Authenticated users can manage taxonomies
CREATE POLICY "taxonomies auth can do all"
ON public.taxonomies
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
