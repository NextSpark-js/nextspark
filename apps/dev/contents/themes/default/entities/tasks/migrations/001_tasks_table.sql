-- Migration: 001_tasks_table.sql
-- Description: Tasks (table, indexes, RLS)
-- Date: 2025-01-19
-- Updated: 2025-11-26 (Phase 2 - Team Isolation)

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."tasks" CASCADE;

CREATE TABLE IF NOT EXISTS public."tasks" (
  -- Primary Key
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields (al inicio)
  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Entity-specific fields
  title              TEXT NOT NULL,
  description        TEXT,
  completed          BOOLEAN DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'todo',
  priority           TEXT NOT NULL DEFAULT 'medium',
  tags               JSONB DEFAULT '[]'::jsonb,
  "dueDate"          DATE,
  "estimatedHours"   NUMERIC(5,2),

  -- System fields
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in-progress', 'review', 'done', 'blocked')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT tasks_estimated_hours_positive CHECK ("estimatedHours" IS NULL OR "estimatedHours" > 0)
);

COMMENT ON TABLE  public."tasks"                  IS 'Tasks table with team isolation via RLS';
COMMENT ON COLUMN public."tasks"."userId"         IS 'Owner user id (user isolation handled at app level)';
COMMENT ON COLUMN public."tasks"."teamId"         IS 'Team context for isolation';
COMMENT ON COLUMN public."tasks".title            IS 'Task title or name';
COMMENT ON COLUMN public."tasks".description      IS 'Detailed task description';
COMMENT ON COLUMN public."tasks".completed        IS 'Task completion status (legacy)';
COMMENT ON COLUMN public."tasks".status           IS 'Task status: todo, in-progress, review, done, blocked';
COMMENT ON COLUMN public."tasks".priority         IS 'Task priority: low, medium, high, urgent';
COMMENT ON COLUMN public."tasks".tags             IS 'Task tags for categorization';
COMMENT ON COLUMN public."tasks"."dueDate"        IS 'Task deadline (date only)';
COMMENT ON COLUMN public."tasks"."estimatedHours" IS 'Estimated time to complete in hours';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS tasks_set_updated_at ON public."tasks";
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public."tasks"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id         ON public."tasks"("userId");
CREATE INDEX IF NOT EXISTS idx_tasks_team_id         ON public."tasks"("teamId");
CREATE INDEX IF NOT EXISTS idx_tasks_user_team       ON public."tasks"("userId", "teamId");
CREATE INDEX IF NOT EXISTS idx_tasks_user_created_at ON public."tasks"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_tasks_completed       ON public."tasks"(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON public."tasks"(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority        ON public."tasks"(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date        ON public."tasks"("dueDate") WHERE "dueDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_tags            ON public."tasks" USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON public."tasks"("userId", status, "dueDate");
CREATE INDEX IF NOT EXISTS idx_tasks_team_created    ON public."tasks"("teamId", "createdAt" DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public."tasks" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Tasks owner can do all" ON public."tasks";
DROP POLICY IF EXISTS "Tasks team can do all"  ON public."tasks";
DROP POLICY IF EXISTS tasks_owner_policy       ON public."tasks";
DROP POLICY IF EXISTS tasks_owner_all          ON public."tasks";

-- ============================
-- RLS: TEAM ISOLATION ONLY
-- ============================
-- IMPORTANTE: RLS solo verifica team membership
-- La lógica de access.shared (user isolation) se maneja a NIVEL APP
-- Esto permite cambiar el comportamiento desde el config sin modificar RLS
CREATE POLICY "Tasks team can do all"
ON public."tasks"
FOR ALL TO authenticated
USING (
  -- Superadmin bypass
  public.is_superadmin()
  OR
  -- Team isolation: user must be member of the team
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);