-- Migration: 007_api_audit_log.sql
-- Description: API audit logs (tabla, índices, RLS)

CREATE TABLE IF NOT EXISTS "api_audit_log" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "apiKeyId" TEXT NOT NULL REFERENCES public."api_key"(id) ON DELETE CASCADE,
  "userId"   TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  method     TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "requestBody" JSONB,
  "responseTime" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_audit_key      ON "api_audit_log"("apiKeyId");
CREATE INDEX IF NOT EXISTS idx_api_audit_user     ON "api_audit_log"("userId");
CREATE INDEX IF NOT EXISTS idx_api_audit_endpoint ON "api_audit_log"(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_audit_created  ON "api_audit_log"("createdAt");
CREATE INDEX IF NOT EXISTS idx_api_audit_status   ON "api_audit_log"("statusCode");
CREATE INDEX IF NOT EXISTS idx_api_audit_ip       ON "api_audit_log"("ipAddress");

-- RLS
ALTER TABLE "api_audit_log" ENABLE ROW LEVEL SECURITY;

-- Lectura: dueño de la key ve sus logs
CREATE POLICY "API logs owner can select" ON "api_audit_log"
  FOR SELECT TO authenticated
  USING ("userId" = public.get_auth_user_id());

-- Lectura: superadmin ve todo
CREATE POLICY "API logs superadmin can select" ON "api_audit_log"
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "users"
            WHERE id = public.get_auth_user_id()
              AND role = 'superadmin')
  );

-- IP whitelist opcional (si la mantenés, que complemente, no contradiga)
-- CREATE POLICY "api_logs_owner_ip_filter" ON "api_audit_log"
--   FOR SELECT TO authenticated
--   USING (
--     "userId" = public.get_auth_user_id()
--     AND NOT EXISTS (
--       SELECT 1 FROM "api_key" k
--       WHERE k.id = "apiKeyId"
--         AND k."ipWhitelist" IS NOT NULL
--         AND array_length(k."ipWhitelist", 1) > 0
--         AND NOT ("ipAddress" = ANY(k."ipWhitelist"))
--     )
--   );

-- Inserción de logs:
-- NO crees policy de INSERT si el backend usa service_role (bypassa RLS).
-- Si querés insertar con RLS, usá una función SECURITY DEFINER controlada:
-- CREATE OR REPLACE FUNCTION public.write_api_log(_apiKeyId text, ...) RETURNS void
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ ... $$;
-- GRANT EXECUTE ON FUNCTION public.write_api_log(...) TO authenticated;