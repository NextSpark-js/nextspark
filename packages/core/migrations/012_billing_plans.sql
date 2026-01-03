-- Migration: 20251220_001_billing_plans.sql
-- Description: Billing Plans (table, indexes, RLS, triggers)
-- Date: 2025-12-20

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."plans" CASCADE;

CREATE TABLE IF NOT EXISTS public."plans" (
  -- Primary Key
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Core Fields
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,

  -- Type and Visibility
  type              TEXT NOT NULL DEFAULT 'paid' CHECK (type IN ('free', 'paid', 'enterprise')),
  visibility        TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'hidden', 'invite_only')),

  -- Pricing (in cents)
  "priceMonthly"    INTEGER,
  "priceYearly"     INTEGER,
  currency          TEXT DEFAULT 'usd',

  -- Trial
  "trialDays"       INTEGER DEFAULT 0,

  -- Entitlements (JSONB for flexibility)
  features          JSONB DEFAULT '[]'::jsonb,
  limits            JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  metadata          JSONB DEFAULT '{}'::jsonb,
  "sortOrder"       INTEGER DEFAULT 0,

  -- Timestamps
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."plans"                   IS 'Billing plans with features and limits';
COMMENT ON COLUMN public."plans".slug              IS 'Unique plan identifier (e.g., free, pro, enterprise)';
COMMENT ON COLUMN public."plans".type              IS 'Plan type: free, paid, or enterprise';
COMMENT ON COLUMN public."plans".visibility        IS 'Plan visibility: public, hidden, or invite_only';
COMMENT ON COLUMN public."plans"."priceMonthly"   IS 'Monthly price in cents';
COMMENT ON COLUMN public."plans"."priceYearly"    IS 'Yearly price in cents';
COMMENT ON COLUMN public."plans".features         IS 'Array of feature slugs included in plan';
COMMENT ON COLUMN public."plans".limits           IS 'Object with limit slugs and max values (-1 = unlimited)';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS plans_set_updated_at ON public."plans";
CREATE TRIGGER plans_set_updated_at
BEFORE UPDATE ON public."plans"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_plans_slug        ON public."plans"(slug);
CREATE INDEX IF NOT EXISTS idx_plans_type        ON public."plans"(type);
CREATE INDEX IF NOT EXISTS idx_plans_visibility  ON public."plans"(visibility);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order  ON public."plans"("sortOrder");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."plans" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Plans public read"         ON public."plans";
DROP POLICY IF EXISTS "Plans authenticated read"  ON public."plans";
DROP POLICY IF EXISTS "Plans superadmin write"    ON public."plans";

-- Public can read public plans
CREATE POLICY "Plans public read"
ON public."plans"
FOR SELECT TO anon
USING (visibility = 'public');

-- Authenticated users can read all plans (for validation)
CREATE POLICY "Plans authenticated read"
ON public."plans"
FOR SELECT TO authenticated
USING (true);

-- Only superadmin can create/update/delete plans
CREATE POLICY "Plans superadmin write"
ON public."plans"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."users" u
    WHERE u.id = public.get_auth_user_id()
      AND u.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."users" u
    WHERE u.id = public.get_auth_user_id()
      AND u.role = 'superadmin'
  )
);
