/**
 * Scheduled Actions - Core Handlers
 *
 * This module exports all core scheduled action handlers.
 * The processor registers them on demand (registerCoreHandlers), so every
 * core action type runs wherever the processor runs — including a serverless
 * cron instance that never saw the request that enqueued the action.
 *
 * @module core/lib/scheduled-actions/handlers
 */

import { isActionRegistered } from '../registry'
import { registerPatternCacheInvalidationHandler } from './invalidate-pattern-cache'
import { registerSecurityNotificationAction } from './security-notification'

export { registerPatternCacheInvalidationHandler, registerSecurityNotificationAction }

/** Every action type core enqueues, with the function that registers its handler. */
const CORE_HANDLERS: Record<string, () => void> = {
  'pattern:invalidate-cache': registerPatternCacheInvalidationHandler,
  'auth:security-notification': registerSecurityNotificationAction,
}

/**
 * Register the handler of each core action type that has none yet.
 * A handler the project registered under the same name is kept.
 */
export function registerCoreHandlers(): void {
  for (const [name, register] of Object.entries(CORE_HANDLERS)) {
    if (!isActionRegistered(name)) register()
  }
}
