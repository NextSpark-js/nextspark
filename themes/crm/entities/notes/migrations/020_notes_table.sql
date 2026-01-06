-- ============================================================================
-- Notes Table Migration
-- CRM theme: Notes and comments on CRM records
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE note_type AS ENUM ('general', 'call', 'meeting', 'email', 'followup');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "notes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Note content
  "title" VARCHAR(255),
  "content" TEXT NOT NULL,
  "type" note_type DEFAULT 'general',
  "isPinned" BOOLEAN DEFAULT false,
  "isPrivate" BOOLEAN DEFAULT false,
  
  -- Polymorphic relation
  "entityType" VARCHAR(50),  -- lead, contact, company, opportunity, campaign
  "entityId" UUID,
  
  -- Direct relations (optional)
  "contactId" TEXT REFERENCES "contacts"("id") ON DELETE SET NULL,
  "companyId" TEXT REFERENCES "companies"("id") ON DELETE SET NULL,
  "opportunityId" TEXT REFERENCES "opportunities"("id") ON DELETE SET NULL,
  
  -- Attachments
  "attachments" JSONB DEFAULT '[]',
  
  -- Ownership
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "notes_teamId_idx" ON "notes" ("teamId");
CREATE INDEX IF NOT EXISTS "notes_userId_idx" ON "notes" ("userId");
CREATE INDEX IF NOT EXISTS "notes_type_idx" ON "notes" ("type");
CREATE INDEX IF NOT EXISTS "notes_isPinned_idx" ON "notes" ("isPinned") WHERE "isPinned" = true;
CREATE INDEX IF NOT EXISTS "notes_entityType_entityId_idx" ON "notes" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "notes_createdAt_idx" ON "notes" ("createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select_policy" ON "notes";
DROP POLICY IF EXISTS "notes_insert_policy" ON "notes";
DROP POLICY IF EXISTS "notes_update_policy" ON "notes";
DROP POLICY IF EXISTS "notes_delete_policy" ON "notes";

-- Private notes only visible to creator, others visible to team
CREATE POLICY "notes_select_policy" ON "notes"
  FOR SELECT
  USING (
    (NOT "isPrivate" AND "teamId" = ANY(public.get_user_team_ids()))
    OR ("isPrivate" AND "userId" = public.get_auth_user_id())
    OR public.is_superadmin()
  );

CREATE POLICY "notes_insert_policy" ON "notes"
  FOR INSERT
  WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));

CREATE POLICY "notes_update_policy" ON "notes"
  FOR UPDATE
  USING (
    "userId" = public.get_auth_user_id()
    OR ("teamId" = ANY(public.get_user_team_ids()) AND NOT "isPrivate")
    OR public.is_superadmin()
  );

CREATE POLICY "notes_delete_policy" ON "notes"
  FOR DELETE
  USING (
    "userId" = public.get_auth_user_id()
    OR ("teamId" = ANY(public.get_user_team_ids()) AND NOT "isPrivate")
    OR public.is_superadmin()
  );

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at_trigger ON "notes";
CREATE TRIGGER notes_updated_at_trigger
  BEFORE UPDATE ON "notes"
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

COMMENT ON TABLE "notes" IS 'Notes and comments on CRM records';
COMMENT ON COLUMN "notes"."isPrivate" IS 'Private notes only visible to creator';
COMMENT ON COLUMN "notes"."attachments" IS 'JSONB array of attachment URLs';
