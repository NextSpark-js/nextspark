-- ============================================================================
-- Categories Table Migration
-- Blog theme: Categories entity for post categorization
-- ============================================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS "categories" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique slug per team
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_teamId_idx"
  ON "categories" ("slug", "teamId");

-- Index for team queries
CREATE INDEX IF NOT EXISTS "categories_teamId_idx" ON "categories" ("teamId");

-- Index for user queries
CREATE INDEX IF NOT EXISTS "categories_userId_idx" ON "categories" ("userId");

-- Index for slug lookups (public pages)
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");

-- Enable RLS
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "categories_select_policy" ON "categories";
DROP POLICY IF EXISTS "categories_insert_policy" ON "categories";
DROP POLICY IF EXISTS "categories_update_policy" ON "categories";
DROP POLICY IF EXISTS "categories_delete_policy" ON "categories";
DROP POLICY IF EXISTS "categories_public_select_policy" ON "categories";

-- Policy: Users can manage their own categories
CREATE POLICY "categories_select_policy" ON "categories"
  FOR SELECT TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

CREATE POLICY "categories_insert_policy" ON "categories"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

CREATE POLICY "categories_update_policy" ON "categories"
  FOR UPDATE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

CREATE POLICY "categories_delete_policy" ON "categories"
  FOR DELETE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Public can see all categories (for public pages)
CREATE POLICY "categories_public_select_policy" ON "categories"
  FOR SELECT TO anon
  USING (true);

-- Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_updated_at_trigger ON "categories";
CREATE TRIGGER categories_updated_at_trigger
  BEFORE UPDATE ON "categories"
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Comments
COMMENT ON TABLE "categories" IS 'Blog post categories per author (team isolated)';
