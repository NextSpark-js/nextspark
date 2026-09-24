-- ============================================================================
-- Opportunities Table Migration
-- CRM theme: Sales opportunities in the pipeline
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE opportunity_type AS ENUM ('new_business', 'existing_business', 'renewal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM ('open', 'won', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "opportunities" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Opportunity info
  "name" VARCHAR(255) NOT NULL,
  "companyId" TEXT REFERENCES "companies"("id") ON DELETE SET NULL,
  "contactId" TEXT REFERENCES "contacts"("id") ON DELETE SET NULL,
  
  -- Pipeline
  "pipelineId" UUID,  -- Reference to pipelines table
  "stageId" VARCHAR(100),
  
  -- Financials
  "amount" DECIMAL(15,2) DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'USD',
  "probability" INTEGER DEFAULT 0 CHECK ("probability" >= 0 AND "probability" <= 100),
  "expectedRevenue" DECIMAL(15,2) GENERATED ALWAYS AS ("amount" * ("probability"::DECIMAL / 100)) STORED,
  
  -- Dates
  "closeDate" DATE,
  "wonDate" DATE,
  "lostDate" DATE,
  
  -- Classification
  "type" opportunity_type DEFAULT 'new_business',
  "source" VARCHAR(100),
  "competitor" VARCHAR(255),
  "status" opportunity_status DEFAULT 'open',
  "lostReason" TEXT,
  
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
CREATE INDEX IF NOT EXISTS "opportunities_teamId_idx" ON "opportunities" ("teamId");
CREATE INDEX IF NOT EXISTS "opportunities_userId_idx" ON "opportunities" ("userId");
CREATE INDEX IF NOT EXISTS "opportunities_companyId_idx" ON "opportunities" ("companyId");
CREATE INDEX IF NOT EXISTS "opportunities_contactId_idx" ON "opportunities" ("contactId");
CREATE INDEX IF NOT EXISTS "opportunities_pipelineId_idx" ON "opportunities" ("pipelineId");
CREATE INDEX IF NOT EXISTS "opportunities_status_idx" ON "opportunities" ("status");
CREATE INDEX IF NOT EXISTS "opportunities_closeDate_idx" ON "opportunities" ("closeDate");
CREATE INDEX IF NOT EXISTS "opportunities_assignedTo_idx" ON "opportunities" ("assignedTo");
CREATE INDEX IF NOT EXISTS "opportunities_amount_idx" ON "opportunities" ("amount" DESC);
CREATE INDEX IF NOT EXISTS "opportunities_createdAt_idx" ON "opportunities" ("createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "opportunities_select_policy" ON "opportunities";
DROP POLICY IF EXISTS "opportunities_insert_policy" ON "opportunities";
DROP POLICY IF EXISTS "opportunities_update_policy" ON "opportunities";
DROP POLICY IF EXISTS "opportunities_delete_policy" ON "opportunities";

-- Policy: Team members can view opportunities
CREATE POLICY "opportunities_select_policy" ON "opportunities"
  FOR SELECT
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create opportunities
CREATE POLICY "opportunities_insert_policy" ON "opportunities"
  FOR INSERT
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update opportunities
CREATE POLICY "opportunities_update_policy" ON "opportunities"
  FOR UPDATE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete opportunities
CREATE POLICY "opportunities_delete_policy" ON "opportunities"
  FOR DELETE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_updated_at_trigger ON "opportunities";
CREATE TRIGGER opportunities_updated_at_trigger
  BEFORE UPDATE ON "opportunities"
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE "opportunities" IS 'Sales opportunities in the pipeline';
COMMENT ON COLUMN "opportunities"."expectedRevenue" IS 'Calculated as amount * (probability / 100)';
COMMENT ON COLUMN "opportunities"."stageId" IS 'Current stage ID from pipeline stages JSONB';
