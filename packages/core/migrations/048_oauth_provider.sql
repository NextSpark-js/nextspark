-- Migration: 048_oauth_provider.sql
-- Description: tables of the OAuth 2.1 authorization server that signs MCP clients in
--              through the browser (Better Auth `jwt()`, `@better-auth/mcp`, `@better-auth/cimd`).
-- Issue: #541 (spike)
--
-- The tables exist whether or not `MCP_OAUTH_ENABLED` is on; nothing reads or writes them
-- while it is off. Names and column types are the ones Better Auth 1.7.27 expects for this
-- instance (`string[]` and `json` are JSONB, `date` is TIMESTAMPTZ, ids are TEXT that Better
-- Auth generates), with `users` as the physical user table.
--
-- RLS: the authorization server reads and writes these tables with no user GUC (discovery,
-- token and refresh calls carry no session), so it runs on the SERVICE connection like the
-- other auth tables (002). Every policy is service-only: `jwks` holds the signing private
-- key and the token tables hold credentials.

--
-- `oauthAccessToken.token` is NOT NULL: Better Auth 1.7.27 declares the field without `required: false`, which is
-- required, and its migration planner reports a nullable column there as drift.
--
-- Additive only: no existing table changes; two triggers on existing tables (account, users). Undoing it is
-- dropping the four triggers and their two functions, then the ten tables (in reverse order of creation), which
-- signs every MCP client out and makes them authorize again.

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public."jwks" (
  id            TEXT PRIMARY KEY,
  "publicKey"   TEXT NOT NULL,
  "privateKey"  TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL,
  "expiresAt"   TIMESTAMPTZ,
  alg           TEXT,
  crv           TEXT
);

CREATE TABLE IF NOT EXISTS public."oauthClient" (
  id                                  TEXT PRIMARY KEY,
  "clientId"                          TEXT NOT NULL UNIQUE,
  "clientSecret"                      TEXT,
  "clientDiscoveryId"                 TEXT,
  disabled                            BOOLEAN DEFAULT false,
  "skipConsent"                       BOOLEAN,
  "enableEndSession"                  BOOLEAN,
  "subjectType"                       TEXT,
  scopes                              JSONB,
  "clientCredentialsScopes"           JSONB DEFAULT '[]'::jsonb,
  "userId"                            TEXT REFERENCES public."users"(id) ON DELETE CASCADE,
  "createdAt"                         TIMESTAMPTZ,
  "updatedAt"                         TIMESTAMPTZ,
  name                                TEXT,
  uri                                 TEXT,
  icon                                TEXT,
  contacts                            JSONB,
  tos                                 TEXT,
  policy                              TEXT,
  "softwareId"                        TEXT,
  "softwareVersion"                   TEXT,
  "softwareStatement"                 TEXT,
  "redirectUris"                      JSONB NOT NULL,
  "postLogoutRedirectUris"            JSONB,
  "backchannelLogoutUri"              TEXT,
  "backchannelLogoutSessionRequired"  BOOLEAN,
  "tokenEndpointAuthMethod"           TEXT,
  "applicationType"                   TEXT,
  jwks                                TEXT,
  "jwksUri"                           TEXT,
  "grantTypes"                        JSONB,
  "responseTypes"                     JSONB,
  "requirePKCE"                       BOOLEAN,
  "dpopBoundAccessTokens"             BOOLEAN DEFAULT false,
  "referenceId"                       TEXT,
  metadata                            JSONB
);

CREATE TABLE IF NOT EXISTS public."oauthResource" (
  id                               TEXT PRIMARY KEY,
  identifier                       TEXT NOT NULL UNIQUE,
  name                             TEXT NOT NULL,
  "accessTokenTtl"                 INTEGER,
  "refreshTokenTtl"                INTEGER,
  "signingAlgorithm"               TEXT,
  "signingKeyId"                   TEXT,
  "allowedScopes"                  JSONB,
  "customClaims"                   JSONB,
  "dpopBoundAccessTokensRequired"  BOOLEAN DEFAULT false,
  disabled                         BOOLEAN DEFAULT false,
  "createdAt"                      TIMESTAMPTZ,
  "updatedAt"                      TIMESTAMPTZ,
  "policyVersion"                  INTEGER DEFAULT 1,
  metadata                         JSONB
);

