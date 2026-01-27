-- =============================================
-- AI HISTORY METADATA SYSTEM
-- Plugin: AI
-- Entity: ai-history
-- =============================================
--
-- This migration adds comprehensive metadata capabilities through ai-history_metas table
--
-- Purpose: Flexible metadata storage for AI operations
-- - Better query performance (indexed key-value lookups)
-- - Granular auditing (when was each meta value set)
-- - Flexible schema (any metadata without ALTER TABLE)
-- - Type hints for client-side parsing
--
-- Common metadata keys:
-- - sourceOperationId: UUID linking to parent operation (for refine chains)
-- - userInstruction: Custom user instruction for refinements
-- - temperature: AI generation temperature setting
-- - tone: Content tone (casual, professional, etc.)
-- - platform: Social media platform target (instagram, tiktok, etc.)
-- - audience: Target audience description
-- - topic: Content topic
-- - language: Content language (en, es, etc.)
--
-- Date: 2025-11-04
-- =============================================

-- =============================================
-- AI_HISTORY_METAS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public."ai-history_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."ai-history"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT DEFAULT 'json' CHECK ("dataType" IN ('string', 'number', 'boolean', 'json', 'array')),
  "isPublic"     BOOLEAN NOT NULL DEFAULT false,
  "isSearchable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate keys per history record
  CONSTRAINT ai-history_metas_unique_key UNIQUE ("entityId", "metaKey")
);

-- Trigger for auto-updating updatedAt (using Better Auth's function)
CREATE TRIGGER ai-history_metas_set_updated_at
BEFORE UPDATE ON public."ai-history_metas"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for efficient queries
CREATE INDEX idx_ai-history_metas_entity_id ON public."ai-history_metas"("entityId");
CREATE INDEX idx_ai-history_metas_key ON public."ai-history_metas"("metaKey");
CREATE INDEX idx_ai-history_metas_composite ON public."ai-history_metas"("entityId", "metaKey");

-- GIN index for JSONB queries (enables @>, ?, ?&, ?| operators)
CREATE INDEX idx_ai-history_metas_value_gin ON public."ai-history_metas" USING GIN ("metaValue");

-- RLS Policies
ALTER TABLE public."ai-history_metas" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "AI history metas owner can do all" ON public."ai-history_metas";
DROP POLICY IF EXISTS "AI history metas inherit parent access" ON public."ai-history_metas";

-- Policy: Inherit access from parent ai-history record
CREATE POLICY "AI history metas inherit parent access"
ON public."ai-history_metas"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ai-history"
    WHERE "ai-history".id = "ai-history_metas"."entityId"
    AND "ai-history"."userId" = public.get_auth_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."ai-history"
    WHERE "ai-history".id = "ai-history_metas"."entityId"
    AND "ai-history"."userId" = public.get_auth_user_id()
  )
);

-- Comments for documentation
COMMENT ON TABLE public."ai-history_metas" IS 'Flexible metadata storage for AI history records. Supports any key-value pairs with JSONB values.';
COMMENT ON COLUMN public."ai-history_metas"."metaValue" IS 'JSONB value allows storing any data structure (string, number, boolean, object, array)';
COMMENT ON COLUMN public."ai-history_metas"."dataType" IS 'Hint for parsing metaValue on client side (actual type is always JSONB in DB)';
COMMENT ON COLUMN public."ai-history_metas"."isPublic" IS 'Whether this meta is publicly accessible or private to owner';
COMMENT ON COLUMN public."ai-history_metas"."isSearchable" IS 'Whether this meta should be included in search operations';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'AI History metadata migration completed successfully!';
  RAISE NOTICE 'Created: ai-history_metas table for flexible metadata';
  RAISE NOTICE 'Performance: GIN indexes for fast JSONB queries';
  RAISE NOTICE 'Security: RLS policies enabled on ai-history_metas';
END $$;
