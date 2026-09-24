/**
 * Scheduled Actions - Initializer
 *
 * Core service that initializes scheduled action handlers from the project.
 * This module reads from the auto-generated scheduled-actions-registry and
 * calls the project's registration functions.
 *
 * @module core/lib/scheduled-actions/initializer
 */

import 'server-only'

import { SCHEDULED_ACTIONS_REGISTRY } from '@nextsparkjs/registries/scheduled-actions-registry'

// Guards to prevent multiple initializations
// Stored on globalThis to survive HMR module reloads in dev mode
const globalForInit = globalThis as typeof globalThis & {
  __scheduledActionsHandlersInitialized?: boolean
  __scheduledActionsRecurringInitialized?: boolean
}

/**
 * Initialize scheduled action handlers for the project
 *
 * This function reads from the auto-generated registry and calls
 * the project's registerAllHandlers function to register action handlers.
 *
 * Should be called at server startup (typically in instrumentation.ts)
 *
 * @example
 * // In instrumentation.ts
 * import { initializeScheduledActions } from '@nextsparkjs/core/lib/scheduled-actions'
 * initializeScheduledActions()
 */
export function initializeScheduledActions(): void {
  if (globalForInit.__scheduledActionsHandlersInitialized) {
    console.log('[ScheduledActions] Handlers already initialized, skipping...')
    return
  }

  const [projectName, module] = Object.entries(SCHEDULED_ACTIONS_REGISTRY)[0] ?? []

  if (module) {
    console.log(`[ScheduledActions] Initializing handlers for project: ${projectName}`)
    module.registerAllHandlers()
    globalForInit.__scheduledActionsHandlersInitialized = true
    console.log(`[ScheduledActions] ✅ Handlers initialized successfully`)
  } else {
    console.warn('[ScheduledActions] No project scheduled-action handlers found')
  }
}

/**
 * Initialize recurring scheduled actions for the project
 *
 * This async function reads from the auto-generated registry and calls
 * the project's registerRecurringActions function to schedule recurring tasks.
 *
 * Includes guard to prevent duplicate DB queries in same server instance.
 * The project's registerRecurringActions should also check DB for existing actions.
 *
 * Should be called after handlers are registered.
 *
 * @example
 * // In instrumentation.ts or startup
 * import { initializeScheduledActions, initializeRecurringActions } from './'
 * initializeScheduledActions()
 * await initializeRecurringActions()
 */
export async function initializeRecurringActions(): Promise<void> {
  if (globalForInit.__scheduledActionsRecurringInitialized) {
    console.log('[ScheduledActions] Recurring actions already initialized, skipping...')
    return
  }

  const [projectName, module] = Object.entries(SCHEDULED_ACTIONS_REGISTRY)[0] ?? []

  if (module) {
    console.log(`[ScheduledActions] Initializing recurring actions for project: ${projectName}`)
    await module.registerRecurringActions()
    globalForInit.__scheduledActionsRecurringInitialized = true
    console.log(`[ScheduledActions] ✅ Recurring actions initialized successfully`)
  } else {
    console.warn('[ScheduledActions] No recurring project actions found')
  }
}
