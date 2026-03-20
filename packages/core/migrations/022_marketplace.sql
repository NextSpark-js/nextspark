-- Migration: 022_marketplace.sql
-- Description: Marketplace / Payment Splitting (connected accounts, payments, webhook events)
-- Date: 2026-03-19
-- NOTE: This module is PARALLEL to billing (subscriptions).
--   billing = SaaS subscription (business pays platform)
--   marketplace = payment splitting (customer pays, platform takes commission)

-- ============================================
-- TABLE: connectedAccounts
-- Merchant accounts connected via Stripe Connect or MercadoPago OAuth
-- ============================================
DROP TABLE IF EXISTS public."connectedAccounts" CASCADE;

CREATE TABLE IF NOT EXISTS public."connectedAccounts" (
  -- Primary Key
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "teamId"                   TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Provider
  provider                   TEXT NOT NULL CHECK (provider IN ('stripe_connect', 'mercadopago_split')),
  "externalAccountId"        TEXT NOT NULL,

  -- Business Info
  email                      TEXT NOT NULL DEFAULT '',
  "businessName"             TEXT,
  country                    TEXT NOT NULL DEFAULT 'US',
  currency                   TEXT NOT NULL DEFAULT 'usd',

  -- Onboarding Status
  "onboardingStatus"         TEXT NOT NULL DEFAULT 'pending' CHECK (
    "onboardingStatus" IN ('pending', 'in_progress', 'active', 'restricted', 'disabled', 'disconnected')
  ),
  "chargesEnabled"           BOOLEAN NOT NULL DEFAULT FALSE,
  "payoutsEnabled"           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Commission
  "commissionRate"           NUMERIC(5,4) NOT NULL DEFAULT 0.1500,
  "fixedFee"                 INTEGER NOT NULL DEFAULT 0,

  -- Payout Configuration
  "payoutSchedule"           TEXT NOT NULL DEFAULT 'weekly' CHECK (
    "payoutSchedule" IN ('daily', 'weekly', 'monthly', 'manual')
  ),

  -- Metadata (stores provider-specific data like MP tokens)
  metadata                   JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One connected account per team
CREATE UNIQUE INDEX "idx_connectedAccounts_teamId" ON public."connectedAccounts"("teamId");
-- Lookup by external account ID
CREATE UNIQUE INDEX "idx_connectedAccounts_externalAccountId" ON public."connectedAccounts"("externalAccountId");

COMMENT ON TABLE  public."connectedAccounts"                            IS 'Merchant accounts connected via Stripe Connect or MercadoPago OAuth';
COMMENT ON COLUMN public."connectedAccounts"."teamId"                   IS 'Team that owns this connected account';
COMMENT ON COLUMN public."connectedAccounts".provider                   IS 'Payment provider: stripe_connect, mercadopago_split';
COMMENT ON COLUMN public."connectedAccounts"."externalAccountId"        IS 'Provider account ID (acct_xxx for Stripe, user_id for MP)';
COMMENT ON COLUMN public."connectedAccounts"."onboardingStatus"         IS 'Onboarding state: pending, in_progress, active, restricted, disabled, disconnected';
COMMENT ON COLUMN public."connectedAccounts"."commissionRate"           IS 'Platform commission rate (0.1500 = 15%)';
COMMENT ON COLUMN public."connectedAccounts"."fixedFee"                 IS 'Fixed fee per transaction in smallest currency unit';

-- ============================================
-- TABLE: marketplacePayments
-- Split payments between platform and connected accounts
-- ============================================
DROP TABLE IF EXISTS public."marketplacePayments" CASCADE;

CREATE TABLE IF NOT EXISTS public."marketplacePayments" (
  -- Primary Key
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Foreign Keys
  "connectedAccountId"       TEXT NOT NULL REFERENCES public."connectedAccounts"(id) ON DELETE RESTRICT,
  "teamId"                   TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Reference (booking, order, etc.)
  "referenceId"              TEXT NOT NULL,
  "referenceType"            TEXT NOT NULL DEFAULT 'booking',

  -- Provider Data
  "externalPaymentId"        TEXT NOT NULL,
  "externalChargeId"         TEXT,
  "externalTransferId"       TEXT,

  -- Amounts (in smallest currency unit: cents for USD, full units for ARS/BRL/MXN)
  "totalAmount"              INTEGER NOT NULL,
  "applicationFee"           INTEGER NOT NULL,
  "businessAmount"           INTEGER NOT NULL,
  "providerFee"              INTEGER,
  currency                   TEXT NOT NULL DEFAULT 'usd',
  "commissionRate"           NUMERIC(5,4) NOT NULL,

  -- Status
  status                     TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'canceled')
  ),
  "statusDetail"             TEXT,
  "paymentMethod"            TEXT,
  "paymentType"              TEXT,

  -- Refunds
  "refundedAmount"           INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata                   JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  "paidAt"                   TIMESTAMPTZ,
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_marketplacePayments_connectedAccountId" ON public."marketplacePayments"("connectedAccountId");
CREATE INDEX "idx_marketplacePayments_teamId" ON public."marketplacePayments"("teamId");
CREATE INDEX "idx_marketplacePayments_referenceId" ON public."marketplacePayments"("referenceId");
CREATE INDEX "idx_marketplacePayments_externalPaymentId" ON public."marketplacePayments"("externalPaymentId");
CREATE INDEX "idx_marketplacePayments_status" ON public."marketplacePayments"("status");

