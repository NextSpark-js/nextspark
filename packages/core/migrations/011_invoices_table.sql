-- Migration: 014_invoices_table.sql
-- Description: Invoices table with ENUMs, indexes, triggers, and RLS policies
-- Date: 2025-11-27

-- ============================================
-- ENUM TYPES (must be defined first)
-- ============================================

-- Invoice status: pending, paid, failed, refunded
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public."invoices" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "invoiceNumber" TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'pending',
  "pdfUrl" TEXT,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT positive_amount CHECK (amount >= 0),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT unique_invoice_per_team UNIQUE ("teamId", "invoiceNumber")
);

-- ============================================
-- INVOICES INDEXES
-- ============================================

-- Index for team-based queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_invoices_team ON public."invoices"("teamId");

-- Composite index for team + date queries with pagination
CREATE INDEX IF NOT EXISTS idx_invoices_team_date ON public."invoices"("teamId", date DESC);

-- Index for invoice number lookups
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public."invoices"("invoiceNumber");

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public."invoices"(status);

-- ============================================
-- INVOICES TRIGGERS
-- ============================================

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS invoices_set_updated_at ON public."invoices";
CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public."invoices"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INVOICES ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public."invoices" ENABLE ROW LEVEL SECURITY;

-- Invoices: ONLY team owner can view their team's invoices
CREATE POLICY "invoices_select_policy" ON public."invoices"
  FOR SELECT TO authenticated
  USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role = 'owner'
    )
  );

-- Invoices: No user INSERT (system only via service role)
-- Invoices are created by billing system, not users
CREATE POLICY "invoices_insert_policy" ON public."invoices"
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Invoices: No user UPDATE (invoices are immutable)
CREATE POLICY "invoices_update_policy" ON public."invoices"
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- Invoices: No user DELETE (invoices must be preserved for records)
CREATE POLICY "invoices_delete_policy" ON public."invoices"
  FOR DELETE TO authenticated
  USING (false);
