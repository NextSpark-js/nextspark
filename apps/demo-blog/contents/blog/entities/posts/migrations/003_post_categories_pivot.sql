-- ============================================================================
-- Post Categories Pivot Table Migration
-- Blog theme: Many-to-many relationship between posts and categories
-- ============================================================================

-- Create pivot table
CREATE TABLE IF NOT EXISTS "post_categories" (
  "postId" TEXT NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  PRIMARY KEY ("postId", "categoryId")
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "post_categories_postId_idx" ON "post_categories" ("postId");
CREATE INDEX IF NOT EXISTS "post_categories_categoryId_idx" ON "post_categories" ("categoryId");

-- Enable RLS
ALTER TABLE "post_categories" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "post_categories_all_policy" ON "post_categories";
DROP POLICY IF EXISTS "post_categories_public_select_policy" ON "post_categories";

-- Policies follow post ownership (if user owns the post, they can manage its categories)
CREATE POLICY "post_categories_all_policy" ON "post_categories"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "posts" p
      WHERE p.id = "postId"
      AND p."teamId" = ANY(public.get_user_team_ids())
    )
  );

-- Public read access for category pages
CREATE POLICY "post_categories_public_select_policy" ON "post_categories"
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM "posts" p
      WHERE p.id = "postId"
      AND p."status" = 'published'
    )
  );

-- Comments
COMMENT ON TABLE "post_categories" IS 'Many-to-many relationship between posts and categories';
