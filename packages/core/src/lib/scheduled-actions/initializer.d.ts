/**
 * Scheduled Actions - Initializer
 *
 * Core service that initializes scheduled action handlers from the active theme.
 * This module reads from the auto-generated scheduled-actions-registry and
 * calls the theme's registration functions.
 *
 * @module core/lib/scheduled-actions/initializer
 */
import 'server-only';
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
export declare function initializeScheduledActions(): void;
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
export declare function initializeRecurringActions(): Promise<void>;
//# sourceMappingURL=initializer.d.ts.map