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

-- Mantener comportamiento actual (abierto). No es lo ideal, pero respeta "que siga funcionando".
CREATE POLICY "users_allow_all"        ON "users"        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "session_allow_all"      ON "session"      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "account_allow_all"      ON "account"      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "verification_allow_all" ON "verification" FOR ALL USING (true) WITH CHECK (true);

-- VERSIÓN MÁS SEGURA (recomendada) – comentar lo de arriba y descomentar esto cuando ordenes acceso:
-- Nota: el role service_role bypassa RLS. Si solo accede backend, podrías no necesitar policies.
-- CREATE POLICY "auth_tables_readonly_auth" ON "users" FOR SELECT TO authenticated USING (true);
-- Repite granular por tabla según necesidad real.

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