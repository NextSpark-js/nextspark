-- Migration: 025_add_status_to_posts.sql
-- Description: Add status column to posts
-- Date: 2025-12-17
-- Session: builder-entities-unification-v2

-- ============================================
-- STEP 1: Add status column (replaces published boolean)
-- ============================================
ALTER TABLE public."posts"
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'draft';

-- Migrate existing data
UPDATE public."posts"
SET "status" = CASE
  WHEN "published" = true THEN 'published'
  ELSE 'draft'
END
WHERE "status" = 'draft' OR "status" IS NULL;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_posts_status ON public."posts"("status");

-- Add check constraint
ALTER TABLE public."posts" DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public."posts"
ADD CONSTRAINT posts_status_check
CHECK ("status" IN ('draft', 'published', 'scheduled', 'archived'));

-- ============================================
-- STEP 2: Update existing RLS policy to use status instead of published
-- ============================================
DROP POLICY IF EXISTS "posts public can select" ON public."posts";

CREATE POLICY "posts public can select"
ON public."posts"
FOR SELECT TO anon
USING ("status" = 'published');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN public."posts"."status" IS 'Publication status: draft, published, scheduled, archived';

-- Note: We keep 'published' column temporarily for rollback safety
