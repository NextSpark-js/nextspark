-- Migration: 024_add_status_to_pages.sql
-- Description: Add status column to pages + enable RLS (was missing)
-- Date: 2025-12-17
-- Session: builder-entities-unification-v2

-- ============================================
-- STEP 1: Add status column (replaces published boolean)
-- ============================================
ALTER TABLE public."pages"
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'draft';

-- Migrate existing data: published = true -> 'published', false -> 'draft'
UPDATE public."pages"
SET "status" = CASE
  WHEN "published" = true THEN 'published'
  ELSE 'draft'
END
WHERE "status" = 'draft' OR "status" IS NULL;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_pages_status ON public."pages"("status");

-- Add check constraint for valid status values
-- First drop if exists to avoid errors on re-run
ALTER TABLE public."pages" DROP CONSTRAINT IF EXISTS pages_status_check;
ALTER TABLE public."pages"
ADD CONSTRAINT pages_status_check
CHECK ("status" IN ('draft', 'published', 'scheduled', 'archived'));

-- ============================================
-- STEP 2: Update RLS public policy to use status field
-- ============================================
-- Note: RLS and team isolation policy already created in 001_pages_table.sql
-- Only update the public select policy to use status instead of published

DROP POLICY IF EXISTS "pages public can select" ON public."pages";

-- Public can read published pages (using NEW status field)
CREATE POLICY "pages public can select"
ON public."pages"
FOR SELECT TO anon
USING ("status" = 'published');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN public."pages"."status" IS 'Publication status: draft, published, scheduled, archived';

-- Note: We keep 'published' column temporarily for rollback safety
-- DROP COLUMN published will be in a future migration after validation
