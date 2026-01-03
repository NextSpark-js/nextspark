/**
 * Hook System for Plugin Architecture
 * 
 * Provides a WordPress-like hook system for plugins to interact with the core
 */

type HookCallback<T = Record<string, unknown>> = (data: T, ...args: unknown[]) => Promise<T> | T
type HookCallbackVoid<T = Record<string, unknown>> = (data: T, ...args: unknown[]) => Promise<void> | void

/**
 * Hook system implementation
 */
export class HookSystem {
  private filters = new Map<string, HookCallback[]>()
  private actions = new Map<string, HookCallbackVoid[]>()
  private hookStats = new Map<string, { calls: number; totalTime: number }>()

  /**
   * Add a filter hook
   * Filters allow plugins to modify data as it passes through the system
   */
  addFilter(hookName: string, callback: HookCallback, priority = 10): void {
    if (!this.filters.has(hookName)) {
      this.filters.set(hookName, [])
    }

    const hooks = this.filters.get(hookName)!
    
    // Insert callback based on priority (lower number = higher priority)
    const insertIndex = hooks.findIndex((_, index) => {
      // Simple priority-based insertion for now
      return index >= priority
    })

    if (insertIndex === -1) {
      hooks.push(callback)
    } else {
      hooks.splice(insertIndex, 0, callback)
    }

    console.log(`[Hooks] Added filter hook: ${hookName} (priority: ${priority})`)
  }

  /**
   * Apply filter hooks to data
   */
  async applyFilters<T>(hookName: string, data: T, ...args: unknown[]): Promise<T> {
    const startTime = performance.now()
    
    const hooks = this.filters.get(hookName) || []
    let result = data

    console.log(`[Hooks] Applying ${hooks.length} filter hooks for: ${hookName}`)

    for (const callback of hooks) {
      try {
        const hookResult = await callback(result as Record<string, unknown>, ...args)
        if (hookResult !== undefined) {
          result = hookResult as T
        }
      } catch (error) {
        console.error(`[Hooks] Error in filter hook ${hookName}:`, error)
      }
    }

    this.recordHookStats(hookName, startTime)
    return result
  }

  /**
   * Add an action hook
   * Actions allow plugins to execute code at specific points
   */
  addAction(hookName: string, callback: HookCallbackVoid, priority = 10): void {
    if (!this.actions.has(hookName)) {
      this.actions.set(hookName, [])
    }

    const hooks = this.actions.get(hookName)!
    
    // Insert callback based on priority
    const insertIndex = hooks.findIndex((_, index) => {
      return index >= priority
    })

    if (insertIndex === -1) {
      hooks.push(callback)
    } else {
      hooks.splice(insertIndex, 0, callback)
    }

    console.log(`[Hooks] Added action hook: ${hookName} (priority: ${priority})`)
  }

  /**
   * Execute action hooks
   */
  async doAction<T>(hookName: string, data: T, ...args: unknown[]): Promise<void> {
    const startTime = performance.now()
    
    const hooks = this.actions.get(hookName) || []

    console.log(`[Hooks] Executing ${hooks.length} action hooks for: ${hookName}`)

    const promises = hooks.map(async (callback) => {
      try {
        await callback(data as Record<string, unknown>, ...args)
      } catch (error) {
        console.error(`[Hooks] Error in action hook ${hookName}:`, error)
      }
    })

    await Promise.allSettled(promises)
    this.recordHookStats(hookName, startTime)
  }

  /**
   * Emit an event (alias for doAction for semantic clarity)
   */
  async emit<T>(eventName: string, data: T, ...args: unknown[]): Promise<void> {
    return this.doAction(eventName, data, ...args)
  }

  /**
   * Remove a filter hook
   */
  removeFilter(hookName: string, callback: HookCallback): boolean {
    const hooks = this.filters.get(hookName)
    if (!hooks) return false

    const index = hooks.indexOf(callback)
    if (index === -1) return false

    hooks.splice(index, 1)
    
    if (hooks.length === 0) {
      this.filters.delete(hookName)
    }

    console.log(`[Hooks] Removed filter hook: ${hookName}`)
    return true
  }

