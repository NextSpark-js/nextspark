-- ============================================================================
-- Campaigns Table Migration
-- CRM theme: Marketing campaigns
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM ('email', 'social', 'event', 'webinar', 'advertising', 'content', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('planned', 'active', 'paused', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_channel AS ENUM ('email', 'social_media', 'web', 'print', 'tv', 'radio', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Campaign info
  "name" VARCHAR(255) NOT NULL,
  "type" campaign_type DEFAULT 'email',
  "status" campaign_status DEFAULT 'planned',
  "objective" TEXT,
  "description" TEXT,
  
  -- Dates
  "startDate" DATE,
  "endDate" DATE,
  
  -- Budget
  "budget" DECIMAL(15,2) DEFAULT 0,
  "actualCost" DECIMAL(15,2) DEFAULT 0,
  
  -- Targets and results
  "targetAudience" TEXT,
  "targetLeads" INTEGER DEFAULT 0,
  "actualLeads" INTEGER DEFAULT 0,
  "targetRevenue" DECIMAL(15,2) DEFAULT 0,
  "actualRevenue" DECIMAL(15,2) DEFAULT 0,
  "roi" DECIMAL(10,2),
  
  -- Channel
  "channel" campaign_channel DEFAULT 'email',
  
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
CREATE INDEX IF NOT EXISTS "campaigns_teamId_idx" ON "campaigns" ("teamId");
CREATE INDEX IF NOT EXISTS "campaigns_userId_idx" ON "campaigns" ("userId");
CREATE INDEX IF NOT EXISTS "campaigns_type_idx" ON "campaigns" ("type");
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns" ("status");
CREATE INDEX IF NOT EXISTS "campaigns_startDate_idx" ON "campaigns" ("startDate");
CREATE INDEX IF NOT EXISTS "campaigns_endDate_idx" ON "campaigns" ("endDate");
CREATE INDEX IF NOT EXISTS "campaigns_assignedTo_idx" ON "campaigns" ("assignedTo");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select_policy" ON "campaigns";
DROP POLICY IF EXISTS "campaigns_insert_policy" ON "campaigns";
DROP POLICY IF EXISTS "campaigns_update_policy" ON "campaigns";
DROP POLICY IF EXISTS "campaigns_delete_policy" ON "campaigns";

CREATE POLICY "campaigns_select_policy" ON "campaigns"
  FOR SELECT
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "campaigns_insert_policy" ON "campaigns"
  FOR INSERT
  WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));

CREATE POLICY "campaigns_update_policy" ON "campaigns"
  FOR UPDATE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "campaigns_delete_policy" ON "campaigns"
  FOR DELETE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_updated_at_trigger ON "campaigns";
CREATE TRIGGER campaigns_updated_at_trigger
  BEFORE UPDATE ON "campaigns"
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

COMMENT ON TABLE "campaigns" IS 'Marketing campaigns';
COMMENT ON COLUMN "campaigns"."roi" IS 'Return on investment percentage';
