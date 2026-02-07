-- Migration: 021_media_table.sql
-- Description: Media library table for tracking uploaded files
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
  alt          TEXT,
  caption      TEXT,

  -- Status
  status       TEXT NOT NULL DEFAULT 'active',

  -- System fields
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT media_status_check CHECK (status IN ('active', 'deleted')),
  CONSTRAINT media_filename_length CHECK (length(filename) <= 255),
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
