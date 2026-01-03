-- Migration: 20251220_005_billing_events.sql
-- Description: Billing Events History (table, indexes, RLS)
-- Date: 2025-12-20
-- Purpose: Payment transaction history and audit

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."billing_events" CASCADE;

CREATE TABLE IF NOT EXISTS public."billing_events" (
  -- Primary Key
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "subscriptionId"        TEXT NOT NULL REFERENCES public."subscriptions"(id) ON DELETE CASCADE,

  -- Type and Status
  type                    TEXT NOT NULL CHECK (type IN ('payment', 'refund', 'invoice', 'credit', 'lifecycle')),
  status                  TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),

  -- Amount
  amount                  INTEGER NOT NULL, -- In cents
  currency                TEXT NOT NULL DEFAULT 'usd',

  -- External References
  "externalPaymentId"     TEXT,
  "invoiceUrl"            TEXT,
  "receiptUrl"            TEXT,

  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb,

  -- Timestamp (immutable, only createdAt)
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."billing_events"                     IS 'Payment transaction history and billing events';
COMMENT ON COLUMN public."billing_events"."subscriptionId"    IS 'Reference to subscription';
COMMENT ON COLUMN public."billing_events".type                IS 'Event type: payment, refund, invoice, credit, lifecycle';
COMMENT ON COLUMN public."billing_events".status              IS 'Event status: pending, succeeded, failed';
COMMENT ON COLUMN public."billing_events".amount              IS 'Amount in cents';
COMMENT ON COLUMN public."billing_events"."externalPaymentId" IS 'External payment provider ID (Stripe, Paddle, etc.)';
COMMENT ON COLUMN public."billing_events"."invoiceUrl"        IS 'URL to invoice document';
COMMENT ON COLUMN public."billing_events"."receiptUrl"        IS 'URL to receipt document';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id  ON public."billing_events"("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_billing_events_type             ON public."billing_events"(type);
CREATE INDEX IF NOT EXISTS idx_billing_events_status           ON public."billing_events"(status);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at       ON public."billing_events"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_external_id      ON public."billing_events"("externalPaymentId") WHERE "externalPaymentId" IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_created
ON public."billing_events"("subscriptionId", "createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."billing_events" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Billing events read"          ON public."billing_events";
DROP POLICY IF EXISTS "Billing events system write"  ON public."billing_events";

-- Only team owner/admin can view billing events
CREATE POLICY "Billing events read"
ON public."billing_events"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."subscriptions" s
    JOIN public."team_members" tm ON tm."teamId" = s."teamId"
    WHERE s.id = "billing_events"."subscriptionId"
      AND tm."userId" = public.get_auth_user_id()
      AND tm.role IN ('owner', 'admin')
  )
);

-- System can write (webhooks from payment providers)
CREATE POLICY "Billing events system write"
ON public."billing_events"
FOR INSERT TO authenticated
WITH CHECK (true);
