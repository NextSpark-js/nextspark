-- Migration: 006_api_keys.sql
-- Description: API keys core (tabla, índices, RLS)

-- Enum (idempotente)
DO $$ BEGIN
  CREATE TYPE api_key_status AS ENUM ('active','inactive','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla
CREATE TABLE IF NOT EXISTS "api_key" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "keyHash" TEXT UNIQUE NOT NULL,          -- SHA-256 del secreto
  "keyPrefix" TEXT NOT NULL,               -- primeros 16 chars para búsqueda
  name TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "lastUsedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  status api_key_status DEFAULT 'active',
  scopes TEXT[] DEFAULT '{}',
  "failedAttempts" INTEGER DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "ipWhitelist" TEXT[],
  "lastUsedIp" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_key_hash          ON "api_key"("keyHash");
CREATE INDEX IF NOT EXISTS idx_api_key_user          ON "api_key"("userId");
CREATE INDEX IF NOT EXISTS idx_api_key_prefix        ON "api_key"("keyPrefix");
CREATE INDEX IF NOT EXISTS idx_api_key_status        ON "api_key"(status);
CREATE INDEX IF NOT EXISTS idx_api_key_expires       ON "api_key"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_api_key_failed        ON "api_key"("failedAttempts");
CREATE INDEX IF NOT EXISTS idx_api_key_locked_until  ON "api_key"("lockedUntil");

-- RLS
ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;

-- Políticas
-- 1) Dueño o admin pueden hacer TODO
CREATE POLICY "API key owner or admin can do all" ON "api_key"
  FOR ALL TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR EXISTS (SELECT 1 FROM "users" u
               WHERE u.id = public.get_auth_user_id()
                 AND u.role IN ('admin','superadmin'))
  )
  WITH CHECK (
    "userId" = public.get_auth_user_id()
    OR EXISTS (SELECT 1 FROM "users" u
               WHERE u.id = public.get_auth_user_id()
                 AND u.role IN ('admin','superadmin'))
  );

-- Si ya tenías esta, déjala, pero es redundante con la de arriba:
-- CREATE POLICY "Admins can manage api keys" ON "api_key"
--   FOR ALL USING (EXISTS (SELECT 1 FROM "users"
--                          WHERE id = public.get_auth_user_id()
--                            AND role IN ('admin','superadmin')));

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS trigger_api_key_updated_at ON "api_key";
CREATE TRIGGER api_key_set_updated_at
BEFORE UPDATE ON "api_key"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Opcional muy recomendado:
-- 1) REVOKE SELECT sobre la tabla base para roles no-admin
-- 2) Crear una VIEW que no expone "keyHash" y dar SELECT a authenticated
-- Ejemplo:
-- CREATE OR REPLACE VIEW public.api_key_list AS
--   SELECT id, "keyPrefix", name, "userId", "lastUsedAt", "expiresAt",
--          status, scopes, "failedAttempts", "lockedUntil",
--          "ipWhitelist", "lastUsedIp", "createdAt", "updatedAt"
--   FROM "api_key";
-- GRANT SELECT ON public.api_key_list TO authenticated;