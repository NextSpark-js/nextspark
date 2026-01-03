-- ============================================================================
-- Activities Table Migration
-- CRM theme: Tasks and activities related to CRM records
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'demo', 'follow_up');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "activities" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Activity info
  "type" activity_type NOT NULL DEFAULT 'task',
  "subject" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" activity_status DEFAULT 'scheduled',
  "priority" activity_priority DEFAULT 'medium',
  
  -- Timing
  "dueDate" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "duration" INTEGER,  -- Duration in minutes
  "outcome" TEXT,
  "location" VARCHAR(255),

  -- Direct relations (optional)
  "contactId" TEXT REFERENCES "contacts"("id") ON DELETE SET NULL,
  "companyId" TEXT REFERENCES "companies"("id") ON DELETE SET NULL,
  "opportunityId" TEXT REFERENCES "opportunities"("id") ON DELETE SET NULL,
  
  -- Assignment
  "assignedTo" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  
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
CREATE INDEX IF NOT EXISTS "activities_teamId_idx" ON "activities" ("teamId");
CREATE INDEX IF NOT EXISTS "activities_userId_idx" ON "activities" ("userId");
CREATE INDEX IF NOT EXISTS "activities_type_idx" ON "activities" ("type");
CREATE INDEX IF NOT EXISTS "activities_status_idx" ON "activities" ("status");
CREATE INDEX IF NOT EXISTS "activities_priority_idx" ON "activities" ("priority");
CREATE INDEX IF NOT EXISTS "activities_dueDate_idx" ON "activities" ("dueDate");
CREATE INDEX IF NOT EXISTS "activities_assignedTo_idx" ON "activities" ("assignedTo");
CREATE INDEX IF NOT EXISTS "activities_contactId_idx" ON "activities" ("contactId");
CREATE INDEX IF NOT EXISTS "activities_companyId_idx" ON "activities" ("companyId");
CREATE INDEX IF NOT EXISTS "activities_opportunityId_idx" ON "activities" ("opportunityId");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_policy" ON "activities";
DROP POLICY IF EXISTS "activities_insert_policy" ON "activities";
DROP POLICY IF EXISTS "activities_update_policy" ON "activities";
DROP POLICY IF EXISTS "activities_delete_policy" ON "activities";

CREATE POLICY "activities_select_policy" ON "activities"
  FOR SELECT
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "activities_insert_policy" ON "activities"
  FOR INSERT
  WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));

CREATE POLICY "activities_update_policy" ON "activities"
  FOR UPDATE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "activities_delete_policy" ON "activities"
  FOR DELETE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activities_updated_at_trigger ON "activities";
CREATE TRIGGER activities_updated_at_trigger
  BEFORE UPDATE ON "activities"
  FOR EACH ROW
  EXECUTE FUNCTION update_activities_updated_at();

COMMENT ON TABLE "activities" IS 'Tasks and activities related to CRM records';
COMMENT ON COLUMN "activities"."duration" IS 'Activity duration in minutes';
