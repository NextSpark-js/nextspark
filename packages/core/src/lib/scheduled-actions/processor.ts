/**
 * Scheduled Actions - Processor
 * Processes pending actions with parallel execution and lock-group based locking
 *
 * Features:
 * - Controlled parallelism with configurable concurrency limit
 * - Lock-group based locking to prevent race conditions on same resource
 * - SELECT FOR UPDATE SKIP LOCKED for safe concurrent processing
 * - Timeout protection per action
 */

import { queryWithRLS, mutateWithRLS } from '../db'
import { APP_CONFIG_MERGED } from '../config'
import { getActionHandler } from './registry'
import { scheduleAction } from './scheduler'
import type { ScheduledAction, ProcessResult } from './types'

// Fallback defaults if config is not available
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const DEFAULT_CONCURRENCY_LIMIT = 1 // Sequential by default for backward compatibility

/**
 * Process pending actions with parallel execution
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent processing
 *
 * Lock Group Behavior:
 * - Actions with same lockGroup are processed sequentially
 * - Actions with NULL lockGroup can run in parallel with any other action
 * - Uses PostgreSQL row-level locking to prevent race conditions
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
  const concurrencyLimit = APP_CONFIG_MERGED.scheduledActions?.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT

  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  }

  try {
    // Fetch and lock pending actions using FOR UPDATE SKIP LOCKED
    // This ensures:
    // 1. Multiple cron instances don't grab the same action
    // 2. Actions with same lockGroup are processed one at a time
    const actions = await fetchAndLockPendingActions(effectiveBatchSize)

    if (actions.length === 0) {
      console.log('[ScheduledActions] No pending actions to process')
      return result
    }

    console.log(`[ScheduledActions] Found ${actions.length} pending action(s) to process (concurrency: ${concurrencyLimit})`)

    // Process actions with controlled parallelism
    if (concurrencyLimit === 1) {
      // Sequential processing (backward compatible)
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
    } else {
      // Parallel processing with concurrency limit
      const results = await processWithConcurrencyLimit(actions, concurrencyLimit)

      for (const r of results) {
        result.processed++
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.errors.push({
            actionId: r.actionId,
            error: r.reason instanceof Error ? r.reason.message : 'Unknown error'
          })
        }
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
 * Fetch and lock pending actions with row-level locking
 * Uses SELECT FOR UPDATE SKIP LOCKED to:
 * 1. Lock selected rows so other processes can't grab them
 * 2. Skip rows already locked by other processes
 * 3. Ensure only one action per lockGroup is fetched (DISTINCT ON)
 */
async function fetchAndLockPendingActions(batchSize: number): Promise<ScheduledAction[]> {
  // Strategy: Fetch actions ensuring no two actions with same non-NULL lockGroup are selected
  // - For actions with NULL lockGroup: All can be selected (parallel execution safe)
  // - For actions with same non-NULL lockGroup: Only pick the oldest one (sequential execution)
  const actions = await queryWithRLS<ScheduledAction>(
    `WITH ranked_actions AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY "lockGroup"
          ORDER BY "scheduledAt" ASC
        ) as rn
      FROM "scheduled_actions"
      WHERE status = 'pending'
        AND "scheduledAt" <= NOW()
    )
    SELECT id, "actionType", status, payload, "teamId", "scheduledAt",
           "startedAt", "completedAt", "errorMessage", attempts, "maxRetries",
           "recurringInterval", "lockGroup", "createdAt", "updatedAt"
    FROM ranked_actions
    WHERE rn = 1 OR "lockGroup" IS NULL
    ORDER BY "scheduledAt" ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED`,
    [batchSize],
    null // System operation
  )

  return actions
}

/**
 * Result type for parallel processing
 */
interface ParallelResult {
  actionId: string
  status: 'fulfilled' | 'rejected'
  reason?: Error
}

/**
 * Process actions with controlled concurrency
 * Limits the number of concurrent action executions
 */
