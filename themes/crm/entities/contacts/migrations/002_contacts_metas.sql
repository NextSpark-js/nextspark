-- Migration: 002_contacts_metas.sql
-- Description: Contacts metas (table, indexes, RLS)
-- Date: 2025-09-27

-- ============================================
-- TABLE
-- ============================================
-- No DROP needed - removed automatically by parent table CASCADE
CREATE TABLE IF NOT EXISTS public."contacts_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."contacts"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json',
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_metas_unique_key UNIQUE ("entityId", "metaKey")
);

COMMENT ON TABLE  public."contacts_metas"                   IS 'Contacts metadata table - stores additional key-value pairs for contacts';
COMMENT ON COLUMN public."contacts_metas"."entityId"        IS 'Generic foreign key to parent contact entity';
COMMENT ON COLUMN public."contacts_metas"."metaKey"         IS 'Metadata key name';
COMMENT ON COLUMN public."contacts_metas"."metaValue"       IS 'Metadata value as JSONB';
COMMENT ON COLUMN public."contacts_metas"."dataType"        IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."contacts_metas"."isPublic"        IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."contacts_metas"."isSearchable"    IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS contacts_metas_set_updated_at ON public."contacts_metas";
CREATE TRIGGER contacts_metas_set_updated_at
BEFORE UPDATE ON public."contacts_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_metas_entity_id         ON public."contacts_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_contacts_metas_key               ON public."contacts_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_contacts_metas_composite         ON public."contacts_metas"("entityId", "metaKey", "isPublic");
CREATE INDEX IF NOT EXISTS idx_contacts_metas_is_public         ON public."contacts_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_contacts_metas_is_searchable     ON public."contacts_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_contacts_metas_searchable_key    ON public."contacts_metas"("metaKey") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_contacts_metas_value_gin         ON public."contacts_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_contacts_metas_value_ops         ON public."contacts_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."contacts_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Users can view contact metas"     ON public."contacts_metas";
DROP POLICY IF EXISTS "Users can create contact metas"   ON public."contacts_metas";
DROP POLICY IF EXISTS "Users can update contact metas"   ON public."contacts_metas";
DROP POLICY IF EXISTS "Users can delete contact metas"   ON public."contacts_metas";

-- ============================
-- AUTHENTICATED USER POLICIES
-- ============================
-- Inherit permissions from parent entity
CREATE POLICY "Users can view contact metas"
ON public."contacts_metas"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."contacts" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can create contact metas"
ON public."contacts_metas"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."contacts" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can update contact metas"
ON public."contacts_metas"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."contacts" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."contacts" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);

CREATE POLICY "Users can delete contact metas"
ON public."contacts_metas"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."contacts" c
    WHERE c.id = "entityId"
      AND c."userId" = public.get_auth_user_id()
  )
);