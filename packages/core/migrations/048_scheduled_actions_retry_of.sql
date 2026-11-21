-- Migration: 048_scheduled_actions_retry_of.sql
-- Description: scheduled_actions."retryOf" links a retry to the failed action it retries (#522).
--
-- The devtools Scheduled Actions list retries a failed action (POST /api/v1/devtools/scheduled-actions) by creating a new
-- action with the same type and payload. The new action records the failed one in "retryOf", so the list can show
-- "Retried" / "Retry of" and the endpoint can refuse a second retry of the same action.
--
-- - ON DELETE SET NULL: the retention cleanup (or a manual delete) of the original leaves the retry in place, unlinked.
-- - The partial UNIQUE index lets an action be retried once: a second INSERT with the same "retryOf" fails with a unique
--   violation (23505), atomically, so two clicks at once cannot both create a retry. The chain works because the retry is a
--   new row: if A fails and its retry B fails too, B is retried (retryOf = B), not A. The same index serves the lookup
--   "which action retried this one" and the foreign key's ON DELETE check.
-- - RLS and grants are unchanged and cover the column: "Scheduled actions service all" (017) is a row policy FOR ALL TO
--   authenticated USING/WITH CHECK can_bypass_rls(), and the privileges of nextspark_app (022) are table-level, so a new
--   column inherits both. nextspark_app still cannot read or write a row of this table unless it bypasses RLS; the column adds
--   no way around that.
-- Idempotent.

ALTER TABLE public."scheduled_actions"
  ADD COLUMN IF NOT EXISTS "retryOf" TEXT REFERENCES public."scheduled_actions"(id) ON DELETE SET NULL;

COMMENT ON COLUMN public."scheduled_actions"."retryOf" IS 'The failed action this one retries (set by the devtools Retry). An action is retried once: the index is unique';

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_actions_retry_of
  ON public."scheduled_actions"("retryOf")
  WHERE "retryOf" IS NOT NULL;
