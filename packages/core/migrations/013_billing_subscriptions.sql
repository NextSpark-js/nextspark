-- Migration: 20251220_002_billing_subscriptions.sql
-- Description: Billing Subscriptions (table, indexes, RLS, triggers)
-- Date: 2025-12-20
-- NOTE: Subscriptions are ALWAYS team-based. Even in B2C: 1 user = 1 team
-- userId is optional for B2C optimization (avoids extra JOIN)

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."subscriptions" CASCADE;

CREATE TABLE IF NOT EXISTS public."subscriptions" (
  -- Primary Key
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "teamId"                   TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "userId"                   TEXT REFERENCES public."users"(id) ON DELETE SET NULL,
  "planId"                   TEXT NOT NULL REFERENCES public."plans"(id) ON DELETE RESTRICT,

  -- Status
  status                     TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'expired')
  ),

  -- Billing Period
  "currentPeriodStart"       TIMESTAMPTZ NOT NULL,
  "currentPeriodEnd"         TIMESTAMPTZ NOT NULL,

  -- Trial
  "trialEndsAt"              TIMESTAMPTZ,

  -- Cancellation
  "canceledAt"               TIMESTAMPTZ,
  "cancelAtPeriodEnd"        BOOLEAN DEFAULT FALSE,

  -- Billing Interval
  "billingInterval"          TEXT NOT NULL DEFAULT 'monthly' CHECK ("billingInterval" IN ('monthly', 'yearly')),

  -- Payment Provider Integration
  "paymentProvider"          TEXT CHECK ("paymentProvider" IN ('stripe', 'paddle', 'lemonsqueezy')),
  "externalSubscriptionId"   TEXT,
  "externalCustomerId"       TEXT,

  -- Metadata
  metadata                   JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."subscriptions"                             IS 'Team subscriptions to billing plans';
COMMENT ON COLUMN public."subscriptions"."teamId"                    IS 'Team this subscription belongs to (ALWAYS present)';
COMMENT ON COLUMN public."subscriptions"."userId"                    IS 'Optional user reference for B2C (avoids JOIN)';
COMMENT ON COLUMN public."subscriptions"."planId"                    IS 'Current plan for this subscription';
COMMENT ON COLUMN public."subscriptions".status                      IS 'Subscription status: trialing, active, past_due, canceled, paused, expired';
COMMENT ON COLUMN public."subscriptions"."currentPeriodStart"        IS 'Start of current billing period';
COMMENT ON COLUMN public."subscriptions"."currentPeriodEnd"          IS 'End of current billing period';
COMMENT ON COLUMN public."subscriptions"."cancelAtPeriodEnd"         IS 'If true, subscription will cancel at period end';
COMMENT ON COLUMN public."subscriptions"."billingInterval"           IS 'Billing interval: monthly or yearly';
COMMENT ON COLUMN public."subscriptions"."externalSubscriptionId"    IS 'External provider subscription ID (Stripe, Paddle, etc.)';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public."subscriptions";
CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON public."subscriptions"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id             ON public."subscriptions"("teamId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id             ON public."subscriptions"("userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id             ON public."subscriptions"("planId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_status              ON public."subscriptions"(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end          ON public."subscriptions"("currentPeriodEnd");
CREATE INDEX IF NOT EXISTS idx_subscriptions_external_sub        ON public."subscriptions"("externalSubscriptionId") WHERE "externalSubscriptionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_interval    ON public."subscriptions"("billingInterval");

-- Constraint: One team can only have one active subscription
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique_active
ON public."subscriptions"("teamId")
WHERE status IN ('active', 'trialing', 'past_due');

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Per-user RLS on subscriptions (hardened).
--
-- WHY: a team's "team read" let ANY team member read the team's subscriptions.
-- When subscriptions are per (userId, teamId) and a team holds many users,
-- team-wide read means every user reads every other user's membership row.
-- Uses ONLY core primitives: can_bypass_rls() (superadmin/developer/service
-- bypass), get_auth_user_id(), team_members. Elevated tier = ('owner','admin').
--
-- NOTE on subscriptions."userId": NULLable by design (team-level subscriptions).
-- The own-row branch evaluates NULL -> false, so team-level subscriptions are
-- visible only to the elevated tier. Correct and intended.
-- ============================================================================

-- Cleanup existing policies
DROP POLICY IF EXISTS "Subscriptions team read"        ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions team write"       ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions superadmin"       ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions per-user select"  ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions elevated insert"  ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions elevated update"  ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions elevated delete"  ON public."subscriptions";

CREATE POLICY "Subscriptions per-user select"
ON public."subscriptions"
FOR SELECT TO authenticated
USING (
  public.can_bypass_rls()
  OR "userId" = public.get_auth_user_id()
  OR EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = public."subscriptions"."teamId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner','admin')
  )
);

-- Writes: elevated tier or bypass only — NEVER an own-row branch (a user must
-- not be able to grant themselves a membership).
CREATE POLICY "Subscriptions elevated insert"
ON public."subscriptions"
FOR INSERT TO authenticated
WITH CHECK (
  public.can_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = public."subscriptions"."teamId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner','admin')
  )
);

CREATE POLICY "Subscriptions elevated update"
ON public."subscriptions"
FOR UPDATE TO authenticated
USING (
  public.can_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = public."subscriptions"."teamId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner','admin')
  )
)
WITH CHECK (
  public.can_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = public."subscriptions"."teamId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner','admin')
  )
);

CREATE POLICY "Subscriptions elevated delete"
ON public."subscriptions"
FOR DELETE TO authenticated
USING (
  public.can_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM public."team_members" tm
    WHERE tm."teamId" = public."subscriptions"."teamId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner','admin')
  )
);
