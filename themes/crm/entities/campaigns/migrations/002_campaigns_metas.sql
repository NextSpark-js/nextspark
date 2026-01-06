-- Migration: 002_campaigns_metas.sql
-- Description: Contacts metas (table, indexes, RLS)
-- Date: 2025-09-27

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."campaigns_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."campaigns"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."campaigns_metas"                   IS 'Contacts metadata table - stores additional key-value pairs for campaigns';
COMMENT ON COLUMN public."campaigns_metas"."entityId"        IS 'Generic foreign key to parent campaign entity';
COMMENT ON COLUMN public."campaigns_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."campaigns_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."campaigns_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."campaigns_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."campaigns_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS campaigns_metas_set_updated_at ON public."campaigns_metas";
CREATE TRIGGER campaigns_metas_set_updated_at
BEFORE UPDATE ON public."campaigns_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_entity_id         ON public."campaigns_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_key               ON public."campaigns_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_composite         ON public."campaigns_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_is_public         ON public."campaigns_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_is_searchable     ON public."campaigns_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_searchable_key    ON public."campaigns_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_value_gin         ON public."campaigns_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_campaigns_metas_value_ops         ON public."campaigns_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."campaigns_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view campaign metas"     ON public."campaigns_metas";
DROP POLICY IF EXISTS "Users can create campaign metas"   ON public."campaigns_metas";
DROP POLICY IF EXISTS "Users can update campaign metas"   ON public."campaigns_metas";
DROP POLICY IF EXISTS "Users can delete campaign metas"   ON public."campaigns_metas";

-- ============================
-- AUTHENTICATED USER POLICIES
-- ============================
-- Inherit permissions from parent entity
CREATE POLICY "Users can view campaign metas"
ON public."campaigns_metas"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."campaigns" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can create campaign metas"
ON public."campaigns_metas"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."campaigns" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can update campaign metas"
ON public."campaigns_metas"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."campaigns" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."campaigns" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can delete campaign metas"
ON public."campaigns_metas"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."campaigns" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);