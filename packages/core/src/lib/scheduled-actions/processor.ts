/**
 * Scheduled Actions - Processor
 * Processes pending actions and manages their lifecycle
 */

import { queryWithRLS, mutateWithRLS } from '../db'
import { APP_CONFIG_MERGED } from '../config'
import { getActionHandler } from './registry'
import { scheduleAction } from './scheduler'
import type { ScheduledAction, ProcessResult } from './types'

// Fallback defaults if config is not available
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_TIMEOUT = 30000 // 30 seconds

/**
 * Process pending actions
 * Fetches pending actions, executes them, and updates their status
 *
 * @param batchSize - Maximum number of actions to process (uses config default if not provided)
 * @returns Result with counts and errors
 *
 * @example
 * const result = await processPendingActions()
 * console.log(`Processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`)
 */
export async function processPendingActions(
  batchSize?: number
): Promise<ProcessResult> {
  const effectiveBatchSize = batchSize ?? APP_CONFIG_MERGED.scheduledActions?.batchSize ?? DEFAULT_BATCH_SIZE

  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  }

  try {
    // Fetch pending actions that are scheduled for now or earlier
    const actions = await queryWithRLS<ScheduledAction>(
      `SELECT * FROM "scheduled_actions"
       WHERE status = 'pending'
         AND "scheduledAt" <= NOW()
       ORDER BY "scheduledAt" ASC
       LIMIT $1`,
      [effectiveBatchSize],
      null // System operation
    )

    console.log(`[ScheduledActions] Found ${actions.length} pending action(s) to process`)

    // Process each action sequentially
    for (const action of actions) {
      result.processed++

      try {
        await executeAction(action)
        result.succeeded++
      } catch (error) {
        result.failed++
        result.errors.push({
          actionId: action.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`[ScheduledActions] Processing complete: ${result.succeeded} succeeded, ${result.failed} failed`)
  } catch (error) {
    console.error('[ScheduledActions] Error fetching pending actions:', error)
    throw error
  }

  return result
}

/**
 * Execute a single action
 * Internal function that handles the full lifecycle of action execution
 */
async function executeAction(action: ScheduledAction): Promise<void> {
  const startTime = Date.now()
  const configDefaultTimeout = APP_CONFIG_MERGED.scheduledActions?.defaultTimeout ?? DEFAULT_TIMEOUT

  console.log(`[ScheduledActions] Executing action ${action.id} (${action.actionType})`)

  // Mark as running
  await markActionRunning(action.id)

  try {
    // Get the registered handler
    const actionDef = getActionHandler(action.actionType)

    if (!actionDef) {
      throw new Error(`No handler registered for action type: ${action.actionType}`)
    }

    // Execute with timeout protection (action-specific timeout > config default > fallback)
    const timeout = actionDef.timeout ?? configDefaultTimeout
    await executeWithTimeout(
      actionDef.handler(action.payload, action),
      timeout,
      `Action ${action.actionType} exceeded timeout of ${timeout}ms`
    )

    const executionTime = Date.now() - startTime
    console.log(`[ScheduledActions] Action ${action.id} completed in ${executionTime}ms`)

    // Mark as completed
    await markActionCompleted(action.id)

    // Reschedule if recurring
    if (action.recurringInterval) {
      await rescheduleRecurringAction(action)
    }
  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`[ScheduledActions] Action ${action.id} failed after ${executionTime}ms:`, errorMessage)

    await markActionFailed(action.id, errorMessage)

    // Re-throw so caller can track failures
    throw error
  }
}

/**
 * Execute a promise with timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * Mark action as running
 */
async function markActionRunning(actionId: string): Promise<void> {
  await mutateWithRLS(
    `UPDATE "scheduled_actions"
     SET status = 'running',
         "startedAt" = NOW(),
         attempts = attempts + 1,
         "updatedAt" = NOW()
     WHERE id = $1`,
    [actionId],
    null
  )
}

/**
 * Mark action as completed
 */
async function markActionCompleted(actionId: string): Promise<void> {
  await mutateWithRLS(
    `UPDATE "scheduled_actions"
     SET status = 'completed',
         "completedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE id = $1`,
    [actionId],
    null
  )
}

/**
 * Mark action as failed with error message
 */
async function markActionFailed(actionId: string, errorMessage: string): Promise<void> {
  await mutateWithRLS(
    `UPDATE "scheduled_actions"
     SET status = 'failed',
         "completedAt" = NOW(),
         "errorMessage" = $2,
         "updatedAt" = NOW()
     WHERE id = $1`,
    [actionId, errorMessage],
    null
  )
}

/**
 * Reschedule a recurring action
 * Creates a new action for the next occurrence
 */
async function rescheduleRecurringAction(action: ScheduledAction): Promise<void> {
  if (!action.recurringInterval) {
    return
  }

  // Calculate next scheduled time based on interval
  const nextScheduledAt = calculateNextScheduledTime(action.recurringInterval)

  // Schedule the next occurrence
  await scheduleAction(
    action.actionType,
    action.payload,
    {
      scheduledAt: nextScheduledAt,
      teamId: action.teamId ?? undefined,
      recurringInterval: action.recurringInterval ?? undefined
    }
  )

  console.log(`[ScheduledActions] Rescheduled recurring action ${action.actionType} for ${nextScheduledAt.toISOString()}`)
}

/**
 * Calculate next scheduled time based on interval
 */
function calculateNextScheduledTime(interval: string): Date {
  const now = new Date()

  switch (interval) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000)

    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)

    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    default:
      // For custom intervals, default to 1 hour from now
      // In future versions, parse cron expressions here
      console.warn(`[ScheduledActions] Unknown interval '${interval}', defaulting to 1 hour`)
      return new Date(now.getTime() + 60 * 60 * 1000)
  }
}
