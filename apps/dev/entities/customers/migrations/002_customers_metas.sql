-- Migration: 002_customers_metas.sql
-- Description: Customers metas (table, indexes, RLS)
-- Date: 2025-01-24
-- Updated: 2025-11-26 (Phase 2 - Team Isolation via parent)

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."customers_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."customers"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."customers_metas"                   IS 'Customers metadata table - stores additional key-value pairs for customers';
COMMENT ON COLUMN public."customers_metas"."entityId"        IS 'Generic foreign key to parent customer entity';
COMMENT ON COLUMN public."customers_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."customers_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."customers_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."customers_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."customers_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS customers_metas_set_updated_at ON public."customers_metas";
CREATE TRIGGER customers_metas_set_updated_at
BEFORE UPDATE ON public."customers_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customers_metas_customer_id      ON public."customers_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_customers_metas_key              ON public."customers_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_customers_metas_composite        ON public."customers_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_customers_metas_is_public        ON public."customers_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_customers_metas_is_searchable    ON public."customers_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_customers_metas_searchable_key   ON public."customers_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_customers_metas_value_gin        ON public."customers_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_customers_metas_value_ops        ON public."customers_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."customers_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view own customer metas"              ON public."customers_metas";
DROP POLICY IF EXISTS "Users can insert customer metas"                ON public."customers_metas";
DROP POLICY IF EXISTS "Users can insert own customer metas"            ON public."customers_metas";
DROP POLICY IF EXISTS "Users can update own customer metas"            ON public."customers_metas";
DROP POLICY IF EXISTS "Users can delete own customer metas"            ON public."customers_metas";
DROP POLICY IF EXISTS "Customer metas auth can do all"                 ON public."customers_metas";
DROP POLICY IF EXISTS "Customer metas team can do all"                 ON public."customers_metas";

-- ============================
-- RLS: TEAM ISOLATION VIA PARENT
-- ============================
-- Hereda el aislamiento del parent customer via teamId
-- La lógica de access.shared se maneja a NIVEL APP
CREATE POLICY "Customer metas team can do all"
ON public."customers_metas"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation via parent customer
  EXISTS (
    SELECT 1 FROM public."customers" c
    WHERE c.id = "entityId"
      AND c."teamId" = ANY(public.get_user_team_ids())
  )
)
WITH CHECK (
  public.is_superadmin()
  OR
  EXISTS (
    SELECT 1 FROM public."customers" c
    WHERE c.id = "entityId"
      AND c."teamId" = ANY(public.get_user_team_ids())
  )
);