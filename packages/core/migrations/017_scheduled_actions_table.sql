-- Migration: 017_scheduled_actions_table.sql
-- Description: Scheduled Actions (table, enum, indexes, RLS)
-- Date: 2025-12-30

-- ============================================
-- ENUM TYPE
-- ============================================
DO $$ BEGIN
  CREATE TYPE scheduled_action_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."scheduled_actions" CASCADE;

CREATE TABLE IF NOT EXISTS public."scheduled_actions" (
  -- Primary Key (TEXT not UUID!)
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields (optional team context)
  "teamId"            TEXT REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- Entity-specific fields
  "actionType"        TEXT NOT NULL,
  status              scheduled_action_status NOT NULL DEFAULT 'pending',
  payload             JSONB DEFAULT '{}'::jsonb,
  "scheduledAt"       TIMESTAMPTZ NOT NULL,
  "startedAt"         TIMESTAMPTZ,
  "completedAt"       TIMESTAMPTZ,
  "errorMessage"      TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  "maxRetries"        INTEGER NOT NULL DEFAULT 3,
  "recurringInterval" TEXT,
  "recurrenceType"    TEXT,
  "lockGroup"         TEXT,

  -- System fields (always last)
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."scheduled_actions"                     IS 'Scheduled background actions for async task processing';
COMMENT ON COLUMN public."scheduled_actions"."teamId"            IS 'Optional team context for action execution';
COMMENT ON COLUMN public."scheduled_actions"."actionType"        IS 'Action identifier (e.g., webhook:send, billing:check-renewals)';
COMMENT ON COLUMN public."scheduled_actions".status              IS 'Action execution status';
COMMENT ON COLUMN public."scheduled_actions".payload             IS 'Arbitrary JSON data for action handler';
COMMENT ON COLUMN public."scheduled_actions"."scheduledAt"       IS 'When the action should be executed';
COMMENT ON COLUMN public."scheduled_actions"."startedAt"         IS 'When execution started';
COMMENT ON COLUMN public."scheduled_actions"."completedAt"       IS 'When execution finished';
COMMENT ON COLUMN public."scheduled_actions"."errorMessage"      IS 'Error details if action failed';
COMMENT ON COLUMN public."scheduled_actions".attempts            IS 'Number of execution attempts';
COMMENT ON COLUMN public."scheduled_actions"."maxRetries"        IS 'Maximum number of retry attempts before marking action as failed. Default: 3';
COMMENT ON COLUMN public."scheduled_actions"."recurringInterval" IS 'Recurrence pattern: hourly, daily, weekly, or cron expression';
COMMENT ON COLUMN public."scheduled_actions"."recurrenceType"    IS 'Recurrence calculation type: "fixed" (calculate from scheduledAt to prevent drift) or "rolling" (calculate from completion time for consistent intervals)';
COMMENT ON COLUMN public."scheduled_actions"."lockGroup"         IS 'Lock group key for parallel execution control. Actions with same lockGroup run sequentially';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS scheduled_actions_set_updated_at ON public."scheduled_actions";
CREATE TRIGGER scheduled_actions_set_updated_at
BEFORE UPDATE ON public."scheduled_actions"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
-- Primary query pattern: fetch pending actions to process
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_status_scheduled_at
  ON public."scheduled_actions"(status, "scheduledAt")
  WHERE status = 'pending';

-- Team context filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_team_id
  ON public."scheduled_actions"("teamId");

-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_action_type
  ON public."scheduled_actions"("actionType");

-- Cleanup query for retention policy
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_completed_at
  ON public."scheduled_actions"("completedAt")
  WHERE status IN ('completed', 'failed');

-- Created at for general sorting
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_created_at
  ON public."scheduled_actions"("createdAt" DESC);

-- Lock group for parallel execution control
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_lock_group
  ON public."scheduled_actions"("lockGroup")
  WHERE "lockGroup" IS NOT NULL;

-- Retry status filtering (queries checking retry eligibility)
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_retry_status
  ON public."scheduled_actions"(attempts, "maxRetries")
  WHERE status = 'pending';

-- ============================================
-- RLS
-- ============================================
-- NOTE: This is a SYSTEM table managed by cron jobs
-- Authenticated users can READ for DevTools UI
-- Only system (via CRON_SECRET) can WRITE
ALTER TABLE public."scheduled_actions" ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies
DROP POLICY IF EXISTS "scheduled_actions auth can select" ON public."scheduled_actions";
DROP POLICY IF EXISTS "scheduled_actions system can do all" ON public."scheduled_actions";

-- Authenticated users can view all actions (for DevTools)
CREATE POLICY "scheduled_actions auth can select"
ON public."scheduled_actions"
FOR SELECT TO authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users
-- System operations are handled via service role or direct API with CRON_SECRET