  /**
   * Remove an action hook
   */
  removeAction(hookName: string, callback: HookCallbackVoid): boolean {
    const hooks = this.actions.get(hookName)
    if (!hooks) return false

    const index = hooks.indexOf(callback)
    if (index === -1) return false

    hooks.splice(index, 1)
    
    if (hooks.length === 0) {
      this.actions.delete(hookName)
    }

    console.log(`[Hooks] Removed action hook: ${hookName}`)
    return true
  }

  /**
   * Check if a hook has any callbacks
   */
  hasHook(hookName: string): boolean {
    return (this.filters.has(hookName) && this.filters.get(hookName)!.length > 0) ||
           (this.actions.has(hookName) && this.actions.get(hookName)!.length > 0)
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): { filters: string[]; actions: string[] } {
    return {
      filters: Array.from(this.filters.keys()),
      actions: Array.from(this.actions.keys())
    }
  }

  /**
   * Record hook execution statistics
   */
  private recordHookStats(hookName: string, startTime: number): void {
    const endTime = performance.now()
    const duration = endTime - startTime

    if (!this.hookStats.has(hookName)) {
      this.hookStats.set(hookName, { calls: 0, totalTime: 0 })
    }

    const stats = this.hookStats.get(hookName)!
    stats.calls++
    stats.totalTime += duration
  }

  /**
   * Get hook execution statistics
   */
  getHookStats(): Record<string, { calls: number; totalTime: number; avgTime: number }> {
    const result: Record<string, { calls: number; totalTime: number; avgTime: number }> = {}

    for (const [hookName, stats] of this.hookStats) {
      result[hookName] = {
        calls: stats.calls,
        totalTime: stats.totalTime,
        avgTime: stats.calls > 0 ? stats.totalTime / stats.calls : 0
      }
    }

    return result
  }

  /**
   * Clear all hooks (useful for testing)
   */
  clear(): void {
    this.filters.clear()
    this.actions.clear()
    this.hookStats.clear()
    console.log('[Hooks] Cleared all hooks')
  }

  /**
   * Get hook count
   */
  getHookCount(): { filters: number; actions: number } {
    const filterCount = Array.from(this.filters.values()).reduce((sum, hooks) => sum + hooks.length, 0)
    const actionCount = Array.from(this.actions.values()).reduce((sum, hooks) => sum + hooks.length, 0)

    return { filters: filterCount, actions: actionCount }
  }
}

// Global hook system instance using globalThis for cross-module persistence in Next.js
const HOOK_SYSTEM_KEY = '__HOOK_SYSTEM__' as const

declare global {
  // eslint-disable-next-line no-var
  var __HOOK_SYSTEM__: HookSystem | undefined
}

/**
 * Create or get the global hook system
 * Uses globalThis to persist across module reloads in Next.js (Turbopack/Webpack)
 */
export function createHookSystem(): HookSystem {
  if (!globalThis[HOOK_SYSTEM_KEY]) {
    globalThis[HOOK_SYSTEM_KEY] = new HookSystem()
  }
  return globalThis[HOOK_SYSTEM_KEY]
}

/**
 * Get the global hook system
 */
export function getGlobalHooks(): HookSystem {
  return createHookSystem()
}

// Convenience functions using the global hook system
const hooks = createHookSystem()

export const addFilter = (hookName: string, callback: HookCallback, priority = 10) => 
  hooks.addFilter(hookName, callback, priority)

export const applyFilters = <T>(hookName: string, data: T, ...args: unknown[]) => 
  hooks.applyFilters(hookName, data, ...args)

export const addAction = (hookName: string, callback: HookCallbackVoid, priority = 10) => 
  hooks.addAction(hookName, callback, priority)

export const doAction = <T>(hookName: string, data: T, ...args: unknown[]) => 
  hooks.doAction(hookName, data, ...args)

export const emit = <T>(eventName: string, data: T, ...args: unknown[]) => 
  hooks.emit(eventName, data, ...args)

export const removeFilter = (hookName: string, callback: HookCallback) => 
  hooks.removeFilter(hookName, callback)

export const removeAction = (hookName: string, callback: HookCallbackVoid) => 
  hooks.removeAction(hookName, callback)

export const hasHook = (hookName: string) => 
  hooks.hasHook(hookName)

export const getAllHooks = () => 
  hooks.getAllHooks()

export const getHookStats = () => 
  hooks.getHookStats()