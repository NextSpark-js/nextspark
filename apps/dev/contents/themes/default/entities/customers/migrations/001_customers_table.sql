-- Migration: 001_customers_table.sql
-- Description: Customers (table, indexes, RLS)
-- Date: 2025-01-24
-- Updated: 2025-11-26 (Phase 2 - Team Isolation)

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."customers" CASCADE;

CREATE TABLE IF NOT EXISTS public."customers" (
  -- Primary Key
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields (al inicio)
  "userId"        TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Entity-specific fields
  office          TEXT NOT NULL,
  account         INTEGER NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  phone           TEXT,
  "salesRep"      TEXT,
  "visitDays"     JSONB DEFAULT '[]'::jsonb,
  "contactDays"   JSONB DEFAULT '[]'::jsonb,

  -- System fields
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."customers"                IS 'Customers table with team isolation via RLS';
COMMENT ON COLUMN public."customers"."userId"       IS 'User who created this customer record';
COMMENT ON COLUMN public."customers"."teamId"       IS 'Team context for isolation';
COMMENT ON COLUMN public."customers".office         IS 'Customer office or branch';
COMMENT ON COLUMN public."customers".account        IS 'Unique customer account number (used for identification and external integrations)';
COMMENT ON COLUMN public."customers".name           IS 'Customer name or company name';
COMMENT ON COLUMN public."customers".phone          IS 'Customer phone number';
COMMENT ON COLUMN public."customers"."salesRep"     IS 'Sales representative assigned to customer';
COMMENT ON COLUMN public."customers"."visitDays"    IS 'Days of the week for customer visits as JSONB array';
COMMENT ON COLUMN public."customers"."contactDays"  IS 'Days of the week for customer contact as JSONB array';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS customer_set_updated_at ON public."customers";
CREATE TRIGGER customer_set_updated_at
BEFORE UPDATE ON public."customers"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customer_user_id          ON public."customers"("userId");
CREATE INDEX IF NOT EXISTS idx_customer_team_id          ON public."customers"("teamId");
CREATE INDEX IF NOT EXISTS idx_customer_office           ON public."customers"(office);
CREATE INDEX IF NOT EXISTS idx_customer_account          ON public."customers"(account);
CREATE INDEX IF NOT EXISTS idx_customer_name             ON public."customers"(name);
CREATE INDEX IF NOT EXISTS idx_customer_sales_rep        ON public."customers"("salesRep");
CREATE INDEX IF NOT EXISTS idx_customer_created_at       ON public."customers"("createdAt");
CREATE INDEX IF NOT EXISTS idx_customer_team_created     ON public."customers"("teamId", "createdAt" DESC);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_customer_visit_days_gin   ON public."customers" USING GIN ("visitDays");
CREATE INDEX IF NOT EXISTS idx_customer_contact_days_gin ON public."customers" USING GIN ("contactDays");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view own customers"                       ON public."customers";
DROP POLICY IF EXISTS "Users can create customers"                         ON public."customers";
DROP POLICY IF EXISTS "Users can insert own customers"                     ON public."customers";
DROP POLICY IF EXISTS "Users can update own customers"                     ON public."customers";
DROP POLICY IF EXISTS "Users can delete own customers"                     ON public."customers";
DROP POLICY IF EXISTS "Customers auth can do all"                          ON public."customers";
DROP POLICY IF EXISTS "Customers team can do all"                          ON public."customers";

-- ============================
-- RLS: TEAM ISOLATION ONLY
-- ============================
-- IMPORTANTE: RLS solo verifica team membership
-- La lógica de access.shared (user isolation) se maneja a NIVEL APP
-- Esto permite cambiar el comportamiento desde el config sin modificar RLS
CREATE POLICY "Customers team can do all"
ON public."customers"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation only: user must be member of the team
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);