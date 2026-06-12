-- Migration: 002_auth_tables.sql
-- Description: Tablas de autenticación Better Auth + índices + RLS
-- Date: 2025-01-19
-- Updated: 2025-11-26 (Phase 2 - Simplified roles: member, superadmin)

-- Nota: si tus IDs son TEXT hoy, mantenelos acá para no romper nada.
-- Cuando migres a UUID, hacelo en otra migration.

-- ============================================
-- TABLAS
-- ============================================

CREATE TABLE IF NOT EXISTS "users" (
  id                TEXT PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  "emailVerified"   BOOLEAN DEFAULT false,
  name              TEXT, -- Required by Better Auth for OAuth
  "firstName"       TEXT,
  "lastName"        TEXT,
  image             TEXT,
  country           TEXT,
  timezone          TEXT,
  "language"        TEXT DEFAULT 'en', -- User preferred language
  "role"            TEXT DEFAULT 'member', -- User role: member (default), superadmin (bypass)
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create session table
CREATE TABLE IF NOT EXISTS "session" (
  id              TEXT PRIMARY KEY,
  "expiresAt"     TIMESTAMPTZ NOT NULL,
  token           TEXT UNIQUE NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "userId"        TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE
);

-- Create account table (for OAuth providers - Google only)
CREATE TABLE IF NOT EXISTS "account" (
  id                          TEXT PRIMARY KEY,
  "accountId"                 TEXT NOT NULL,
  "providerId"                TEXT NOT NULL,
  "userId"                    TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  "password"                  TEXT,
  "accessToken"               TEXT,
  "refreshToken"              TEXT,
  "idToken"                   TEXT,
  "accessTokenExpiresAt"      TIMESTAMPTZ,
  "refreshTokenExpiresAt"     TIMESTAMPTZ,
  scope                       TEXT,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("providerId", "accountId")
);

-- Create verification table (for email verification and password reset)
CREATE TABLE IF NOT EXISTS "verification" (
  id                      TEXT PRIMARY KEY,
  identifier              TEXT NOT NULL,
  value                   TEXT NOT NULL,
  "expiresAt"             TIMESTAMPTZ NOT NULL,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
-- Índices para tablas de auth
CREATE INDEX IF NOT EXISTS idx_users_email              ON "users"(email);
CREATE INDEX IF NOT EXISTS idx_users_name               ON "users"(name);
CREATE INDEX IF NOT EXISTS idx_users_firstname          ON "users"("firstName");
CREATE INDEX IF NOT EXISTS idx_users_country            ON "users"(country);
CREATE INDEX IF NOT EXISTS idx_users_timezone           ON "users"(timezone);
CREATE INDEX IF NOT EXISTS idx_users_language           ON "users"("language");
CREATE INDEX IF NOT EXISTS idx_users_role               ON "users"("role");
CREATE INDEX IF NOT EXISTS idx_session_token            ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_session_userId           ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_account_userId           ON "account"("userId");
CREATE INDEX IF NOT EXISTS idx_account_providerId       ON "account"("providerId", "accountId");
CREATE INDEX IF NOT EXISTS idx_verification_identifier  ON "verification"(identifier);

-- ============================================
-- RLS (habilitar)
-- ============================================

ALTER TABLE "users"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES
-- ============================================

-- ============================================================================
-- Per-user RLS on the auth/identity tables (hardened defaults).
--
-- Uses ONLY core primitives: public.can_bypass_rls() (010) and
-- public.get_auth_user_id() (001), and public."team_members". "Staff of a team"
-- is the base elevated set the core enum knows: ('owner','admin'). A theme that
-- extends team roles widens the staff set through its own config-derived
-- mechanism; the core ships the base elevated set only.
--
-- WHY: under real RLS, the previous `USING(true)` let ANY authenticated user read
-- every row of users (PII), account (Better Auth credentials/providers) and
-- session (other users' sessions/tokens).
--
-- SERVICE DEPENDENCY (not a data hole): Better Auth reads these tables WITHOUT a
-- user GUC during login/verification, so it runs under the SERVICE connection
-- (DATABASE_SERVICE_URL, bypass). With it, login works AND these policies stay
-- active.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users — self + staff visibility (no user sees unrelated users)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_allow_all"           ON "users";
DROP POLICY IF EXISTS "Users self and staff read" ON "users";
DROP POLICY IF EXISTS "Users service insert"      ON "users";
DROP POLICY IF EXISTS "Users self update"         ON "users";
DROP POLICY IF EXISTS "Users service delete"      ON "users";

-- Staff visibility is resolved by public.auth_user_can_see_user() (defined in
-- 001) so this policy has no create-time dependency on team_members (created in
-- a later migration).
CREATE POLICY "Users self and staff read"
ON "users"
FOR SELECT TO authenticated
USING (
  public.can_bypass_rls()
  OR id = public.get_auth_user_id()
  OR public.auth_user_can_see_user(id)
);

-- Identity is created/managed by the auth service; a user may edit ITS OWN row.
CREATE POLICY "Users service insert" ON "users"
FOR INSERT TO authenticated WITH CHECK (public.can_bypass_rls());
CREATE POLICY "Users self update" ON "users"
FOR UPDATE TO authenticated
USING (public.can_bypass_rls() OR id = public.get_auth_user_id())
WITH CHECK (public.can_bypass_rls() OR id = public.get_auth_user_id());
CREATE POLICY "Users service delete" ON "users"
FOR DELETE TO authenticated USING (public.can_bypass_rls());

-- ----------------------------------------------------------------------------
-- account — only the owner sees/uses its own auth accounts; writes are service
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "account_allow_all"      ON "account";
DROP POLICY IF EXISTS "Account self read"      ON "account";
DROP POLICY IF EXISTS "Account service write"  ON "account";

CREATE POLICY "Account self read" ON "account"
FOR SELECT TO authenticated
USING (public.can_bypass_rls() OR "userId" = public.get_auth_user_id());
CREATE POLICY "Account service write" ON "account"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());

-- ----------------------------------------------------------------------------
-- session — only the owner sees its own sessions; writes are service (login)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_allow_all"      ON "session";
DROP POLICY IF EXISTS "Session self read"      ON "session";
DROP POLICY IF EXISTS "Session service write"  ON "session";

CREATE POLICY "Session self read" ON "session"
FOR SELECT TO authenticated
USING (public.can_bypass_rls() OR "userId" = public.get_auth_user_id());
CREATE POLICY "Session service write" ON "session"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());

-- ----------------------------------------------------------------------------
-- verification — email/reset tokens (no userId); service-only under RLS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_allow_all"  ON "verification";
DROP POLICY IF EXISTS "Verification service all" ON "verification";

CREATE POLICY "Verification service all" ON "verification"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Add constraint to ensure only valid roles are used (member, superadmin, developer)
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS check_users_role;

  -- Add constraint with extensible roles (member, superadmin, developer)
  ALTER TABLE "users" ADD CONSTRAINT check_users_role
    CHECK ("role" IN ('member', 'superadmin', 'developer'));
END $$;

-- ============================================
-- TRIGGERS updatedAt
-- ============================================

DROP TRIGGER IF EXISTS users_set_updated_at ON "users";
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS session_set_updated_at ON "session";
CREATE TRIGGER session_set_updated_at
BEFORE UPDATE ON "session"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS account_set_updated_at ON "account";
CREATE TRIGGER account_set_updated_at
BEFORE UPDATE ON "account"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS verification_set_updated_at ON "verification";
CREATE TRIGGER verification_set_updated_at
BEFORE UPDATE ON "verification"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TRIGGER para sincronizar nombre completo
-- ============================================

-- Add trigger to automatically sync name field
DROP TRIGGER IF EXISTS trigger_sync_user_name ON "users";
CREATE TRIGGER trigger_sync_user_name
  BEFORE INSERT OR UPDATE OF "firstName", "lastName" ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_name();