COMMENT ON TABLE  public."marketplacePayments"                          IS 'Split payments between platform and connected merchant accounts';
COMMENT ON COLUMN public."marketplacePayments"."connectedAccountId"     IS 'Connected account receiving the payment';
COMMENT ON COLUMN public."marketplacePayments"."referenceId"            IS 'External reference (booking ID, order ID)';
COMMENT ON COLUMN public."marketplacePayments"."totalAmount"            IS 'Total amount paid by customer';
COMMENT ON COLUMN public."marketplacePayments"."applicationFee"         IS 'Platform commission amount';
COMMENT ON COLUMN public."marketplacePayments"."businessAmount"         IS 'Amount received by business (before provider fees)';

-- ============================================
-- TABLE: marketplaceWebhookEvents
-- Idempotency tracking for marketplace webhook events
-- ============================================
DROP TABLE IF EXISTS public."marketplaceWebhookEvents" CASCADE;

CREATE TABLE IF NOT EXISTS public."marketplaceWebhookEvents" (
  -- Primary Key
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Event Data
  provider                   TEXT NOT NULL CHECK (provider IN ('stripe_connect', 'mercadopago_split')),
  "externalEventId"          TEXT NOT NULL,
  "eventType"                TEXT NOT NULL,
  action                     TEXT NOT NULL DEFAULT '',
  "resourceId"               TEXT NOT NULL DEFAULT '',

  -- Processing
  processed                  BOOLEAN NOT NULL DEFAULT FALSE,
  "processedAt"              TIMESTAMPTZ,
  error                      TEXT,
  "rawPayload"               JSONB,

  -- Timestamps
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: one event per provider+externalEventId
CREATE UNIQUE INDEX "idx_marketplaceWebhookEvents_unique" ON public."marketplaceWebhookEvents"(provider, "externalEventId");
CREATE INDEX "idx_marketplaceWebhookEvents_resourceId" ON public."marketplaceWebhookEvents"("resourceId");

COMMENT ON TABLE  public."marketplaceWebhookEvents"                     IS 'Webhook event log for marketplace providers (idempotency)';

-- ============================================
-- RLS POLICIES
-- ============================================

-- connectedAccounts: team owner/admin can read, system can write
ALTER TABLE public."connectedAccounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connectedAccounts_team_read" ON public."connectedAccounts"
  FOR SELECT USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = (SELECT id FROM public."users" WHERE id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "connectedAccounts_system_write" ON public."connectedAccounts"
  FOR ALL USING (true) WITH CHECK (true);

-- marketplacePayments: team members can read, system can write
ALTER TABLE public."marketplacePayments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplacePayments_team_read" ON public."marketplacePayments"
  FOR SELECT USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = (SELECT id FROM public."users" WHERE id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "marketplacePayments_system_write" ON public."marketplacePayments"
  FOR ALL USING (true) WITH CHECK (true);

-- marketplaceWebhookEvents: system only (no user reads needed)
ALTER TABLE public."marketplaceWebhookEvents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplaceWebhookEvents_system" ON public."marketplaceWebhookEvents"
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "connectedAccounts_updated_at"
  BEFORE UPDATE ON public."connectedAccounts"
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();

CREATE TRIGGER "marketplacePayments_updated_at"
  BEFORE UPDATE ON public."marketplacePayments"
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();
