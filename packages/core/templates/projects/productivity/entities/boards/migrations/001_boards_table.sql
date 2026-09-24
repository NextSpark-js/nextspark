-- ============================================================================
-- Boards Table Migration
-- Productivity theme: Trello-style boards
-- ============================================================================

CREATE TABLE IF NOT EXISTS "boards" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(20) DEFAULT 'blue',
  "archived" BOOLEAN DEFAULT FALSE,
  "position" INTEGER DEFAULT 0,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "boards_teamId_idx" ON "boards" ("teamId");
CREATE INDEX IF NOT EXISTS "boards_userId_idx" ON "boards" ("userId");
CREATE INDEX IF NOT EXISTS "boards_archived_idx" ON "boards" ("archived") WHERE "archived" = FALSE;
CREATE INDEX IF NOT EXISTS "boards_position_idx" ON "boards" ("teamId", "position");

-- Enable RLS
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "boards_select_policy" ON "boards";
DROP POLICY IF EXISTS "boards_insert_policy" ON "boards";
DROP POLICY IF EXISTS "boards_update_policy" ON "boards";
DROP POLICY IF EXISTS "boards_delete_policy" ON "boards";

-- Policy: Team members can view boards
CREATE POLICY "boards_select_policy" ON "boards"
  FOR SELECT TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create boards (owner only at app level)
CREATE POLICY "boards_insert_policy" ON "boards"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update boards (owner only at app level)
CREATE POLICY "boards_update_policy" ON "boards"
  FOR UPDATE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete boards (owner only at app level)
CREATE POLICY "boards_delete_policy" ON "boards"
  FOR DELETE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boards_updated_at_trigger ON "boards";
CREATE TRIGGER boards_updated_at_trigger
  BEFORE UPDATE ON "boards"
  FOR EACH ROW
  EXECUTE FUNCTION update_boards_updated_at();

-- Comments
COMMENT ON TABLE "boards" IS 'Trello-style boards for organizing lists and cards';
COMMENT ON COLUMN "boards"."color" IS 'Board background color theme';
COMMENT ON COLUMN "boards"."position" IS 'Display order for boards';