async function processWithConcurrencyLimit(
  actions: ScheduledAction[],
  limit: number
): Promise<ParallelResult[]> {
  const results: ParallelResult[] = []
  const executing = new Set<Promise<void>>()

  for (const action of actions) {
    // Create a promise for this action
    const promise = executeAction(action)
      .then(() => {
        results.push({ actionId: action.id, status: 'fulfilled' })
      })
      .catch((error) => {
        results.push({ actionId: action.id, status: 'rejected', reason: error })
      })
      .finally(() => {
        executing.delete(promise)
      })

    executing.add(promise)

    // If we've reached the concurrency limit, wait for one to complete
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  // Wait for all remaining promises to complete
  await Promise.all(executing)

  return results
}

/**
 * Execute a single action
 * Internal function that handles the full lifecycle of action execution
 */
async function executeAction(action: ScheduledAction): Promise<void> {
  const startTime = Date.now()
  const configDefaultTimeout = APP_CONFIG_MERGED.scheduledActions?.defaultTimeout ?? DEFAULT_TIMEOUT

  console.log(`[ScheduledActions] Executing action ${action.id} (${action.actionType})${action.lockGroup ? ` [lockGroup: ${action.lockGroup}]` : ''}`)

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

    // Check if we should retry based on action's maxRetries setting
    if (action.attempts < action.maxRetries) {
      // Calculate retry delay with exponential backoff: 5min, 10min, 15min...
      const retryDelayMinutes = action.attempts * 5
      console.log(`[ScheduledActions] Will retry action ${action.id} in ${retryDelayMinutes} minutes (attempt ${action.attempts}/${action.maxRetries})`)

      await rescheduleFailedAction(action, errorMessage, retryDelayMinutes)
    } else {
      // Max retries reached
      console.error(`[ScheduledActions] Max retries (${action.maxRetries}) reached for action ${action.id}`)
      await markActionFailed(action.id, errorMessage)
    }

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
 * Reschedule a failed action for retry
 * Resets the action to pending with a new scheduled time
 * The attempts counter is preserved for the next execution
 */
async function rescheduleFailedAction(
  action: ScheduledAction,
  errorMessage: string,
  delayMinutes: number
): Promise<void> {
  const nextAttemptTime = new Date(Date.now() + delayMinutes * 60 * 1000)

  await mutateWithRLS(
    `UPDATE "scheduled_actions"
     SET status = 'pending',
         "scheduledAt" = $2,
         "errorMessage" = $3,
         "startedAt" = NULL,
         "completedAt" = NULL,
         "updatedAt" = NOW()
     WHERE id = $1`,
    [action.id, nextAttemptTime, errorMessage],
    null
  )

  console.log(`[ScheduledActions] Rescheduled action ${action.id} for ${nextAttemptTime.toISOString()}`)
}

/**
 * Reschedule a recurring action
 * Creates a new action for the next occurrence, preserving the lockGroup
 */
async function rescheduleRecurringAction(action: ScheduledAction): Promise<void> {
  if (!action.recurringInterval) {
    return
  }

  // Calculate next scheduled time based on interval
  // Uses the original scheduledAt as base to prevent drift
  const nextScheduledAt = calculateNextScheduledTime(action.recurringInterval, action.scheduledAt)

  // Schedule the next occurrence (preserving lockGroup)
  await scheduleAction(
    action.actionType,
    action.payload,
    {
      scheduledAt: nextScheduledAt,
      teamId: action.teamId ?? undefined,
      recurringInterval: action.recurringInterval ?? undefined,
      lockGroup: action.lockGroup ?? undefined
    }
  )

  console.log(`[ScheduledActions] Rescheduled recurring action ${action.actionType} for ${nextScheduledAt.toISOString()}`)
}

/**
 * Calculate next scheduled time based on interval
 * Uses the original scheduled time as base to prevent drift
 *
 * @param interval - The recurrence interval
 * @param baseTime - The original scheduled time to calculate from
 * @returns The next scheduled time
 */
function calculateNextScheduledTime(interval: string, baseTime: Date): Date {
  const base = new Date(baseTime)

  switch (interval) {
    case 'every-30-minutes':
      return new Date(base.getTime() + 30 * 60 * 1000)

    case 'hourly':
      return new Date(base.getTime() + 60 * 60 * 1000)

    case 'daily':
      return new Date(base.getTime() + 24 * 60 * 60 * 1000)

    case 'weekly':
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)

    default:
      // For custom intervals, default to 1 hour from base time
      // In future versions, parse cron expressions here
      console.warn(`[ScheduledActions] Unknown interval '${interval}', defaulting to 1 hour`)
      return new Date(base.getTime() + 60 * 60 * 1000)
  }
}
