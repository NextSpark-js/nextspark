/**
 * Entity Hook System Integration
 * 
 * Provides WordPress-like hooks for entity operations
 * Allows plugins to extend entity behavior without modifying core code
 */

import { getGlobalHooks } from '../plugins/hook-system'
import type { EntityConfig } from './types'

/**
 * Entity operation data for hooks
 */
export interface EntityHookData<T = Record<string, unknown>> {
  entityName: string
  entityConfig: EntityConfig
  data?: T
  userId?: string
  operation: 'create' | 'read' | 'update' | 'delete'
  id?: string
  changes?: Partial<T>
}

/**
 * Entity validation result
 */
export interface EntityValidationResult {
  valid: boolean
  errors: string[]
  data?: unknown
}

/**
 * Entity Hook Manager
 * Provides integration points for plugins to extend entity operations
 */
export class EntityHookManager {
  private hooks = getGlobalHooks()

  /**
   * Hook: Before entity creation
   * Allows plugins to validate, modify, or prevent entity creation
   */
  async beforeEntityCreate<T>(entityName: string, data: T, userId?: string): Promise<T> {
    const hookData: EntityHookData<T> = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      data,
      userId,
      operation: 'create'
    }

    // Apply filters to modify the data before creation
    const filteredData = await this.hooks.applyFilters(
      `entity.${entityName}.before_create`, 
      hookData
    )

    // Emit action for plugins to execute side effects
    await this.hooks.doAction(
      `entity.${entityName}.creating`,
      filteredData
    )

    return filteredData.data as T
  }

  /**
   * Hook: After entity creation
   * Allows plugins to react to entity creation events
   */
  async afterEntityCreate<T>(entityName: string, data: T, userId?: string): Promise<void> {
    const hookData: EntityHookData<T> = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      data,
      userId,
      operation: 'create'
    }

    // Emit action for plugins to execute side effects
    await this.hooks.doAction(
      `entity.${entityName}.created`,
      hookData
    )

    // Generic entity created hook
    await this.hooks.doAction('entity.created', hookData)
  }

  /**
   * Hook: Before entity update
   */
  async beforeEntityUpdate<T>(entityName: string, id: string, changes: Partial<T>, userId?: string): Promise<Partial<T>> {
    const hookData: EntityHookData<T> = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      id,
      changes,
      userId,
      operation: 'update'
    }

    const filteredData = await this.hooks.applyFilters(
      `entity.${entityName}.before_update`,
      hookData
    )

    await this.hooks.doAction(
      `entity.${entityName}.updating`,
      filteredData
    )

    return filteredData.changes as Partial<T>
  }

  /**
   * Hook: After entity update
   */
  async afterEntityUpdate<T>(entityName: string, id: string, data: T, changes: Partial<T>, userId?: string): Promise<void> {
    const hookData: EntityHookData<T> = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      id,
      data,
      changes,
      userId,
      operation: 'update'
    }

    await this.hooks.doAction(
      `entity.${entityName}.updated`,
      hookData
    )

    await this.hooks.doAction('entity.updated', hookData)
  }

  /**
   * Hook: Before entity deletion
   */
  async beforeEntityDelete(entityName: string, id: string, userId?: string): Promise<boolean> {
    const hookData: EntityHookData = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      id,
      userId,
      operation: 'delete'
    }

    // Allow plugins to prevent deletion by modifying the data
    const filteredData = await this.hooks.applyFilters(
      `entity.${entityName}.before_delete`,
      { ...hookData, allowDelete: true }
    )

    await this.hooks.doAction(
      `entity.${entityName}.deleting`,
      filteredData
    )

    return (filteredData as { allowDelete?: boolean }).allowDelete !== false
  }

  /**
   * Hook: After entity deletion
   */
  async afterEntityDelete(entityName: string, id: string, userId?: string): Promise<void> {
    const hookData: EntityHookData = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      id,
      userId,
      operation: 'delete'
    }

    await this.hooks.doAction(
      `entity.${entityName}.deleted`,
      hookData
    )

    await this.hooks.doAction('entity.deleted', hookData)
  }

  /**
   * Hook: Entity validation
   * Allows plugins to add custom validation rules
   */
  async validateEntity<T>(entityName: string, data: T, operation: 'create' | 'update'): Promise<EntityValidationResult> {
    const hookData = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      data,
      operation,
      validation: { valid: true, errors: [] as string[] }
    }

    const result = await this.hooks.applyFilters(
      `entity.${entityName}.validate`,
      hookData
    )

    // Also apply generic entity validation hooks
    const genericResult = await this.hooks.applyFilters(
      'entity.validate',
      result
    )

    return {
      valid: genericResult.validation.valid,
      errors: genericResult.validation.errors,
      data: genericResult.data
    }
  }

  /**
   * Hook: Before entity query/read
   */
  async beforeEntityRead(entityName: string, query: Record<string, unknown>, userId?: string): Promise<Record<string, unknown>> {
    const hookData = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      query,
      userId,
      operation: 'read' as const
    }

    const filteredData = await this.hooks.applyFilters(
      `entity.${entityName}.before_read`,
      hookData
    )

    return filteredData.query
  }

  /**
   * Hook: After entity query/read
   */
  async afterEntityRead<T>(entityName: string, results: T[], query: Record<string, unknown>, userId?: string): Promise<T[]> {
    const hookData = {
      entityName,
      entityConfig: this.getEntityConfig(entityName),
      results,
      query,
      userId,
      operation: 'read' as const
    }

    const filteredData = await this.hooks.applyFilters(
      `entity.${entityName}.after_read`,
      hookData
    )

    return filteredData.results
  }

  /**
   * Authentication hooks
   */
  async onUserLogin(user: Record<string, unknown>): Promise<void> {
    await this.hooks.doAction('auth.user.login', { user })
  }

  async onUserLogout(user: Record<string, unknown>): Promise<void> {
    await this.hooks.doAction('auth.user.logout', { user })
  }

  async onUserRegister(user: Record<string, unknown>): Promise<void> {
    await this.hooks.doAction('auth.user.register', { user })
  }

  /**
   * Get entity configuration (placeholder)
   */
  private getEntityConfig(entityName: string): EntityConfig {
    // This would get the actual entity configuration from the registry
    // For now, return a minimal config to prevent errors
    return {
      name: entityName,
      displayName: entityName,
      pluralName: `${entityName}s`,
      // Placeholder values to satisfy the interface
      icon: null,
      fields: [],
      features: { enabled: true },
      // Permissions are defined centrally in permissions.config.ts
      planLimits: { free: {}, starter: {}, premium: {} },
      routes: { list: '', detail: '' },
      hooks: {},
      database: { table: entityName },
      api: { enabled: true }
    } as unknown as EntityConfig
  }
}

