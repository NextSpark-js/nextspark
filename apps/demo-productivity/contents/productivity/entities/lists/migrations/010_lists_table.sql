-- ============================================================================
-- Lists Table Migration
-- Productivity theme: Columns within boards
-- ============================================================================

CREATE TABLE IF NOT EXISTS "lists" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" VARCHAR(255) NOT NULL,
  "position" INTEGER DEFAULT 0,
  "boardId" TEXT NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "lists_boardId_idx" ON "lists" ("boardId");
CREATE INDEX IF NOT EXISTS "lists_teamId_idx" ON "lists" ("teamId");
CREATE INDEX IF NOT EXISTS "lists_position_idx" ON "lists" ("boardId", "position");

-- Enable RLS
ALTER TABLE "lists" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "lists_select_policy" ON "lists";
DROP POLICY IF EXISTS "lists_insert_policy" ON "lists";
DROP POLICY IF EXISTS "lists_update_policy" ON "lists";
DROP POLICY IF EXISTS "lists_delete_policy" ON "lists";

-- Policy: Team members can view lists
CREATE POLICY "lists_select_policy" ON "lists"
  FOR SELECT TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create lists
CREATE POLICY "lists_insert_policy" ON "lists"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update lists
CREATE POLICY "lists_update_policy" ON "lists"
  FOR UPDATE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete lists (owner only at app level)
CREATE POLICY "lists_delete_policy" ON "lists"
  FOR DELETE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lists_updated_at_trigger ON "lists";
CREATE TRIGGER lists_updated_at_trigger
  BEFORE UPDATE ON "lists"
  FOR EACH ROW
  EXECUTE FUNCTION update_lists_updated_at();

-- Comments
COMMENT ON TABLE "lists" IS 'Columns within boards (To Do, In Progress, Done, etc.)';
COMMENT ON COLUMN "lists"."position" IS 'Display order within the parent board';
