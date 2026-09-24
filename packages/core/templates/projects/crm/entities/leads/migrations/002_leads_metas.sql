-- Migration: 002_leads_metas.sql
-- Description: Leads metas (table, indexes, RLS)
-- Date: 2025-09-27

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."leads_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."leads"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."leads_metas"                   IS 'Leads metadata table - stores additional key-value pairs for leads';
COMMENT ON COLUMN public."leads_metas"."entityId"        IS 'Generic foreign key to parent lead entity';
COMMENT ON COLUMN public."leads_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."leads_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."leads_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."leads_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."leads_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS leads_metas_set_updated_at ON public."leads_metas";
CREATE TRIGGER leads_metas_set_updated_at
BEFORE UPDATE ON public."leads_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_metas_entity_id         ON public."leads_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_leads_metas_key               ON public."leads_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_leads_metas_composite         ON public."leads_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_leads_metas_is_public         ON public."leads_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_leads_metas_is_searchable     ON public."leads_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_leads_metas_searchable_key    ON public."leads_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_leads_metas_value_gin         ON public."leads_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_leads_metas_value_ops         ON public."leads_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."leads_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view lead metas"     ON public."leads_metas";
DROP POLICY IF EXISTS "Users can create lead metas"   ON public."leads_metas";
DROP POLICY IF EXISTS "Users can update lead metas"   ON public."leads_metas";
DROP POLICY IF EXISTS "Users can delete lead metas"   ON public."leads_metas";

-- ============================
-- AUTHENTICATED USER POLICIES
-- ============================
-- Users can view metas for their own leads or assigned leads
CREATE POLICY "Users can view lead metas"
ON public."leads_metas"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."leads" l
    WHERE l.id = "entityId"
      AND (l."userId" = public.get_auth_user_id()
           OR l."assignedTo" = public.get_auth_user_id())
  )
);

-- Users can create metas for their own leads
CREATE POLICY "Users can create lead metas"
ON public."leads_metas"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."leads" l
    WHERE l.id = "entityId"
      AND l."userId" = public.get_auth_user_id()
  )
);

-- Users can update metas for their own leads or assigned leads
CREATE POLICY "Users can update lead metas"
ON public."leads_metas"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."leads" l
    WHERE l.id = "entityId"
      AND (l."userId" = public.get_auth_user_id()
           OR l."assignedTo" = public.get_auth_user_id())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."leads" l
    WHERE l.id = "entityId"
      AND (l."userId" = public.get_auth_user_id()
           OR l."assignedTo" = public.get_auth_user_id())
  )
);

-- Users can delete metas for their own leads
CREATE POLICY "Users can delete lead metas"
ON public."leads_metas"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."leads" l
    WHERE l.id = "entityId"
      AND l."userId" = public.get_auth_user_id()
  )
);