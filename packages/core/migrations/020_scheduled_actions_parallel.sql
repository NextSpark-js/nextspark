-- Migration: 020_scheduled_actions_parallel.sql
-- Description: Add lockGroup column for parallel execution with group-based locking
-- Date: 2026-02-03

-- ============================================
-- ADD lockGroup COLUMN
-- ============================================
-- lockGroup allows grouping actions that should not run in parallel.
-- Actions with the same lockGroup will be processed sequentially.
-- Actions with NULL lockGroup can run in parallel with any other action.
--
-- Examples:
--   lockGroup = 'client:123' -> All actions for client 123 run sequentially
--   lockGroup = 'content:456' -> All actions for content 456 run sequentially
--   lockGroup = NULL -> Can run in parallel with anything

ALTER TABLE public."scheduled_actions"
ADD COLUMN IF NOT EXISTS "lockGroup" TEXT;

COMMENT ON COLUMN public."scheduled_actions"."lockGroup"
IS 'Lock group key for parallel execution control. Actions with same lockGroup run sequentially.';

-- ============================================
-- INDEX FOR lockGroup
-- ============================================
-- Optimize queries that filter by lockGroup for locking
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_lock_group
  ON public."scheduled_actions"("lockGroup")
  WHERE "lockGroup" IS NOT NULL;

-- Composite index for pending actions with lockGroup (main query pattern)
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_pending_lock_group
  ON public."scheduled_actions"(status, "scheduledAt", "lockGroup")
  WHERE status = 'pending';
