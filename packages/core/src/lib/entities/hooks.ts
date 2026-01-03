/**
 * Entity Hook System
 * 
 * Provides lifecycle hooks for entities with support for plan limits,
 * flag system, child entities, and comprehensive hook management.
 */

import type {
  HookFunction,
  HookContext,
  HookResult,
  CRUDOperation,
  EntityConfig,
} from './types'

/**
 * Hook execution priority levels
 */
export enum HookPriority {
  HIGHEST = 0,
  HIGH = 10,
  NORMAL = 50,
  LOW = 90,
  LOWEST = 100
}

/**
 * Hook registration with priority
 */
interface HookRegistration {
  hook: HookFunction
  priority: HookPriority
  name?: string
}

/**
 * Hook execution statistics
 */
interface HookStats {
  entityName: string
  hookType: string
  executionCount: number
  averageExecutionTime: number
  lastExecuted: Date
}

/**
 * EntityHookManager - Manages lifecycle hooks for entities
 */
export class EntityHookManager {
  private hooks: Map<string, HookRegistration[]> = new Map()
  private stats: Map<string, HookStats> = new Map()
  private enabled = true

  /**
   * Register a hook for a specific entity and hook type
   */
  registerHook(
    entityName: string,
    hookType: string,
    hook: HookFunction,
    priority: HookPriority = HookPriority.NORMAL,
    name?: string
  ): void {
    const key = `${entityName}:${hookType}`
    const existing = this.hooks.get(key) || []
    
    existing.push({ hook, priority, name })
    existing.sort((a, b) => a.priority - b.priority) // Lower numbers = higher priority
    
    this.hooks.set(key, existing)
  }

  /**
   * Register hooks from entity configuration
   */
  registerEntityHooks(config: EntityConfig): void {
    if (!(config as any).hooks) return

    const slug = config.slug

    // Register each hook type from the entity configuration
    for (const [hookType, hooks] of Object.entries((config as any).hooks)) {
      if (Array.isArray(hooks)) {
        hooks.forEach((hook) => {
          // onPlanLimitReached hooks have high priority
          const priority = hookType === 'onPlanLimitReached'
            ? HookPriority.HIGH
            : HookPriority.NORMAL

          this.registerHook(slug, hookType, hook, priority)
        })
      }
    }
  }

