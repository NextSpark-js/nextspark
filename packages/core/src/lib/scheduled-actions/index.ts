/**
 * Scheduled Actions - Public API
 * Main entry point for the scheduled actions system
 *
 * This module provides a complete system for scheduling and executing
 * background tasks without blocking user requests.
 *
 * @module core/lib/scheduled-actions
 *
 * @example
 * // Register an action handler
 * import { registerScheduledAction, scheduleAction } from './'
 *
 * registerScheduledAction('webhook:send', async (payload, action) => {
 *   await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload) })
 * })
 *
 * // Schedule an action
 * await scheduleAction('webhook:send', {
 *   eventType: 'create',
 *   entityType: 'task',
 *   data: { title: 'New Task' }
 * })
 *
 * // Process pending actions (typically called by cron)
 * const result = await processPendingActions()
 */

// Types
export type {
  ScheduledAction,
  ScheduledActionHandler,
  ScheduledActionDefinition,
  ScheduledActionStatus,
  ScheduleOptions,
  ProcessResult
} from './types'

// Registry
export {
  registerScheduledAction,
  getActionHandler,
  getAllRegisteredActions,
  isActionRegistered,
  clearActionRegistry
} from './registry'

// Scheduler
export {
  scheduleAction,
  scheduleRecurringAction,
  cancelScheduledAction
} from './scheduler'

// Processor
export {
  processPendingActions
} from './processor'

// Cleanup
export {
  cleanupOldActions
} from './cleanup'

// Initializer (server-only)
export {
  initializeScheduledActions,
  initializeRecurringActions
} from './initializer'