// Create singleton instance
export const entityHookManager = new EntityHookManager()

// Convenience exports
export const beforeEntityCreate = <T>(entityName: string, data: T, userId?: string) => 
  entityHookManager.beforeEntityCreate(entityName, data, userId)

export const afterEntityCreate = <T>(entityName: string, data: T, userId?: string) => 
  entityHookManager.afterEntityCreate(entityName, data, userId)

export const beforeEntityUpdate = <T>(entityName: string, id: string, changes: Partial<T>, userId?: string) => 
  entityHookManager.beforeEntityUpdate(entityName, id, changes, userId)

export const afterEntityUpdate = <T>(entityName: string, id: string, data: T, changes: Partial<T>, userId?: string) => 
  entityHookManager.afterEntityUpdate(entityName, id, data, changes, userId)

export const beforeEntityDelete = (entityName: string, id: string, userId?: string) => 
  entityHookManager.beforeEntityDelete(entityName, id, userId)

export const afterEntityDelete = (entityName: string, id: string, userId?: string) => 
  entityHookManager.afterEntityDelete(entityName, id, userId)

export const validateEntity = <T>(entityName: string, data: T, operation: 'create' | 'update') => 
  entityHookManager.validateEntity(entityName, data, operation)

export const beforeEntityRead = (entityName: string, query: Record<string, unknown>, userId?: string) => 
  entityHookManager.beforeEntityRead(entityName, query, userId)

export const afterEntityRead = <T>(entityName: string, results: T[], query: Record<string, unknown>, userId?: string) =>
  entityHookManager.afterEntityRead(entityName, results, query, userId)

// ============================================
// AUTO-REGISTER CORE HOOKS
// ============================================
// Initialize pattern usage hooks to track which entities use each pattern
import { initPatternUsageHooks } from './pattern-usage-hooks'
initPatternUsageHooks()