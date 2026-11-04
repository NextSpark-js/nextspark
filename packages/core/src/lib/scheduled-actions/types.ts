/**
 * Scheduled Actions - Type Definitions
 * Core types for the scheduled actions system
 */

export type ScheduledActionStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Determines how next execution time is calculated for recurring actions
 *
 * @example
 * 'fixed' - Maintains exact schedule times (e.g., daily at 12:00)
 *           If action scheduled at 12:00 runs at 12:05, next is still 12:00 tomorrow
 *
 * 'rolling' - Intervals from actual completion time (e.g., 30min after execution finishes)
 *             If action scheduled at 12:00 runs at 12:15, next is 12:45
 */
export type RecurrenceType = 'fixed' | 'rolling'

/**
 * Scheduled action record from database
 * NOTE: Database uses camelCase (e.g., actionType, teamId, scheduledAt)
 */
export interface ScheduledAction {
  id: string
  actionType: string
  status: ScheduledActionStatus
  payload: unknown
  teamId: string | null
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  attempts: number
  /**
   * Maximum value for the attempts counter before marking action as failed.
   * Represents total attempts (initial execution + retries), not retry count.
   * Default: 3
   *
   * @example
   * maxRetries = 0 -> Fail immediately, no retries (1 total attempt)
   * maxRetries = 3 -> 3 total attempts (1 initial + 2 retries)
   * maxRetries = 5 -> 5 total attempts (1 initial + 4 retries)
   */
  maxRetries: number
  recurringInterval: string | null
  /**
   * Determines how next execution time is calculated for recurring actions.
   * Only relevant when recurringInterval is set.
   * Default: 'fixed'
   */
  recurrenceType: RecurrenceType | null
  /**
   * Lock group key for parallel execution control.
   * Actions with the same lockGroup will be processed sequentially.
   * Actions with NULL lockGroup can run in parallel with any other action.
   *
   * @example
   * lockGroup = 'client:123' -> All actions for client 123 run sequentially
   * lockGroup = 'content:456' -> All actions for content 456 run sequentially
   */
  lockGroup: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Action handler function signature
 * @param payload - The action payload (deserialized from JSONB)
 * @param action - The full action record
 */
export interface ScheduledActionHandler {
  (payload: unknown, action: ScheduledAction): Promise<void>
}

/**
 * Action definition for registry
 */
export interface ScheduledActionDefinition {
  name: string
  handler: ScheduledActionHandler
  description?: string
  timeout?: number // milliseconds, default from config
}

/**
 * Options for scheduling an action
 */
export interface ScheduleOptions {
  scheduledAt?: Date          // Default: now
  teamId?: string             // Optional team context
  recurringInterval?: 'hourly' | 'daily' | 'weekly' | string // cron expression
  /**
   * Maximum value for the attempts counter before marking action as failed.
   * Represents total attempts (initial execution + retries), not retry count.
   * Default: 3
   *
   * @example
   * { maxRetries: 0 } -> Fail immediately, no retries (1 total attempt)
   * { maxRetries: 3 } -> 3 total attempts (1 initial + 2 retries)
   * { maxRetries: 5 } -> 5 total attempts (1 initial + 4 retries) for critical operations
   */
  maxRetries?: number
  /**
   * Lock group key for parallel execution control.
   * Actions with the same lockGroup will be processed sequentially.
   *
   * @example
   * { lockGroup: 'client:123' } -> All actions for client 123 run sequentially
   * { lockGroup: `content:${contentId}` } -> Prevents concurrent content publishing
   */
  lockGroup?: string
  /**
   * Determines how next execution time is calculated for recurring actions.
   * Only relevant when recurringInterval is set.
   * Default: 'fixed'
   *
   * @example
   * // Daily report at 12:00 (fixed schedule)
   * { recurringInterval: 'daily', recurrenceType: 'fixed' }
   * // If runs at 12:05, next is still 12:00 tomorrow
   *
   * // Token refresh every 30 minutes (rolling interval)
   * { recurringInterval: 'every-30-minutes', recurrenceType: 'rolling' }
   * // If scheduled at 12:00 but runs at 12:15, next is 12:45
   */
  recurrenceType?: RecurrenceType
  /**
   * Enqueue inside the caller's transaction instead of a transaction of its own: the INSERT goes through
   * this client, and `scheduleAction` neither commits nor rolls back, so the action is visible only after
   * the caller commits and does not exist if the caller rolls back.
   *
   * `scheduled_actions` is service-only under RLS, so `tx` must be a transaction on the service
   * connection, for example the client `getServiceTransactionClient()` returns. A client of the app role
   * makes the INSERT fail with a row-level security error.
   */
  tx?: ScheduleTransaction
}

/**
 * The part of a transaction client that `scheduleAction` uses (the shape `getServiceTransactionClient()` returns).
 */
export interface ScheduleTransaction {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<T[]>
}

/**
 * Result of processing actions
 */
export interface ProcessResult {
  processed: number
  succeeded: number
  failed: number
  errors: Array<{ actionId: string; error: string }>
}
