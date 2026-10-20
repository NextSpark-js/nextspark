/**
 * Scheduled Actions - Scheduler
 * Functions for scheduling one-time and recurring actions
 *
 * Deduplication behavior:
 * - windowSeconds > 0: Updates existing action's payload (override)
 * - windowSeconds = 0: Disables deduplication (track all changes)
 *
 * Uses PostgreSQL advisory locks to prevent race conditions during deduplication.
 * Recurring actions are registered idempotently (see scheduleRecurringAction).
 */

import { mutateWithRLS, getTransactionClient } from '../db'
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
): Promise<string> {
  const dedupeConfig = APP_CONFIG_MERGED.scheduledActions?.deduplication
  const windowSeconds = dedupeConfig?.windowSeconds ?? 5

  // Extract entityId and entityType from payload (for webhook actions)
  const payloadObj = payload as Record<string, unknown> | null
  const entityId = payloadObj?.entityId as string | undefined
  const entityType = payloadObj?.entityType as string | undefined

  // Skip deduplication if:
  // - windowSeconds is 0 or negative (disabled)
  // - No entityId in payload (can't deduplicate)
  // - This is a recurring action (handled by the idempotent registration below, not the entityId window)
  const shouldDeduplicate = windowSeconds > 0 && entityId && !options?.recurringInterval

  // Prepare action data
  const actionId = globalThis.crypto.randomUUID()
  const scheduledAt = options?.scheduledAt || new Date()
  const teamId = options?.teamId || null
  const recurringInterval = options?.recurringInterval || null
  const lockGroup = options?.lockGroup || null
  const maxRetries = options?.maxRetries ?? 3 // Default: 3 retries
  const recurrenceType = options?.recurrenceType || null

  const insertAction = (client: { query: (text: string, params: unknown[]) => Promise<unknown> }) =>
    client.query(
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
      [actionId, actionType, 'pending', payload, teamId, scheduledAt.toISOString(), recurringInterval, lockGroup, maxRetries, recurrenceType]
    )

  if (recurringInterval) {
    // Registering a recurring action is idempotent against the database: a cold start on a serverless
    // host runs the registration again, and the process-level flag in the initializer does not survive it.
    // Key: actionType + teamId + payload (jsonb equality), against rows still 'pending' or 'running'.
    // Not 'completed': the processor marks the executed row completed BEFORE it reschedules the next one.
    // A 'running' row is skipped because it reschedules itself when it finishes.
    // The lock serializes concurrent registrations of the same actionType + teamId (the payload is left
    // out of the lock key because its text form is not stable), so the check and the insert are atomic.
    const client = await getTransactionClient(null)

    try {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`recurring:${actionType}:${teamId ?? ''}`])

      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM "scheduled_actions"
         WHERE "actionType" = $1
           AND "teamId" IS NOT DISTINCT FROM $2
           AND payload IS NOT DISTINCT FROM $3::jsonb
           AND "recurringInterval" IS NOT NULL
           AND status IN ('pending', 'running')
         LIMIT 1`,
        [actionType, teamId, payload === undefined ? null : JSON.stringify(payload)]
      )

      if (existing.length > 0) {
        await client.commit()
        console.log(`[ScheduledActions] Recurring action '${actionType}' already registered: ${existing[0].id}`)
        return existing[0].id
      }

      await insertAction(client)
      await client.commit()
      console.log(`[ScheduledActions] Scheduled action '${actionType}' with ID: ${actionId}${lockGroup ? ` (lockGroup: ${lockGroup})` : ''}`)
      return actionId
    } catch (error) {
      await client.rollback()
      throw error
    }
  }

  if (shouldDeduplicate) {
    // Use a SINGLE transaction for the entire deduplication + insert/update process
    // This ensures the advisory lock is held throughout the operation
    const dedupKey = `${actionType}:${entityId}:${entityType || ''}`
    const client = await getTransactionClient(null)

    try {
      // Acquire advisory lock (held until COMMIT)
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [dedupKey])

      // Check for existing pending action within time window
      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM "scheduled_actions"
         WHERE "actionType" = $1
           AND status = 'pending'
           AND payload->>'entityId' = $2
           AND payload->>'entityType' = $3
           AND "createdAt" > NOW() - INTERVAL '1 second' * $4
         LIMIT 1`,
        [actionType, entityId, entityType || '', windowSeconds]
      )

      if (existing.length > 0) {
        // Duplicate found: update existing action's payload
        await client.query(
          `UPDATE "scheduled_actions"
           SET payload = $1, "updatedAt" = NOW()
           WHERE id = $2 AND status = 'pending'`,
          [payload, existing[0].id]
        )

        await client.commit()
        console.log(`[ScheduledActions] Duplicate detected, updated payload: ${existing[0].id}`)
        return existing[0].id
      }

      // No duplicate: create new action (still within locked transaction)
      await client.query(
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
          payload,
          teamId,
          scheduledAt.toISOString(),
          recurringInterval,
          lockGroup,
          maxRetries,
          recurrenceType
        ]
      )

      await client.commit()
      console.log(`[ScheduledActions] Scheduled action '${actionType}' with ID: ${actionId}${lockGroup ? ` (lockGroup: ${lockGroup})` : ''}`)
      return actionId
    } catch (error) {
      await client.rollback()
      throw error
    }
  }

  // Deduplication disabled: create new action directly
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
      payload,
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
 * Idempotent: if a 'pending' or 'running' recurring row with the same actionType, teamId and payload
 * already exists, no row is inserted and that row's ID is returned. Safe to call on every cold start.
 *
 * @param actionType - Action identifier
 * @param payload - Data to pass to the action handler
 * @param interval - Recurrence pattern ('hourly', 'daily', 'weekly', or cron expression)
 * @param options - Additional options (teamId, scheduledAt for first run)
 * @returns The created action ID (or the existing one)
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
  return scheduleAction(actionType, payload, {
    ...options,
    recurringInterval: interval
  })
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
