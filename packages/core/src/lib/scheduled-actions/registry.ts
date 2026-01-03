/**
 * Scheduled Actions - Registry
 * Manages registration and lookup of action handlers
 */

import type { ScheduledActionDefinition, ScheduledActionHandler } from './types'

/**
 * In-memory registry of action handlers
 * Key: action name (e.g., 'webhook:send', 'billing:check-renewals')
 * Value: action definition with handler function
 */
const actionRegistry = new Map<string, ScheduledActionDefinition>()

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
export function registerScheduledAction(
  name: string,
  handler: ScheduledActionHandler,
  options?: { description?: string; timeout?: number }
): void {
  if (actionRegistry.has(name)) {
    console.warn(`[ScheduledActions] Action '${name}' is already registered. Overwriting.`)
  }

  actionRegistry.set(name, {
    name,
    handler,
    description: options?.description,
    timeout: options?.timeout
  })

  console.log(`[ScheduledActions] Registered action: ${name}`)
}

/**
 * Get a registered action handler by name
 *
 * @param name - Action identifier
 * @returns Action definition or undefined if not found
 */
export function getActionHandler(name: string): ScheduledActionDefinition | undefined {
  return actionRegistry.get(name)
}

/**
 * Get all registered action names
 * Useful for debugging and DevTools UI
 *
 * @returns Array of registered action names
 */
export function getAllRegisteredActions(): string[] {
  return Array.from(actionRegistry.keys())
}

/**
 * Check if an action is registered
 *
 * @param name - Action identifier
 * @returns True if action is registered
 */
export function isActionRegistered(name: string): boolean {
  return actionRegistry.has(name)
}

/**
 * Clear all registered actions
 * Primarily for testing purposes
 */
export function clearActionRegistry(): void {
  actionRegistry.clear()
  console.log('[ScheduledActions] Registry cleared')
}
