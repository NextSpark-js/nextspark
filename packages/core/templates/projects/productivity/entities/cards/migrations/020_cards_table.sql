-- ============================================================================
-- Cards Table Migration
-- Productivity theme: Task cards within lists
-- ============================================================================

CREATE TABLE IF NOT EXISTS "cards" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "position" INTEGER DEFAULT 0,
  "priority" VARCHAR(20) DEFAULT 'medium' CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
  "dueDate" DATE,
  "labels" JSONB DEFAULT '[]'::jsonb,
  "assigneeId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "listId" TEXT NOT NULL REFERENCES "lists"("id") ON DELETE CASCADE,
  "boardId" TEXT NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "cards_listId_idx" ON "cards" ("listId");
CREATE INDEX IF NOT EXISTS "cards_boardId_idx" ON "cards" ("boardId");
CREATE INDEX IF NOT EXISTS "cards_teamId_idx" ON "cards" ("teamId");
CREATE INDEX IF NOT EXISTS "cards_assigneeId_idx" ON "cards" ("assigneeId");
CREATE INDEX IF NOT EXISTS "cards_position_idx" ON "cards" ("listId", "position");
CREATE INDEX IF NOT EXISTS "cards_dueDate_idx" ON "cards" ("dueDate") WHERE "dueDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "cards_labels_idx" ON "cards" USING GIN ("labels");

-- Enable RLS
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "cards_select_policy" ON "cards";
DROP POLICY IF EXISTS "cards_insert_policy" ON "cards";
DROP POLICY IF EXISTS "cards_update_policy" ON "cards";
DROP POLICY IF EXISTS "cards_delete_policy" ON "cards";

-- Policy: Team members can view cards
CREATE POLICY "cards_select_policy" ON "cards"
  FOR SELECT TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create cards
CREATE POLICY "cards_insert_policy" ON "cards"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update cards
CREATE POLICY "cards_update_policy" ON "cards"
  FOR UPDATE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete cards
CREATE POLICY "cards_delete_policy" ON "cards"
  FOR DELETE TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_updated_at_trigger ON "cards";
CREATE TRIGGER cards_updated_at_trigger
  BEFORE UPDATE ON "cards"
  FOR EACH ROW
  EXECUTE FUNCTION update_cards_updated_at();

-- Comments
COMMENT ON TABLE "cards" IS 'Task cards within lists - the main work items';
COMMENT ON COLUMN "cards"."labels" IS 'JSON array of label strings';
COMMENT ON COLUMN "cards"."position" IS 'Display order within the parent list';
COMMENT ON COLUMN "cards"."assigneeId" IS 'Team member assigned to this card';
COMMENT ON COLUMN "cards"."priority" IS 'Card priority: low, medium, high, urgent';
