-- Migration: 021_media.sql
-- Description: Media library table, full-text search, cleanup trigger, and default media tags
-- Date: 2026-02-06

-- ============================================
-- TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public."media" (
  -- Primary Key
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields
  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- File metadata (immutable after upload)
  url          TEXT NOT NULL,
  filename     TEXT NOT NULL,
  "fileSize"   BIGINT NOT NULL,
  "mimeType"   TEXT NOT NULL,

  -- Image-specific (null for non-images)
  width        INTEGER,
  height       INTEGER,

  -- User-editable metadata
  title        TEXT,
  alt          TEXT,
  caption      TEXT,

  -- Full-text search
  "searchVector" tsvector,

  -- Status
  status       TEXT NOT NULL DEFAULT 'active',

  -- System fields
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT media_status_check CHECK (status IN ('active', 'deleted')),
  CONSTRAINT media_filename_length CHECK (length(filename) <= 255),
  CONSTRAINT media_title_length CHECK (title IS NULL OR length(title) <= 255),
  CONSTRAINT media_alt_length CHECK (alt IS NULL OR length(alt) <= 500),
  CONSTRAINT media_caption_length CHECK (caption IS NULL OR length(caption) <= 1000),
  CONSTRAINT media_file_size_positive CHECK ("fileSize" > 0),
  CONSTRAINT media_dimensions_positive CHECK (
    (width IS NULL OR width > 0) AND
    (height IS NULL OR height > 0)
  )
);

COMMENT ON TABLE  public."media"             IS 'Media library - tracks uploaded files with metadata and team isolation';
COMMENT ON COLUMN public."media"."userId"    IS 'User who uploaded the file';
COMMENT ON COLUMN public."media"."teamId"    IS 'Team context for isolation';
COMMENT ON COLUMN public."media".url         IS 'Full URL to file (Vercel Blob or local storage)';
COMMENT ON COLUMN public."media".filename    IS 'Original filename (sanitized)';
COMMENT ON COLUMN public."media"."fileSize"  IS 'File size in bytes';
COMMENT ON COLUMN public."media"."mimeType"  IS 'MIME type (e.g., image/jpeg, video/mp4)';
COMMENT ON COLUMN public."media".width       IS 'Image width in pixels (null for non-images)';
COMMENT ON COLUMN public."media".height      IS 'Image height in pixels (null for non-images)';
COMMENT ON COLUMN public."media".title       IS 'User-defined title (optional, defaults to filename in UI)';
COMMENT ON COLUMN public."media".alt         IS 'Alt text for accessibility/SEO';
COMMENT ON COLUMN public."media".caption     IS 'Caption or description';
COMMENT ON COLUMN public."media".status      IS 'active or deleted (soft delete)';

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS media_set_updated_at ON public."media";
CREATE TRIGGER media_set_updated_at
BEFORE UPDATE ON public."media"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- FULL-TEXT SEARCH TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.media_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.filename, '') || ' ' ||
    coalesce(NEW.alt, '') || ' ' ||
    coalesce(NEW.caption, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS media_search_vector_trigger ON public."media";
CREATE TRIGGER media_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, filename, alt, caption ON public."media"
FOR EACH ROW
EXECUTE FUNCTION public.media_search_vector_update();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_media_user_id        ON public."media"("userId");
CREATE INDEX IF NOT EXISTS idx_media_team_id        ON public."media"("teamId");
CREATE INDEX IF NOT EXISTS idx_media_user_team      ON public."media"("userId", "teamId");
CREATE INDEX IF NOT EXISTS idx_media_team_created   ON public."media"("teamId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_media_status         ON public."media"(status);
CREATE INDEX IF NOT EXISTS idx_media_mime_type      ON public."media"("mimeType");
CREATE INDEX IF NOT EXISTS idx_media_filename       ON public."media"(filename);
CREATE INDEX IF NOT EXISTS idx_media_team_status    ON public."media"("teamId", status);
CREATE INDEX IF NOT EXISTS idx_media_filename_lower ON public."media"(lower(filename));
CREATE INDEX IF NOT EXISTS idx_media_search_vector  ON public."media" USING GIN ("searchVector");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."media" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media team can do all" ON public."media";

CREATE POLICY "Media team can do all"
ON public."media"
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

-- ============================================
-- CLEANUP TRIGGER for media -> entity_taxonomy_relations
-- ============================================
-- When a media item is deleted, remove its taxonomy relations
DROP TRIGGER IF EXISTS cleanup_media_entity_taxonomy ON public."media";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_taxonomy_relations' AND table_schema = 'public') THEN
    CREATE TRIGGER cleanup_media_entity_taxonomy
    AFTER DELETE ON public."media"
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_entity_taxonomy_relations('media');
  END IF;
END $$;

-- ============================================
-- MEDIA TAGS
-- ============================================
-- No default media tags are seeded.
-- Users create their own tags on-the-fly via the media detail panel.

-- ============================================
-- TAXONOMIES: ADD teamId FOR TEAM-SCOPED TAGS
-- ============================================
-- Media tags need team isolation. This extends the existing taxonomies
-- table (006) to support both global and team-scoped taxonomies.

ALTER TABLE public.taxonomies
  ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE;

-- Update unique constraints to support both global and team-scoped taxonomies
-- Old: UNIQUE(type, slug) - global uniqueness
-- New: Two partial unique indexes:
--   1. Global taxonomies (teamId IS NULL): unique by (type, slug)
--   2. Team-scoped taxonomies (teamId IS NOT NULL): unique by (type, slug, teamId)

ALTER TABLE public.taxonomies
  DROP CONSTRAINT IF EXISTS unique_taxonomy_type_slug;

-- Global taxonomies: unique slug per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomies_unique_global
  ON public.taxonomies(type, slug)
  WHERE "teamId" IS NULL;

-- Team-scoped taxonomies: unique slug per type per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomies_unique_team
  ON public.taxonomies(type, slug, "teamId")
  WHERE "teamId" IS NOT NULL;

-- Indexes for team queries
CREATE INDEX IF NOT EXISTS idx_taxonomies_team_id
  ON public.taxonomies("teamId");

CREATE INDEX IF NOT EXISTS idx_taxonomies_type_team
  ON public.taxonomies(type, "teamId")
  WHERE "teamId" IS NOT NULL;

-- Update RLS: team members can see their team's taxonomies
DROP POLICY IF EXISTS "taxonomies auth can do all" ON public.taxonomies;

CREATE POLICY "taxonomies auth can do all"
ON public.taxonomies
FOR ALL TO authenticated
USING (
  "teamId" IS NULL  -- Global taxonomies visible to all authenticated
  OR "teamId" = ANY(public.get_user_team_ids())  -- Team-scoped visible to members
  OR public.is_superadmin()
)
WITH CHECK (
  "teamId" IS NULL
  OR "teamId" = ANY(public.get_user_team_ids())
  OR public.is_superadmin()
);