CREATE TABLE IF NOT EXISTS public."oauthClientResource" (
  id            TEXT PRIMARY KEY,
  "clientId"    TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "resourceId"  TEXT NOT NULL REFERENCES public."oauthResource"(identifier) ON DELETE CASCADE,
  metadata      JSONB,
  "createdAt"   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public."oauthRefreshToken" (
  id                         TEXT PRIMARY KEY,
  token                      TEXT NOT NULL UNIQUE,
  "clientId"                 TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "sessionId"                TEXT REFERENCES public."session"(id) ON DELETE SET NULL,
  "userId"                   TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "referenceId"              TEXT,
  "authorizationCodeId"      TEXT,
  resources                  JSONB,
  "requestedUserInfoClaims"  JSONB,
  "expiresAt"                TIMESTAMPTZ NOT NULL,
  "createdAt"                TIMESTAMPTZ NOT NULL,
  revoked                    TIMESTAMPTZ,
  "rotatedAt"                TIMESTAMPTZ,
  "rotationReplayResponse"   TEXT,
  "rotationReplayExpiresAt"  TIMESTAMPTZ,
  "authTime"                 TIMESTAMPTZ,
  confirmation               JSONB,
  scopes                     JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public."oauthAccessToken" (
  id                         TEXT PRIMARY KEY,
  token                      TEXT NOT NULL UNIQUE,
  "clientId"                 TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "sessionId"                TEXT REFERENCES public."session"(id) ON DELETE SET NULL,
  "userId"                   TEXT REFERENCES public."users"(id) ON DELETE CASCADE,
  "referenceId"              TEXT,
  "authorizationCodeId"      TEXT,
  resources                  JSONB,
  "requestedUserInfoClaims"  JSONB,
  "refreshId"                TEXT REFERENCES public."oauthRefreshToken"(id) ON DELETE CASCADE,
  "expiresAt"                TIMESTAMPTZ NOT NULL,
  "createdAt"                TIMESTAMPTZ NOT NULL,
  revoked                    TIMESTAMPTZ,
  confirmation               JSONB,
  scopes                     JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public."oauthConsent" (
  id                         TEXT PRIMARY KEY,
  "clientId"                 TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "userId"                   TEXT REFERENCES public."users"(id) ON DELETE CASCADE,
  "referenceId"              TEXT,
  resources                  JSONB,
  "requestedUserInfoClaims"  JSONB,
  scopes                     JSONB NOT NULL,
  "createdAt"                TIMESTAMPTZ NOT NULL,
  "updatedAt"                TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public."oauthClientAssertion" (
  id           TEXT PRIMARY KEY,
  "expiresAt"  TIMESTAMPTZ NOT NULL
);

-- The team a user in several teams picked for the authorization in progress (lib/mcp/oauth/team-selection): one row
-- per browser session, read back as the consent's reference. Ours, not Better Auth's.
CREATE TABLE IF NOT EXISTS public."oauthTeamSelection" (
  "sessionId"  TEXT PRIMARY KEY REFERENCES public."session"(id) ON DELETE CASCADE,
  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- The name Better Auth's own migration planner gives it: one link per client and resource
CREATE UNIQUE INDEX IF NOT EXISTS "oauthClientResource_clientId_resourceId_uidx" ON public."oauthClientResource"("clientId", "resourceId");
CREATE INDEX IF NOT EXISTS idx_oauth_client_user             ON public."oauthClient"("userId");
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_token_client    ON public."oauthRefreshToken"("clientId");
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_token_session   ON public."oauthRefreshToken"("sessionId");
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_token_user      ON public."oauthRefreshToken"("userId");
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_token_code      ON public."oauthRefreshToken"("authorizationCodeId");
CREATE INDEX IF NOT EXISTS idx_oauth_access_token_client     ON public."oauthAccessToken"("clientId");
CREATE INDEX IF NOT EXISTS idx_oauth_access_token_session    ON public."oauthAccessToken"("sessionId");
CREATE INDEX IF NOT EXISTS idx_oauth_access_token_user       ON public."oauthAccessToken"("userId");
CREATE INDEX IF NOT EXISTS idx_oauth_access_token_code       ON public."oauthAccessToken"("authorizationCodeId");
CREATE INDEX IF NOT EXISTS idx_oauth_access_token_refresh    ON public."oauthAccessToken"("refreshId");
CREATE INDEX IF NOT EXISTS idx_oauth_consent_client          ON public."oauthConsent"("clientId");
CREATE INDEX IF NOT EXISTS idx_oauth_consent_user            ON public."oauthConsent"("userId");
CREATE INDEX IF NOT EXISTS idx_oauth_client_assertion_expiry ON public."oauthClientAssertion"("expiresAt");

-- ============================================
-- RLS: service-only on every table
-- ============================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'jwks', 'oauthClient', 'oauthResource', 'oauthClientResource',
    'oauthRefreshToken', 'oauthAccessToken', 'oauthConsent', 'oauthClientAssertion', 'oauthTeamSelection'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' service all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_bypass_rls()) WITH CHECK (public.can_bypass_rls())',
      t || ' service all', t
    );
  END LOOP;
END $$;

-- ============================================
-- REVOCATION: ended connections, recorded where every instance reads them
-- ============================================
-- An access token is a signed JWT that lives ten minutes; a revocation must not wait for that. Each event that ends
-- a connection leaves a numbered row here. A token carries the number of the newest row that covered its user and
-- team when it was issued, and /api/mcp refuses it once a newer one exists (lib/mcp/oauth/revocation): no clock is
-- compared. A row with no team covers every connection of the user. The client is kept for the record.
--
-- The rows are written by triggers, so they hold on every instance and for every path, Better Auth's included:
--   - a refresh token revoked or deleted while it was live: the revocation endpoint, a detected reuse of a rotated
--     token, a replayed authorization code, a disconnect. A rotation is not one: it marks the old token rotated.
--   - a changed password (change, reset, an administrator's write) and a suspension: every connection of the user,
--     whose refresh tokens are revoked as well.
CREATE TABLE IF NOT EXISTS public."oauthRevocation" (
  id           BIGSERIAL PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "clientId"   TEXT,
  "teamId"     TEXT,
  "revokedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_revocation_user ON public."oauthRevocation"("userId", id);
ALTER TABLE public."oauthRevocation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oauthRevocation service all" ON public."oauthRevocation";
CREATE POLICY "oauthRevocation service all" ON public."oauthRevocation"
  FOR ALL TO authenticated USING (public.can_bypass_rls()) WITH CHECK (public.can_bypass_rls());

CREATE OR REPLACE FUNCTION public.record_oauth_connection_revoked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- a live token removed; an expired or already revoked one is housekeeping
    IF OLD.revoked IS NULL AND OLD."expiresAt" > now() THEN
      INSERT INTO public."oauthRevocation" ("userId", "clientId", "teamId") VALUES (OLD."userId", OLD."clientId", OLD."referenceId");
    END IF;
    RETURN OLD;
  END IF;
  INSERT INTO public."oauthRevocation" ("userId", "clientId", "teamId") VALUES (NEW."userId", NEW."clientId", NEW."referenceId");
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS oauth_refresh_token_revoked ON public."oauthRefreshToken";
CREATE TRIGGER oauth_refresh_token_revoked
  AFTER UPDATE OF revoked ON public."oauthRefreshToken"
  FOR EACH ROW
  WHEN (OLD.revoked IS NULL AND NEW.revoked IS NOT NULL AND NEW."rotatedAt" IS NULL)
  EXECUTE FUNCTION public.record_oauth_connection_revoked();

DROP TRIGGER IF EXISTS oauth_refresh_token_deleted ON public."oauthRefreshToken";
CREATE TRIGGER oauth_refresh_token_deleted
  AFTER DELETE ON public."oauthRefreshToken"
  FOR EACH ROW
  EXECUTE FUNCTION public.record_oauth_connection_revoked();

CREATE OR REPLACE FUNCTION public.revoke_oauth_connections_of_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target TEXT;
BEGIN
  IF TG_TABLE_NAME = 'account' THEN
    target := NEW."userId";
  ELSE
    target := NEW.id;
  END IF;
  -- rows no access token can still be older than (they live minutes), keeping the newest: it is the number new tokens carry
  DELETE FROM public."oauthRevocation"
   WHERE "userId" = target AND "revokedAt" < now() - interval '1 day'
     AND id < (SELECT MAX(id) FROM public."oauthRevocation" WHERE "userId" = target);
  INSERT INTO public."oauthRevocation" ("userId") VALUES (target);
  UPDATE public."oauthRefreshToken" SET revoked = now() WHERE "userId" = target AND revoked IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS oauth_revoke_on_password_change ON public."account";
CREATE TRIGGER oauth_revoke_on_password_change
  AFTER UPDATE OF password ON public."account"
  FOR EACH ROW
  WHEN (OLD.password IS DISTINCT FROM NEW.password)
  EXECUTE FUNCTION public.revoke_oauth_connections_of_user();

DROP TRIGGER IF EXISTS oauth_revoke_on_suspension ON public."users";
CREATE TRIGGER oauth_revoke_on_suspension
  AFTER UPDATE OF role ON public."users"
  FOR EACH ROW
  WHEN (NEW.role = 'suspended' AND OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.revoke_oauth_connections_of_user();
