-- ============================================================================
-- Author Profile Fields Migration
-- Blog theme: Add public profile fields for multi-author platform
-- ============================================================================

-- Add profile fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_twitter" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_linkedin" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_website" TEXT;

-- Create unique index for username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique_idx"
  ON "users" (LOWER("username"))
  WHERE "username" IS NOT NULL;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");

-- Add check constraint for username format (alphanumeric, underscore, min 3 chars)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_username_format'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "check_username_format"
      CHECK ("username" IS NULL OR "username" ~ '^[a-zA-Z0-9_]{3,30}$');
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN "users"."username" IS 'Public username for author profile URL (/author/[username])';
COMMENT ON COLUMN "users"."bio" IS 'Author biography shown on public profile';
COMMENT ON COLUMN "users"."social_twitter" IS 'Twitter/X profile URL';
COMMENT ON COLUMN "users"."social_linkedin" IS 'LinkedIn profile URL';
COMMENT ON COLUMN "users"."social_website" IS 'Personal website URL';
