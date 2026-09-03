/**
 * Entity Hook System Integration
 * 
 * Provides WordPress-like hooks for entity operations
 * Allows plugins to extend entity behavior without modifying core code
 */

import { getGlobalHooks } from '../plugins/hook-system'
import { getEntityBySlug, getRegisteredEntities } from './queries'
import type { EntityConfig, EntityHooks, HookFunction, CRUDOperation } from './types'

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

// ============================================
// DECLARATIVE EntityConfig.hooks BRIDGE
// ============================================
// Translates the documented `EntityConfig.hooks` contract (see
// docs/04-entities/08-hooks-and-lifecycle.md) into registrations on the same
// global HookSystem the before/after methods below read from — so a hook
// declared on an entity config and one registered imperatively via
// addFilter/addAction for the same entity both fire through one system.
//
// Registration is lazy (triggered from getEntityConfig(), the first thing
// every method below calls) rather than at module load: the entity registry
// (getRegisteredEntities()) is only populated once a route/page module calls
// setEntityRegistry(), which happens after this module is first imported.
// The globalThis guard — same pattern createHookSystem() uses for the hook
// system singleton itself — makes this a true one-time scan per server
// process, even though setEntityRegistry() runs from ~9 separate modules.

const CONFIG_HOOKS_REGISTERED_KEY = '__ENTITY_CONFIG_HOOKS_REGISTERED__' as const

declare global {
  // eslint-disable-next-line no-var
  var __ENTITY_CONFIG_HOOKS_REGISTERED__: boolean | undefined
}

function toHookContext(entityName: string, operation: CRUDOperation | 'query', data: unknown, userId?: string) {
  return {
    entityName,
    operation,
    data,
    user: { id: userId ?? '', role: 'member' as const },
  }
}

/**
 * Wrap a declared HookFunction as a rejecting HookSystem filter: `{continue:
 * false}` (or a thrown error) aborts the operation via applyFiltersStrict;
 * otherwise the (possibly modified) payload at `payloadKey` is merged back.
 */
function wrapAsRejectingFilter(fn: HookFunction, operation: CRUDOperation | 'query', payloadKey: string) {
  return async (hookData: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const result = await fn(toHookContext(hookData.entityName as string, operation, hookData[payloadKey], hookData.userId as string | undefined))
    if (result && result.continue === false) {
      throw new Error(result.error || `Rejected by declared ${operation} hook for ${String(hookData.entityName)}`)
    }
    if (!result || result.data === undefined) return hookData
    return { ...hookData, [payloadKey]: result.data }
  }
}

/**
 * Wrap a declared HookFunction as a shaping (non-rejecting) HookSystem
 * filter — for read hooks, which shape a query/result set rather than gate
 * an operation. `continue: false` has no meaning here and is ignored.
 */
function wrapAsShapingFilter(fn: HookFunction, operation: CRUDOperation | 'query', payloadKey: string) {
  return async (hookData: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const result = await fn(toHookContext(hookData.entityName as string, operation, hookData[payloadKey], hookData.userId as string | undefined))
    if (!result || result.data === undefined) return hookData
    return { ...hookData, [payloadKey]: result.data }
  }
}

/** Wrap a declared HookFunction as a HookSystem action (fire-and-forget notification; return value ignored). */
function wrapAsAction(fn: HookFunction, operation: CRUDOperation | 'query') {
  return async (hookData: Record<string, unknown>): Promise<void> => {
    await fn(toHookContext(hookData.entityName as string, operation, hookData.data, hookData.userId as string | undefined))
  }
}

/**
 * Declared EntityConfig.hooks key → the entity.<slug>.* event the matching
 * before/after method actually fires. Plan-limit / flag / child-entity hook
 * keys are intentionally not bridged here: nothing in this manager fires
 * those events today (they belong to billing/subscription code, a separate
 * concern from the CRUD-lifecycle unification this bridges).
 */
