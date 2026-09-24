-- ============================================================================
-- Pipelines Table Migration
-- CRM theme: Sales pipelines with stages
-- Updated with team support and RLS
-- ============================================================================

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE pipeline_type AS ENUM ('sales', 'support', 'project', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "pipelines" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Pipeline info
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "type" pipeline_type DEFAULT 'sales',
  "isDefault" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  
  -- Stages as JSONB
  -- Example: [{"order": 1, "name": "Qualification", "probability": 10, "color": "#3B82F6"}]
  "stages" JSONB NOT NULL DEFAULT '[
    {"order": 1, "name": "Qualification", "probability": 10, "color": "#3B82F6"},
    {"order": 2, "name": "Needs Analysis", "probability": 25, "color": "#10B981"},
    {"order": 3, "name": "Proposal", "probability": 50, "color": "#F59E0B"},
    {"order": 4, "name": "Negotiation", "probability": 75, "color": "#8B5CF6"},
    {"order": 5, "name": "Closed Won", "probability": 100, "color": "#059669"},
    {"order": 6, "name": "Closed Lost", "probability": 0, "color": "#EF4444"}
  ]',
  
  -- Deal rotten days
  "dealRottenDays" INTEGER DEFAULT 30,
  
  -- Ownership
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "pipelines_teamId_idx" ON "pipelines" ("teamId");
CREATE INDEX IF NOT EXISTS "pipelines_userId_idx" ON "pipelines" ("userId");
CREATE INDEX IF NOT EXISTS "pipelines_isDefault_idx" ON "pipelines" ("teamId", "isDefault") WHERE "isDefault" = true;
CREATE INDEX IF NOT EXISTS "pipelines_isActive_idx" ON "pipelines" ("isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "pipelines_stages_idx" ON "pipelines" USING GIN ("stages");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipelines_select_policy" ON "pipelines";
DROP POLICY IF EXISTS "pipelines_insert_policy" ON "pipelines";
DROP POLICY IF EXISTS "pipelines_update_policy" ON "pipelines";
DROP POLICY IF EXISTS "pipelines_delete_policy" ON "pipelines";

CREATE POLICY "pipelines_select_policy" ON "pipelines"
  FOR SELECT
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "pipelines_insert_policy" ON "pipelines"
  FOR INSERT
  WITH CHECK ("teamId" = ANY(public.get_user_team_ids()));

CREATE POLICY "pipelines_update_policy" ON "pipelines"
  FOR UPDATE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

CREATE POLICY "pipelines_delete_policy" ON "pipelines"
  FOR DELETE
  USING ("teamId" = ANY(public.get_user_team_ids()) OR public.is_superadmin());

-- ============================================
-- TRIGGER updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipelines_updated_at_trigger ON "pipelines";
CREATE TRIGGER pipelines_updated_at_trigger
  BEFORE UPDATE ON "pipelines"
  FOR EACH ROW
  EXECUTE FUNCTION update_pipelines_updated_at();

COMMENT ON TABLE "pipelines" IS 'Sales pipelines with stages';
COMMENT ON COLUMN "pipelines"."stages" IS 'JSONB array of pipeline stages with order, name, probability, color';
COMMENT ON COLUMN "pipelines"."dealRottenDays" IS 'Days until a deal is considered stale';
