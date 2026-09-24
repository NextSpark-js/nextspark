-- Migration: 002_opportunities_metas.sql
-- Description: Contacts metas (table, indexes, RLS)
-- Date: 2025-09-27

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."opportunities_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."opportunities"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."opportunities_metas"                   IS 'Contacts metadata table - stores additional key-value pairs for opportunities';
COMMENT ON COLUMN public."opportunities_metas"."entityId"        IS 'Generic foreign key to parent opportunitie entity';
COMMENT ON COLUMN public."opportunities_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."opportunities_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."opportunities_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."opportunities_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."opportunities_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS opportunities_metas_set_updated_at ON public."opportunities_metas";
CREATE TRIGGER opportunities_metas_set_updated_at
BEFORE UPDATE ON public."opportunities_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_entity_id         ON public."opportunities_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_key               ON public."opportunities_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_composite         ON public."opportunities_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_is_public         ON public."opportunities_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_is_searchable     ON public."opportunities_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_searchable_key    ON public."opportunities_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_value_gin         ON public."opportunities_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_opportunities_metas_value_ops         ON public."opportunities_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."opportunities_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view opportunitie metas"     ON public."opportunities_metas";
DROP POLICY IF EXISTS "Users can create opportunitie metas"   ON public."opportunities_metas";
DROP POLICY IF EXISTS "Users can update opportunitie metas"   ON public."opportunities_metas";
DROP POLICY IF EXISTS "Users can delete opportunitie metas"   ON public."opportunities_metas";

-- ============================
-- AUTHENTICATED USER POLICIES
-- ============================
-- Inherit permissions from parent entity
CREATE POLICY "Users can view opportunitie metas"
ON public."opportunities_metas"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."opportunities" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can create opportunitie metas"
ON public."opportunities_metas"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."opportunities" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can update opportunitie metas"
ON public."opportunities_metas"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."opportunities" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."opportunities" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can delete opportunitie metas"
ON public."opportunities_metas"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."opportunities" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);