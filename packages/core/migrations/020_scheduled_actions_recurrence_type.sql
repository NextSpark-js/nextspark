-- Migration: 020_scheduled_actions_recurrence_type.sql
-- Description: Add recurrenceType column to scheduled_actions table
-- Date: 2026-02-04
-- PR: feature/instrumentation-scheduled-actions

-- ============================================
-- ENUM TYPE for recurrence type
-- ============================================
DO $$ BEGIN
  CREATE TYPE recurrence_type AS ENUM ('fixed', 'rolling');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- ADD COLUMN
-- ============================================
ALTER TABLE public."scheduled_actions"
ADD COLUMN IF NOT EXISTS "recurrenceType" recurrence_type DEFAULT 'fixed';

-- ============================================
-- COMMENT
-- ============================================
COMMENT ON COLUMN public."scheduled_actions"."recurrenceType" IS 'Determines how next execution time is calculated for recurring actions. fixed: maintains exact schedule times (e.g., daily at 12:00), rolling: intervals from actual completion time (e.g., 30min after execution finishes)';

-- ============================================
-- INDEX (optional, for queries filtering by recurrenceType)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_recurrence_type
  ON public."scheduled_actions"("recurrenceType")
  WHERE "recurringInterval" IS NOT NULL;
