-- ============================================================================
-- Contacts Table Migration
-- CRM theme: People contacts at companies
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE contact_channel AS ENUM ('email', 'phone', 'whatsapp', 'linkedin', 'slack', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Contact information
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "mobile" VARCHAR(50),
  
  -- Professional information
  "companyId" TEXT,  -- Reference to companies table
  "position" VARCHAR(100),
  "department" VARCHAR(100),
  "isPrimary" BOOLEAN DEFAULT false,
  
  -- Personal information
  "birthDate" DATE,
  "linkedin" VARCHAR(500),
  "twitter" VARCHAR(100),
  
  -- Communication preferences
  "preferredChannel" contact_channel DEFAULT 'email',
  "timezone" VARCHAR(50) DEFAULT 'UTC',
  "lastContactedAt" TIMESTAMPTZ,
  
  -- Ownership
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT contacts_email_team_unique UNIQUE ("teamId", "email")
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "contacts_teamId_idx" ON "contacts" ("teamId");
CREATE INDEX IF NOT EXISTS "contacts_userId_idx" ON "contacts" ("userId");
CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts" ("email");
CREATE INDEX IF NOT EXISTS "contacts_companyId_idx" ON "contacts" ("companyId");
CREATE INDEX IF NOT EXISTS "contacts_firstName_idx" ON "contacts" ("firstName");
CREATE INDEX IF NOT EXISTS "contacts_lastName_idx" ON "contacts" ("lastName");
CREATE INDEX IF NOT EXISTS "contacts_isPrimary_idx" ON "contacts" ("isPrimary") WHERE "isPrimary" = true;
CREATE INDEX IF NOT EXISTS "contacts_createdAt_idx" ON "contacts" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "contacts_lastContactedAt_idx" ON "contacts" ("lastContactedAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "contacts_select_policy" ON "contacts";
DROP POLICY IF EXISTS "contacts_insert_policy" ON "contacts";
DROP POLICY IF EXISTS "contacts_update_policy" ON "contacts";
DROP POLICY IF EXISTS "contacts_delete_policy" ON "contacts";

-- Policy: Team members can view contacts
CREATE POLICY "contacts_select_policy" ON "contacts"
  FOR SELECT
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can create contacts
CREATE POLICY "contacts_insert_policy" ON "contacts"
  FOR INSERT
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
  );

-- Policy: Team members can update contacts
CREATE POLICY "contacts_update_policy" ON "contacts"
  FOR UPDATE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- Policy: Team members can delete contacts
CREATE POLICY "contacts_delete_policy" ON "contacts"
  FOR DELETE
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON "contacts";
CREATE TRIGGER contacts_updated_at_trigger
  BEFORE UPDATE ON "contacts"
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE "contacts" IS 'People contacts at companies';
COMMENT ON COLUMN "contacts"."isPrimary" IS 'Is this the primary contact for the company';
COMMENT ON COLUMN "contacts"."preferredChannel" IS 'Preferred communication channel';
