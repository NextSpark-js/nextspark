-- ============================================================================
-- Leads Table Migration
-- CRM theme: Prospective customers before conversion
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('web', 'referral', 'cold_call', 'trade_show', 'social_media', 'email', 'advertising', 'partner', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE company_size AS ENUM ('1-10', '11-50', '51-200', '201-500', '500+');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "leads" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Contact information
  "companyName" VARCHAR(255) NOT NULL,
  "contactName" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "website" VARCHAR(500),
  
  -- Lead qualification
  "source" lead_source DEFAULT 'web',
  "status" lead_status DEFAULT 'new',
  "score" INTEGER DEFAULT 0 CHECK ("score" >= 0 AND "score" <= 100),
  "industry" VARCHAR(100),
  "companySize" company_size,
  "budget" DECIMAL(15,2),
  
  -- Assignment
  "assignedTo" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  
  -- Conversion tracking
  "convertedDate" TIMESTAMPTZ,
  "convertedToContactId" UUID,
  "convertedToCompanyId" UUID,
  
  -- Notes
  "notes" TEXT,
  
  -- Ownership
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT leads_email_team_unique UNIQUE ("teamId", "email")
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "leads_teamId_idx" ON "leads" ("teamId");
CREATE INDEX IF NOT EXISTS "leads_userId_idx" ON "leads" ("userId");
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads" ("email");
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" ("status");
CREATE INDEX IF NOT EXISTS "leads_source_idx" ON "leads" ("source");
CREATE INDEX IF NOT EXISTS "leads_score_idx" ON "leads" ("score" DESC);
CREATE INDEX IF NOT EXISTS "leads_assignedTo_idx" ON "leads" ("assignedTo");
CREATE INDEX IF NOT EXISTS "leads_createdAt_idx" ON "leads" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "leads_companyName_idx" ON "leads" ("companyName");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "leads_select_policy" ON "leads";
DROP POLICY IF EXISTS "leads_insert_policy" ON "leads";
DROP POLICY IF EXISTS "leads_update_policy" ON "leads";
DROP POLICY IF EXISTS "leads_delete_policy" ON "leads";

-- Policy: Team members can view leads
CREATE POLICY "leads_select_policy" ON "leads"
  FOR SELECT
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create leads
CREATE POLICY "leads_insert_policy" ON "leads"
  FOR INSERT
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update leads
CREATE POLICY "leads_update_policy" ON "leads"
  FOR UPDATE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete leads (permission checked at app level)
CREATE POLICY "leads_delete_policy" ON "leads"
  FOR DELETE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at_trigger ON "leads";
CREATE TRIGGER leads_updated_at_trigger
  BEFORE UPDATE ON "leads"
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE "leads" IS 'Prospective customers before conversion to contacts/companies';
COMMENT ON COLUMN "leads"."score" IS 'Lead qualification score from 0 to 100';
COMMENT ON COLUMN "leads"."convertedToContactId" IS 'Reference to contact created from this lead';
COMMENT ON COLUMN "leads"."convertedToCompanyId" IS 'Reference to company created from this lead';
