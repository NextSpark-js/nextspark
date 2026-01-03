-- Migration: 20251220_003_billing_usage.sql
-- Description: Billing Usage Aggregates (table, indexes, RLS, triggers)
-- Date: 2025-12-20
-- Purpose: Fast O(1) quota checks - aggregate view of usage_events

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."usage" CASCADE;

CREATE TABLE IF NOT EXISTS public."usage" (
  -- Primary Key
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "subscriptionId"      TEXT NOT NULL REFERENCES public."subscriptions"(id) ON DELETE CASCADE,
  "limitSlug"           TEXT NOT NULL,

  -- Period (for resets: '2024-12' for monthly, '2024-12-20' for daily, 'never' for no reset)
  "periodKey"           TEXT NOT NULL,

  -- Current Value (aggregate of all usage_events)
  "currentValue"        INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  "lastIncrementAt"     TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."usage"                      IS 'Aggregated usage for fast O(1) quota checks';
COMMENT ON COLUMN public."usage"."subscriptionId"     IS 'Reference to subscription';
COMMENT ON COLUMN public."usage"."limitSlug"          IS 'Limit identifier (e.g., projects, api_calls, storage_gb)';
COMMENT ON COLUMN public."usage"."periodKey"          IS 'Period key for reset logic (e.g., 2024-12 for monthly, 2024-12-20 for daily)';
COMMENT ON COLUMN public."usage"."currentValue"       IS 'Current aggregated usage value (sum of all usage_events)';
COMMENT ON COLUMN public."usage"."lastIncrementAt"    IS 'Timestamp of last usage increment';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS usage_set_updated_at ON public."usage";
CREATE TRIGGER usage_set_updated_at
BEFORE UPDATE ON public."usage"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
-- Unique constraint: one usage record per subscription + limit + period
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_unique
ON public."usage"("subscriptionId", "limitSlug", "periodKey");

CREATE INDEX IF NOT EXISTS idx_usage_subscription_id   ON public."usage"("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_usage_limit_slug        ON public."usage"("limitSlug");
CREATE INDEX IF NOT EXISTS idx_usage_period_key        ON public."usage"("periodKey");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."usage" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Usage read via team"     ON public."usage";
DROP POLICY IF EXISTS "Usage system write"      ON public."usage";

-- Team members can read usage via their team's subscription
CREATE POLICY "Usage read via team"
ON public."usage"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."subscriptions" s
    JOIN public."team_members" tm ON tm."teamId" = s."teamId"
    WHERE s.id = "usage"."subscriptionId"
      AND tm."userId" = public.get_auth_user_id()
  )
);

-- Team members can write usage (via their team's subscription)
-- This ensures users can only modify usage for teams they belong to
CREATE POLICY "Usage system write"
ON public."usage"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."subscriptions" s
    JOIN public."team_members" tm ON tm."teamId" = s."teamId"
    WHERE s.id = "usage"."subscriptionId"
      AND tm."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."subscriptions" s
    JOIN public."team_members" tm ON tm."teamId" = s."teamId"
    WHERE s.id = "usage"."subscriptionId"
      AND tm."userId" = public.get_auth_user_id()
  )
);
