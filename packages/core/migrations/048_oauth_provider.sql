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
    'oauthRefreshToken', 'oauthAccessToken', 'oauthConsent', 'oauthClientAssertion'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' service all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_bypass_rls()) WITH CHECK (public.can_bypass_rls())',
      t || ' service all', t
    );
  END LOOP;
END $$;
