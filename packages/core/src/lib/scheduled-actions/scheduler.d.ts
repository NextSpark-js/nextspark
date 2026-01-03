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
import type { ScheduleOptions } from './types';
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
export declare function scheduleAction(actionType: string, payload: unknown, options?: ScheduleOptions): Promise<string | null>;
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
export declare function scheduleRecurringAction(actionType: string, payload: unknown, interval: string, options?: Omit<ScheduleOptions, 'recurringInterval'>): Promise<string>;
/**
 * Cancel a scheduled action
 * Marks the action as 'failed' with a cancellation message
 *
 * @param actionId - The action ID to cancel
 * @returns True if action was cancelled successfully
 */
export declare function cancelScheduledAction(actionId: string): Promise<boolean>;
//# sourceMappingURL=scheduler.d.ts.map