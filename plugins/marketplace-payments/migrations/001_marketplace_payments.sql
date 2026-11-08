-- Migration: 001_marketplace_payments.sql
-- Description: Connected sellers, their encrypted provider tokens, split payments and OAuth states (#220).
--
-- Who reaches what, under RLS (the app connection):
-- - a team's owner and admins read its seller accounts and payments; a superadmin or developer reads every row;
-- - nobody writes through RLS: the routes check the permission and write on the service connection, and webhooks and
--   scheduled actions have no user;
-- - the token and OAuth state tables have no policy and no grant: only the service connection reaches them, so a
--   superadmin's session cannot read a seller's token either.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public."marketplace_accounts" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId"            TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  "providerAccountId" TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'restricted', 'disconnected')),
  "chargesEnabled"    BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled"    BOOLEAN NOT NULL DEFAULT false,
  country             TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_accounts_team_provider_key UNIQUE ("teamId", provider),
  CONSTRAINT marketplace_accounts_provider_account_key UNIQUE (provider, "providerAccountId")
);

COMMENT ON TABLE public."marketplace_accounts" IS 'A team connected as a seller with a payment provider';

CREATE TABLE IF NOT EXISTS public."marketplace_seller_credentials" (
  "accountId"       TEXT PRIMARY KEY REFERENCES public."marketplace_accounts"(id) ON DELETE CASCADE,
  "accessTokenEnc"  TEXT NOT NULL,
  "refreshTokenEnc" TEXT NOT NULL,
  "expiresAt"       TIMESTAMPTZ NOT NULL,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."marketplace_seller_credentials" IS 'A seller''s provider tokens, encrypted by the application; service connection only';

CREATE INDEX IF NOT EXISTS marketplace_seller_credentials_expires_idx
  ON public."marketplace_seller_credentials" ("expiresAt");

CREATE TABLE IF NOT EXISTS public."marketplace_payments" (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId"             TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "accountId"          TEXT NOT NULL REFERENCES public."marketplace_accounts"(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  "providerAccountId"  TEXT NOT NULL,
  "providerCheckoutId" TEXT,
  "providerPaymentId"  TEXT,
  "amountCents"        BIGINT NOT NULL CHECK ("amountCents" > 0),
  "commissionCents"    BIGINT NOT NULL CHECK ("commissionCents" >= 0 AND "commissionCents" <= "amountCents"),
  currency             TEXT NOT NULL,
  description          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'disputed')),
  "refundedCents"      BIGINT NOT NULL DEFAULT 0 CHECK ("refundedCents" >= 0),
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."marketplace_payments" IS 'A payment split between the platform and a seller; the amounts were computed on the server';

CREATE INDEX IF NOT EXISTS marketplace_payments_team_created_idx
  ON public."marketplace_payments" ("teamId", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_payments_provider_payment_key
  ON public."marketplace_payments" (provider, "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."marketplace_oauth_states" (
  "stateHash" TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"    TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public."marketplace_oauth_states" IS 'One-use OAuth states, stored as a hash and bound to the user and team that started the flow';

ALTER TABLE public."marketplace_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketplace_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketplace_seller_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketplace_oauth_states" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_accounts_select_policy" ON public."marketplace_accounts";
CREATE POLICY "marketplace_accounts_select_policy" ON public."marketplace_accounts"
  FOR SELECT TO authenticated
  USING ((SELECT public.can_bypass_rls()) OR public.auth_team_role("teamId") IN ('owner', 'admin'));

DROP POLICY IF EXISTS "marketplace_payments_select_policy" ON public."marketplace_payments";
CREATE POLICY "marketplace_payments_select_policy" ON public."marketplace_payments"
  FOR SELECT TO authenticated
  USING ((SELECT public.can_bypass_rls()) OR public.auth_team_role("teamId") IN ('owner', 'admin'));

-- Migration 022's default privileges grant new tables to the runtime roles. These two stay out of their reach.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextspark_app') THEN
    REVOKE ALL ON public."marketplace_seller_credentials", public."marketplace_oauth_states" FROM nextspark_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."marketplace_seller_credentials", public."marketplace_oauth_states" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."marketplace_seller_credentials", public."marketplace_oauth_states" FROM anon;
  END IF;
END $$;
