/**
 * Scheduled Actions - Initializer
 *
 * Core service that initializes scheduled action handlers from the active theme.
 * This module reads from the auto-generated scheduled-actions-registry and
 * calls the theme's registration functions.
 *
 * @module core/lib/scheduled-actions/initializer
 */

import 'server-only'

import { SCHEDULED_ACTIONS_REGISTRY } from '@nextsparkjs/registries/scheduled-actions-registry'

// Guard to prevent multiple initializations
let initialized = false

/**
 * Get the active theme name from environment
 */
function getActiveTheme(): string {
  return process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '') || 'default'
}

/**
 * Initialize scheduled action handlers for the active theme
 *
 * This function reads from the auto-generated registry and calls
 * the theme's registerAllHandlers function to register action handlers.
 *
 * Should be called at server startup (e.g., in cron endpoints, instrumentation.ts)
 *
 * @example
 * // In cron endpoint
 * import { initializeScheduledActions } from './'
 * initializeScheduledActions()
 */
export function initializeScheduledActions(): void {
  if (initialized) {
    console.log('[ScheduledActions] Already initialized, skipping...')
    return
  }

  const themeName = getActiveTheme()
  const module = SCHEDULED_ACTIONS_REGISTRY[themeName]

  if (module) {
    console.log(`[ScheduledActions] Initializing handlers for theme: ${themeName}`)
    module.registerAllHandlers()
    initialized = true
    console.log(`[ScheduledActions] Handlers initialized successfully`)
  } else {
    console.warn(`[ScheduledActions] No handlers found for theme: ${themeName}`)
  }
}

/**
 * Initialize recurring scheduled actions for the active theme
 *
 * This async function reads from the auto-generated registry and calls
 * the theme's registerRecurringActions function to schedule recurring tasks.
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
  const themeName = getActiveTheme()
  const module = SCHEDULED_ACTIONS_REGISTRY[themeName]

  if (module) {
    console.log(`[ScheduledActions] Initializing recurring actions for theme: ${themeName}`)
    await module.registerRecurringActions()
    console.log(`[ScheduledActions] Recurring actions initialized successfully`)
  } else {
    console.warn(`[ScheduledActions] No recurring actions found for theme: ${themeName}`)
  }
}
