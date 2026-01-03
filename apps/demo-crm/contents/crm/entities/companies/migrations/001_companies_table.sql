-- ============================================================================
-- Companies Table Migration
-- CRM theme: Customer and prospect companies
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE company_type AS ENUM ('prospect', 'customer', 'partner', 'competitor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE company_size AS ENUM ('1-10', '11-50', '51-200', '201-500', '500+');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE company_rating AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Company information
  "name" VARCHAR(255) NOT NULL,
  "legalName" VARCHAR(255),
  "taxId" VARCHAR(50),
  "website" VARCHAR(500),
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  
  -- Classification
  "industry" VARCHAR(100),
  "type" company_type DEFAULT 'prospect',
  "size" company_size,
  "annualRevenue" DECIMAL(15,2),
  "rating" company_rating DEFAULT 'warm',
  
  -- Address
  "address" VARCHAR(500),
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "country" VARCHAR(100),
  "postalCode" VARCHAR(20),
  
  -- Social
  "logo" VARCHAR(500),
  "linkedin" VARCHAR(500),
  "facebook" VARCHAR(500),
  "twitter" VARCHAR(100),
  
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
CREATE INDEX IF NOT EXISTS "companies_teamId_idx" ON "companies" ("teamId");
CREATE INDEX IF NOT EXISTS "companies_userId_idx" ON "companies" ("userId");
CREATE INDEX IF NOT EXISTS "companies_name_idx" ON "companies" ("name");
CREATE INDEX IF NOT EXISTS "companies_type_idx" ON "companies" ("type");
CREATE INDEX IF NOT EXISTS "companies_industry_idx" ON "companies" ("industry");
CREATE INDEX IF NOT EXISTS "companies_rating_idx" ON "companies" ("rating");
CREATE INDEX IF NOT EXISTS "companies_assignedTo_idx" ON "companies" ("assignedTo");
CREATE INDEX IF NOT EXISTS "companies_createdAt_idx" ON "companies" ("createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "companies_select_policy" ON "companies";
DROP POLICY IF EXISTS "companies_insert_policy" ON "companies";
DROP POLICY IF EXISTS "companies_update_policy" ON "companies";
DROP POLICY IF EXISTS "companies_delete_policy" ON "companies";

-- Policy: Team members can view companies
CREATE POLICY "companies_select_policy" ON "companies"
  FOR SELECT
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create companies
CREATE POLICY "companies_insert_policy" ON "companies"
  FOR INSERT
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update companies
CREATE POLICY "companies_update_policy" ON "companies"
  FOR UPDATE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete companies
CREATE POLICY "companies_delete_policy" ON "companies"
  FOR DELETE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_updated_at_trigger ON "companies";
CREATE TRIGGER companies_updated_at_trigger
  BEFORE UPDATE ON "companies"
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE "companies" IS 'Customer and prospect companies';
COMMENT ON COLUMN "companies"."type" IS 'Company relationship type';
COMMENT ON COLUMN "companies"."rating" IS 'Company temperature rating';
