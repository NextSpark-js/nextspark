-- Migration: 002_activities_metas.sql
-- Description: Contacts metas (table, indexes, RLS)
-- Date: 2025-09-27

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."activities_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."activities"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activities_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."activities_metas"                   IS 'Contacts metadata table - stores additional key-value pairs for activities';
COMMENT ON COLUMN public."activities_metas"."entityId"        IS 'Generic foreign key to parent activitie entity';
COMMENT ON COLUMN public."activities_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."activities_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."activities_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."activities_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."activities_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS activities_metas_set_updated_at ON public."activities_metas";
CREATE TRIGGER activities_metas_set_updated_at
BEFORE UPDATE ON public."activities_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activities_metas_entity_id         ON public."activities_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_activities_metas_key               ON public."activities_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_activities_metas_composite         ON public."activities_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_activities_metas_is_public         ON public."activities_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_activities_metas_is_searchable     ON public."activities_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_activities_metas_searchable_key    ON public."activities_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_activities_metas_value_gin         ON public."activities_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_activities_metas_value_ops         ON public."activities_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."activities_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view activitie metas"     ON public."activities_metas";
DROP POLICY IF EXISTS "Users can create activitie metas"   ON public."activities_metas";
DROP POLICY IF EXISTS "Users can update activitie metas"   ON public."activities_metas";
DROP POLICY IF EXISTS "Users can delete activitie metas"   ON public."activities_metas";

-- ============================
-- AUTHENTICATED USER POLICIES
-- ============================
-- Inherit permissions from parent entity
CREATE POLICY "Users can view activitie metas"
ON public."activities_metas"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."activities" c
    WHERE c.id = activities_metas."entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can create activitie metas"
ON public."activities_metas"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."activities" c
    WHERE c.id = activities_metas."entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can update activitie metas"
ON public."activities_metas"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."activities" c
    WHERE c.id = activities_metas."entityId"
      AND c."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."activities" c
    WHERE c.id = activities_metas."entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can delete activitie metas"
ON public."activities_metas"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."activities" c
    WHERE c.id = activities_metas."entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);