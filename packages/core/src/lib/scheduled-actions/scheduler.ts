/**
 * Scheduled Actions - Scheduler
 * Functions for scheduling one-time and recurring actions
 *
 * Deduplication behavior:
 * - windowSeconds > 0: Updates existing action's payload (override)
 * - windowSeconds = 0: Disables deduplication (track all changes)
 *
 * Uses PostgreSQL advisory locks to prevent race conditions during deduplication.
 */

import { mutateWithRLS, queryWithRLS } from '../db'
import { APP_CONFIG_MERGED } from '../config/config-sync'
import type { ScheduleOptions } from './types'

// ===========================================
// DEDUPLICATION WITH ADVISORY LOCKS
// ===========================================

/**
 * Schedule a one-time action with deduplication
 *
 * Uses advisory locks to prevent race conditions when multiple requests
 * try to schedule actions for the same entity simultaneously.
 *
 * @param actionType - Action identifier (e.g., 'webhook:send')
 * @param payload - Data to pass to the action handler
 * @param options - Scheduling options (scheduledAt, teamId, recurringInterval)
 * @returns The action ID (new or existing if deduplicated)
 *
 * @example
 * await scheduleAction('webhook:send', {
 *   eventType: 'created',
 *   entityType: 'task',
 *   entityId: 'task-123',
 *   data: { title: 'New Task' }
 * }, { teamId: 'team-456' })
 */
export async function scheduleAction(
  actionType: string,
  payload: unknown,
  options?: ScheduleOptions
): Promise<string | null> {
  const dedupeConfig = APP_CONFIG_MERGED.scheduledActions?.deduplication
  const windowSeconds = dedupeConfig?.windowSeconds ?? 5

  // Extract entityId and entityType from payload (for webhook actions)
  const payloadObj = payload as Record<string, unknown> | null
  const entityId = payloadObj?.entityId as string | undefined
  const entityType = payloadObj?.entityType as string | undefined

  // Skip deduplication if:
  // - windowSeconds is 0 or negative (disabled)
  // - No entityId in payload (can't deduplicate)
  // - This is a recurring action (recurring actions don't deduplicate)
  const shouldDeduplicate = windowSeconds > 0 && entityId && !options?.recurringInterval

  if (shouldDeduplicate) {
    // Acquire advisory lock to prevent race conditions
    // Lock key is based on actionType + entityId + entityType
    const dedupKey = `${actionType}:${entityId}:${entityType || ''}`

    await queryWithRLS(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [dedupKey],
      null
    )

    // Check for existing pending action within time window
    const existing = await queryWithRLS<{ id: string }>(
      `SELECT id
       FROM "scheduled_actions"
       WHERE "actionType" = $1
         AND status = 'pending'
         AND payload->>'entityId' = $2
         AND payload->>'entityType' = $3
         AND "createdAt" > NOW() - INTERVAL '1 second' * $4
       LIMIT 1`,
      [actionType, entityId, entityType || '', windowSeconds],
      null
    )

    if (existing.length > 0) {
      // Duplicate found: update existing action's payload
      await mutateWithRLS(
        `UPDATE "scheduled_actions"
         SET payload = $1, "updatedAt" = NOW()
         WHERE id = $2 AND status = 'pending'`,
        [JSON.stringify(payload), existing[0].id],
        null
      )

      console.log(`[ScheduledActions] Duplicate detected, updated payload: ${existing[0].id}`)
      return existing[0].id
    }
  }

  // No duplicate found (or deduplication disabled): create new action
  const actionId = globalThis.crypto.randomUUID()
  const scheduledAt = options?.scheduledAt || new Date()
  const teamId = options?.teamId || null
  const recurringInterval = options?.recurringInterval || null
  const lockGroup = options?.lockGroup || null
  const maxRetries = options?.maxRetries ?? 3 // Default: 3 retries
  const recurrenceType = options?.recurrenceType || null

  await mutateWithRLS(
    `INSERT INTO "scheduled_actions" (
      id,
      "actionType",
      status,
      payload,
      "teamId",
      "scheduledAt",
      "recurringInterval",
      "lockGroup",
      "maxRetries",
      "recurrenceType"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      actionId,
      actionType,
      'pending',
      JSON.stringify(payload),
      teamId,
      scheduledAt.toISOString(),
      recurringInterval,
      lockGroup,
      maxRetries,
      recurrenceType
    ],
    null // System operation, no RLS context needed
  )

  console.log(`[ScheduledActions] Scheduled action '${actionType}' with ID: ${actionId}${lockGroup ? ` (lockGroup: ${lockGroup})` : ''}`)

  return actionId
}

/**
 * Schedule a recurring action
 * Convenience function that sets recurringInterval
 *
 * Note: Recurring actions bypass deduplication as each occurrence is unique.
 *
 * @param actionType - Action identifier
 * @param payload - Data to pass to the action handler
 * @param interval - Recurrence pattern ('hourly', 'daily', 'weekly', or cron expression)
 * @param options - Additional options (teamId, scheduledAt for first run)
 * @returns The created action ID
 *
 * @example
 * await scheduleRecurringAction('billing:check-renewals', {}, 'daily', {
 *   scheduledAt: new Date('2024-01-01T00:00:00Z')
 * })
 */
export async function scheduleRecurringAction(
  actionType: string,
  payload: unknown,
  interval: string,
  options?: Omit<ScheduleOptions, 'recurringInterval'>
): Promise<string> {
  // Recurring actions skip deduplication, so they always return a string
  const result = await scheduleAction(actionType, payload, {
    ...options,
    recurringInterval: interval
  })
  return result as string
}

/**
 * Cancel a scheduled action
 * Marks the action as 'failed' with a cancellation message
 *
 * @param actionId - The action ID to cancel
 * @returns True if action was cancelled successfully
 */
export async function cancelScheduledAction(actionId: string): Promise<boolean> {
  const result = await mutateWithRLS(
    `UPDATE "scheduled_actions"
     SET status = 'failed',
         "errorMessage" = 'Action cancelled by system',
         "updatedAt" = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [actionId],
    null
  )

  const cancelled = result.rowCount > 0

  if (cancelled) {
    console.log(`[ScheduledActions] Cancelled action: ${actionId}`)
  } else {
    console.warn(`[ScheduledActions] Could not cancel action ${actionId} (not found or not pending)`)
  }

  return cancelled
}