  /**
   * Execute hooks for a specific entity and hook type
   */
  async executeHooks(
    entityName: string,
    hookType: string,
    context: HookContext
  ): Promise<HookResult> {
    if (!this.enabled) {
      return { continue: true }
    }

    const key = `${entityName}:${hookType}`
    const hooks = this.hooks.get(key) || []
    
    if (hooks.length === 0) {
      return { continue: true }
    }

    const startTime = Date.now()
    let modifiedData = context.data

    for (const { hook, name } of hooks) {
      try {
        const hookContext: HookContext = {
          ...context,
          data: modifiedData // Pass modified data from previous hooks
        }

        const result = await hook(hookContext)
        
        if (result && !result.continue) {
          this.updateStats(key, Date.now() - startTime)
          return result
        }

        // Update data if hook modified it
        if (result?.data !== undefined) {
          modifiedData = result.data
        }

      } catch (error) {
        console.error(`Hook execution failed for ${key}${name ? ` (${name})` : ''}:`, error)
        
        // Return error result for critical hooks
        if (hookType.includes('before') || hookType.includes('validation')) {
          return {
            continue: false,
            error: `Hook execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
        
        // Continue execution for non-critical hooks
        continue
      }
    }

    this.updateStats(key, Date.now() - startTime)

    return {
      continue: true,
      data: modifiedData
    }
  }

  /**
   * Execute before hooks (can modify data and stop execution)
   */
  async executeBeforeHooks(
    entityName: string,
    operation: CRUDOperation,
    context: HookContext
  ): Promise<HookResult> {
    const hookType = `before${operation.charAt(0).toUpperCase() + operation.slice(1)}`
    return this.executeHooks(entityName, hookType, context)
  }

  /**
   * Execute after hooks (notifications, cleanup, etc.)
   */
  async executeAfterHooks(
    entityName: string,
    operation: CRUDOperation,
    context: HookContext
  ): Promise<void> {
    const hookType = `after${operation.charAt(0).toUpperCase() + operation.slice(1)}`
    await this.executeHooks(entityName, hookType, context)
  }

  /**
   * Execute plan limit hooks
   */
  async executePlanLimitHooks(
    entityName: string,
    limitType: 'reached' | 'upgrade',
    context: HookContext
  ): Promise<HookResult> {
    const hookType = limitType === 'reached' ? 'onPlanLimitReached' : 'onPlanUpgradeRequired'
    return this.executeHooks(entityName, hookType, context)
  }

  /**
   * Execute flag system hooks
   */
  async executeFlagHooks(
    entityName: string,
    flagEvent: 'conflict' | 'granted' | 'denied',
    context: HookContext
  ): Promise<HookResult> {
    const hookTypeMap = {
      conflict: 'onFlagConflict',
      granted: 'onFlagAccessGranted',
      denied: 'onFlagAccessDenied'
    }
    
    return this.executeHooks(entityName, hookTypeMap[flagEvent], context)
  }

  /**
   * Execute child entity hooks
   */
  async executeChildHooks(
    parentEntityName: string,
    childName: string,
    hookType: string,
    context: HookContext
  ): Promise<HookResult> {
    // Execute parent-level child hooks first
    const parentResult = await this.executeHooks(parentEntityName, hookType, context)
    if (!parentResult.continue) return parentResult

    // Execute child-specific hooks
    const childKey = `${parentEntityName}.${childName}`
    return this.executeHooks(childKey, hookType, {
      ...context,
      data: parentResult.data || context.data
    })
  }

  /**
   * Remove hooks for an entity
   */
  removeEntityHooks(entityName: string): void {
    const keysToRemove = Array.from(this.hooks.keys()).filter(key => 
      key.startsWith(`${entityName}:`)
    )
    
    keysToRemove.forEach(key => this.hooks.delete(key))
  }

  /**
   * Remove specific hook
   */
  removeHook(entityName: string, hookType: string, hookName?: string): void {
    const key = `${entityName}:${hookType}`
    const hooks = this.hooks.get(key) || []
    
    if (hookName) {
      const filtered = hooks.filter(h => h.name !== hookName)
      this.hooks.set(key, filtered)
    } else {
      this.hooks.delete(key)
    }
  }

  /**
   * Get registered hooks for entity
   */
  getEntityHooks(entityName: string): Record<string, HookRegistration[]> {
    const entityHooks: Record<string, HookRegistration[]> = {}
    
    for (const [key, hooks] of this.hooks.entries()) {
      if (key.startsWith(`${entityName}:`)) {
        const hookType = key.split(':')[1]
        entityHooks[hookType] = hooks
      }
    }
    
    return entityHooks
  }

  /**
   * Update hook execution statistics
   */
  private updateStats(key: string, executionTime: number): void {
    const [entityName, hookType] = key.split(':')
    const statsKey = `${entityName}-${hookType}`
    
    const existing = this.stats.get(statsKey)
    if (existing) {
      existing.executionCount++
      existing.averageExecutionTime = 
        (existing.averageExecutionTime * (existing.executionCount - 1) + executionTime) / 
        existing.executionCount
      existing.lastExecuted = new Date()
    } else {
      this.stats.set(statsKey, {
        entityName,
        hookType,
        executionCount: 1,
        averageExecutionTime: executionTime,
        lastExecuted: new Date()
      })
    }
  }

  /**
   * Get hook execution statistics
   */
  getStats(): HookStats[] {
    return Array.from(this.stats.values())
  }

  /**
   * Enable/disable hook execution
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Clear all hooks and stats
   */
  clear(): void {
    this.hooks.clear()
    this.stats.clear()
  }

  /**
   * Get total number of registered hooks
   */
  getHookCount(): number {
    return Array.from(this.hooks.values()).reduce((total, hooks) => total + hooks.length, 0)
  }
}

// Global hook manager instance
export const entityHookManager = new EntityHookManager()

// Convenience functions
export function registerHook(
  entityName: string,
  hookType: string,
  hook: HookFunction,
  priority?: HookPriority,
  name?: string
): void {
  entityHookManager.registerHook(entityName, hookType, hook, priority, name)
}

export function executeEntityHooks(
  entityName: string,
  hookType: string,
  context: HookContext
): Promise<HookResult> {
  return entityHookManager.executeHooks(entityName, hookType, context)
}

export function executeBeforeHooks(
  entityName: string,
  operation: CRUDOperation,
  context: HookContext
): Promise<HookResult> {
  return entityHookManager.executeBeforeHooks(entityName, operation, context)
}

export function executeAfterHooks(
  entityName: string,
  operation: CRUDOperation,
  context: HookContext
): Promise<void> {
  return entityHookManager.executeAfterHooks(entityName, operation, context)
}

// Built-in hook functions for common use cases

/**
 * Built-in hook: Log entity operations
 */
export const logOperationHook: HookFunction = async (context) => {
  console.log(`[${context.entityName}] ${context.operation} operation by user ${context.user.id}`)
  return { continue: true }
}

/**
 * Built-in hook: Validate required fields
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const validateRequiredFieldsHook: HookFunction = async (_context) => {
  // This would validate required fields based on entity configuration
  // Implementation would depend on the specific entity configuration
  return { continue: true }
}

/**
 * Built-in hook: Check plan limits before creation
 */
export const checkPlanLimitsHook: HookFunction = async (context) => {
  if (context.operation === 'create') {
    // This would check current usage against plan limits
    // Implementation would involve checking current record count
    // and comparing against user's plan limits
    console.log(`Checking plan limits for ${context.entityName}`)
  }
  return { continue: true }
}

/**
 * Built-in hook: Audit trail for sensitive operations
 */
export const auditTrailHook: HookFunction = async (context) => {
  if (['create', 'update', 'delete'].includes(context.operation)) {
    // This would log the operation to an audit trail
    console.log(`[AUDIT] ${context.entityName} ${context.operation} by ${context.user.role} user ${context.user.id}`)
  }
  return { continue: true }
}