const DECLARED_HOOK_BRIDGE: ReadonlyArray<{
  key: keyof EntityHooks
  event: (slug: string) => string
  wrap: (fn: HookFunction, operation: CRUDOperation | 'query') => (hookData: Record<string, unknown>) => Promise<unknown>
  operation: CRUDOperation | 'query'
  register: 'filter' | 'action'
}> = [
  { key: 'beforeCreate', event: slug => `entity.${slug}.before_create`, wrap: (fn, op) => wrapAsRejectingFilter(fn, op, 'data'), operation: 'create', register: 'filter' },
  { key: 'afterCreate', event: slug => `entity.${slug}.created`, wrap: wrapAsAction, operation: 'create', register: 'action' },
  { key: 'beforeUpdate', event: slug => `entity.${slug}.before_update`, wrap: (fn, op) => wrapAsRejectingFilter(fn, op, 'changes'), operation: 'update', register: 'filter' },
  { key: 'afterUpdate', event: slug => `entity.${slug}.updated`, wrap: wrapAsAction, operation: 'update', register: 'action' },
  { key: 'beforeDelete', event: slug => `entity.${slug}.before_delete`, wrap: (fn, op) => wrapAsRejectingFilter(fn, op, 'id'), operation: 'delete', register: 'filter' },
  { key: 'afterDelete', event: slug => `entity.${slug}.deleted`, wrap: wrapAsAction, operation: 'delete', register: 'action' },
  { key: 'beforeQuery', event: slug => `entity.${slug}.before_read`, wrap: (fn, op) => wrapAsShapingFilter(fn, op, 'query'), operation: 'query', register: 'filter' },
  { key: 'afterQuery', event: slug => `entity.${slug}.after_read`, wrap: (fn, op) => wrapAsShapingFilter(fn, op, 'results'), operation: 'query', register: 'filter' },
]

function ensureConfigHooksRegistered(): void {
  if (globalThis[CONFIG_HOOKS_REGISTERED_KEY]) return
  globalThis[CONFIG_HOOKS_REGISTERED_KEY] = true

  const hooks = getGlobalHooks()
  for (const config of getRegisteredEntities()) {
    const slug = (config as EntityConfig).slug
    const declared = (config as EntityConfig).hooks
    if (!slug || !declared) continue

    for (const bridge of DECLARED_HOOK_BRIDGE) {
      const fns = declared[bridge.key]
      if (!Array.isArray(fns)) continue
      const eventName = bridge.event(slug)
      for (const fn of fns) {
        const wrapped = bridge.wrap(fn, bridge.operation)
        if (bridge.register === 'filter') {
          hooks.addFilter(eventName, wrapped as (data: Record<string, unknown>) => Promise<Record<string, unknown>>)
        } else {
          hooks.addAction(eventName, wrapped as (data: Record<string, unknown>) => Promise<void>)
        }
      }
    }
  }
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

    // Apply filters to modify the data before creation. Uses the strict
    // variant (propagates callback errors) instead of applyFilters: a
    // before_create filter is a validation hook, and a validation hook
    // that can't reject a payload isn't actually enforcing anything.
    const filteredData = await this.hooks.applyFiltersStrict(
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

    // Strict variant: before_update is a validation/gating hook, same reasoning
    // as before_create above — a callback that throws must actually reject.
    const filteredData = await this.hooks.applyFiltersStrict(
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

    // Allow plugins to prevent deletion by modifying the data. Strict variant:
    // a before_delete callback that throws (a very natural way to express
    // "cannot delete: still referenced") must actually block the delete
    // instead of being logged and silently ignored.
    const filteredData = await this.hooks.applyFiltersStrict(
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
   * Get entity configuration from the registry.
   *
   * Also the single call site every method below hits first — used to
   * trigger the declarative EntityConfig.hooks bridge exactly once (see
   * ensureConfigHooksRegistered() above) instead of adding that call to all
   * nine methods individually.
   */
  private getEntityConfig(entityName: string): EntityConfig {
    ensureConfigHooksRegistered()

    const config = getEntityBySlug(entityName)
    if (config) return config

    // Registry miss (e.g. hook fired for an entity not in the registry, or
    // fired before setEntityRegistry() ran) — fall back to a minimal shape
    // so callers relying only on entityName/slug still work.
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