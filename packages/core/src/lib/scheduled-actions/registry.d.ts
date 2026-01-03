/**
 * Scheduled Actions - Registry
 * Manages registration and lookup of action handlers
 */
import type { ScheduledActionDefinition, ScheduledActionHandler } from './types';
/**
 * Register a scheduled action handler
 *
 * @param name - Unique action identifier (e.g., 'webhook:send')
 * @param handler - Function to execute when action is processed
 * @param options - Optional configuration (description, timeout)
 *
 * @example
 * registerScheduledAction('webhook:send', async (payload, action) => {
 *   await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload) })
 * }, { description: 'Send webhook notification' })
 */
export declare function registerScheduledAction(name: string, handler: ScheduledActionHandler, options?: {
    description?: string;
    timeout?: number;
}): void;
/**
 * Get a registered action handler by name
 *
 * @param name - Action identifier
 * @returns Action definition or undefined if not found
 */
export declare function getActionHandler(name: string): ScheduledActionDefinition | undefined;
/**
 * Get all registered action names
 * Useful for debugging and DevTools UI
 *
 * @returns Array of registered action names
 */
export declare function getAllRegisteredActions(): string[];
/**
 * Check if an action is registered
 *
 * @param name - Action identifier
 * @returns True if action is registered
 */
export declare function isActionRegistered(name: string): boolean;
/**
 * Clear all registered actions
 * Primarily for testing purposes
 */
export declare function clearActionRegistry(): void;
//# sourceMappingURL=registry.d.ts.map