/**
 * Scheduled Actions - Cleanup
 * Retention policy enforcement for old completed/failed actions
 */

import { mutateWithRLS } from '../db'
import { APP_CONFIG_MERGED } from '../config'

// Fallback default if config is not available
const DEFAULT_RETENTION_DAYS = 7

/**
 * Clean up old completed and failed actions
 * Deletes actions older than the retention period
 *
 * @param retentionDays - Number of days to keep actions (uses config default if not provided)
 * @returns Number of actions deleted
 *
 * @example
 * // Clean up actions using config default
 * const deleted = await cleanupOldActions()
 * console.log(`Deleted ${deleted} old actions`)
 *
 * // Use custom retention period (overrides config)
 * const deleted = await cleanupOldActions(30)
 */
export async function cleanupOldActions(
  retentionDays?: number
): Promise<number> {
  const effectiveRetentionDays = retentionDays ?? APP_CONFIG_MERGED.scheduledActions?.retentionDays ?? DEFAULT_RETENTION_DAYS

  console.log(`[ScheduledActions] Cleaning up actions older than ${effectiveRetentionDays} days`)

  const result = await mutateWithRLS(
    `DELETE FROM "scheduled_actions"
     WHERE status IN ('completed', 'failed')
       AND "completedAt" < NOW() - INTERVAL '1 day' * $1`,
    [effectiveRetentionDays],
    null // System operation
  )

  const deletedCount = result.rowCount

  console.log(`[ScheduledActions] Cleaned up ${deletedCount} old action(s)`)

  return deletedCount
}
