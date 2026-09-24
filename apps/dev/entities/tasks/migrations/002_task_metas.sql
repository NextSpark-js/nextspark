-- Migration: 002_tasks_metas.sql
-- Description: Tasks metas (table, indexes, RLS) - Updated to new conventions
-- Date: 2025-01-19
-- Updated: 2025-11-26 (Phase 2 - Team Isolation via parent)

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public."tasks_metas" (
                                                    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "entityId"     TEXT NOT NULL REFERENCES public."tasks"(id) ON DELETE CASCADE,
    "metaKey"      TEXT NOT NULL,
    "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
    "dataType"     TEXT DEFAULT 'json',
    "isPublic"     BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tasks_metas_unique_key UNIQUE ("entityId", "metaKey")
    );

COMMENT ON TABLE  public."tasks_metas"               IS 'Key-value metadata for tasks';
COMMENT ON COLUMN public."tasks_metas"."entityId"    IS 'Reference to parent task (generic entityId)';
COMMENT ON COLUMN public."tasks_metas"."metaKey"      IS 'Metadata key identifier';
COMMENT ON COLUMN public."tasks_metas"."metaValue"    IS 'Metadata value in JSONB format';
COMMENT ON COLUMN public."tasks_metas"."dataType"     IS 'Type hint for the value: json, string, number, boolean';
COMMENT ON COLUMN public."tasks_metas"."isPublic"     IS 'Whether this metadata is publicly readable';
COMMENT ON COLUMN public."tasks_metas"."isSearchable" IS 'Whether this metadata is searchable';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS tasks_metas_set_updated_at ON public."tasks_metas";
CREATE TRIGGER tasks_metas_set_updated_at
    BEFORE UPDATE ON public."tasks_metas"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_metas_entity_id      ON public."tasks_metas"("entityId");
CREATE INDEX IF NOT EXISTS idx_tasks_metas_key           ON public."tasks_metas"("metaKey");
CREATE INDEX IF NOT EXISTS idx_tasks_metas_is_public     ON public."tasks_metas"("isPublic") WHERE "isPublic" = true;
CREATE INDEX IF NOT EXISTS idx_tasks_metas_is_searchable ON public."tasks_metas"("isSearchable") WHERE "isSearchable" = true;
CREATE INDEX IF NOT EXISTS idx_tasks_metas_value_gin     ON public."tasks_metas" USING GIN ("metaValue");
CREATE INDEX IF NOT EXISTS idx_tasks_metas_value_ops     ON public."tasks_metas" USING GIN ("metaValue" jsonb_path_ops);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."tasks_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Tasks metas owner can do all" ON public."tasks_metas";
DROP POLICY IF EXISTS "Tasks metas team can do all"  ON public."tasks_metas";
DROP POLICY IF EXISTS tasks_metas_owner_policy       ON public."tasks_metas";

-- ============================
-- RLS: TEAM ISOLATION VIA PARENT
-- ============================
-- Hereda el aislamiento del parent task via teamId
-- La lógica de access.shared se maneja a NIVEL APP
CREATE POLICY "Tasks metas team can do all"
ON public."tasks_metas"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation via parent task
  EXISTS (
    SELECT 1 FROM public."tasks" t
    WHERE t.id = "entityId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
)
WITH CHECK (
  public.is_superadmin()
  OR
  EXISTS (
    SELECT 1 FROM public."tasks" t
    WHERE t.id = "entityId"
      AND t."teamId" = ANY(public.get_user_team_ids())
  )
);