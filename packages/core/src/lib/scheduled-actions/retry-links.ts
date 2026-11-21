/**
 * SQL that links a failed scheduled action to the action that retried it, for the devtools list.
 *
 * A retry (POST /api/v1/devtools/scheduled-actions) creates a new action with the same type and payload and records
 * nothing about where it came from, and adding a `retryOf` column would be a migration of a core table for a devtools
 * view. So the link is derived: the retry of a failed, non-recurring action is the next action of the same type with the
 * same payload created after it, and the action that was retried is the latest failed one before. An unrelated action
 * scheduled later with the same payload reads as a retry too; for the one job these links do (stop offering a second
 * Retry, and let the eye jump between the two) that is the safe side. A recurring action is left out: its next
 * occurrence has the same payload by design and is not a retry.
 */

/** Two columns for the select list of a query over `"scheduled_actions"` (no alias): `"retriedBy"` and `"retryOf"`, an id or null. */
export const RETRY_LINK_COLUMNS = `
  CASE WHEN "scheduled_actions".status = 'failed' AND "scheduled_actions"."recurringInterval" IS NULL THEN (
    SELECT n.id FROM "scheduled_actions" n
    WHERE n."actionType" = "scheduled_actions"."actionType"
      AND n.payload = "scheduled_actions".payload
      AND n."createdAt" > "scheduled_actions"."createdAt"
    ORDER BY n."createdAt" LIMIT 1
  ) END AS "retriedBy",
  (
    SELECT o.id FROM "scheduled_actions" o
    WHERE o.status = 'failed' AND o."recurringInterval" IS NULL
      AND o."actionType" = "scheduled_actions"."actionType"
      AND o.payload = "scheduled_actions".payload
      AND o."createdAt" < "scheduled_actions"."createdAt"
    ORDER BY o."createdAt" DESC LIMIT 1
  ) AS "retryOf"`

/**
 * Parameters `$1` action type, `$2` payload (JSON text), `$3` id of the failed action: the action that already retried it, if any.
 * The failed action's `createdAt` is read here, not passed in: a JavaScript Date keeps milliseconds and the column keeps
 * microseconds, so the Date compares as earlier than the row it came from and the action would count as its own retry.
 */
export const ALREADY_RETRIED_SQL = `
  SELECT n.id FROM "scheduled_actions" n
  WHERE n."actionType" = $1 AND n.payload = $2::jsonb
    AND n."createdAt" > (SELECT f."createdAt" FROM "scheduled_actions" f WHERE f.id = $3)
  ORDER BY n."createdAt" LIMIT 1`
