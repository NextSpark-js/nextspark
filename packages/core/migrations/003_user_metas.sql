-- Migration: 003_user_metas.sql
-- Description: Tabla users_metas + índices + RLS (owner/admin)
-- Date: 2025-01-19

-- ============================================
-- TABLA
-- ============================================
CREATE TABLE IF NOT EXISTS "users_metas" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  "isSearchable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_metas_unique_key UNIQUE ("userId","metaKey")
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_metas_user_id         ON "users_metas"("userId");
CREATE INDEX IF NOT EXISTS idx_users_metas_key             ON "users_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_users_metas_composite       ON "users_metas"("userId","metaKey","isPublic");
CREATE INDEX IF NOT EXISTS idx_users_metas_searchable      ON "users_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_users_metas_public          ON "users_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_users_metas_searchable_key  ON "users_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_users_metas_value_gin       ON "users_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_users_metas_value_ops       ON "users_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "users_metas" ENABLE ROW LEVEL SECURITY;

-- Dueño o admin pueden hacer TODO
CREATE POLICY "users_metas_owner_or_admin_all" ON "users_metas"
  FOR ALL
  TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR EXISTS (
      SELECT 1 FROM "users"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin','superadmin')
    )
  )
  WITH CHECK (
    "userId" = public.get_auth_user_id()
    OR EXISTS (
      SELECT 1 FROM "users"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin','superadmin')
    )
  );

-- Lectura pública de metas marcadas como públicas, sin filtrar por dueño
CREATE POLICY users_metas_public_read ON "users_metas"
  FOR SELECT TO anon
  USING ("isPublic" = TRUE);

-- ============================================
-- TRIGGER updatedAt
-- ============================================
DROP TRIGGER IF EXISTS users_metas_set_updated_at ON "users_metas";
CREATE TRIGGER users_metas_set_updated_at
BEFORE UPDATE ON "users_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();