/**
 * Entity Registry System
 *
 * Central registry for managing entity configurations with comprehensive filtering,
 * permission checking, plan limits validation, and child entity support.
 *
 * MIGRATION: Now uses build-time registries (THEME_REGISTRY, PLUGIN_REGISTRY)
 * for zero runtime I/O and ~17,255x performance improvement
 *
 * SERVER-ONLY: This module is server-side only. Client components receive
 * entity configs as props from server components.
 */

import 'server-only'

import type {
  EntityConfig,
  EntityFeatures,
  EntityLimits,
  EntityAccessResult,
  EntityUsageStats,
  CRUDOperation,
  PlanType,
  UserFlag,
  ChildEntityConfig,
  ChildEntityDefinition,
  EntityConfigValidation,
} from './types'
import type { UserRole } from '../../types/user.types'
import {
  getEntityBySlug,
  getRegisteredEntities,
  addEntityToRegistry,
  removeEntityFromRegistry,
  clearEntityRegistry,
  isRegistryInitialized,
  type EntityRegistryEntry,
} from './queries'

/**
 * EntityRegistry - Central management system for all entities
 *
 * ARCHITECTURE: This class is now a FACADE that delegates to the singleton
 * in queries.ts. There is NO internal Map - all data comes from the shared
 * singleton which is populated by the layout via setEntityRegistry().
 *
 * This unification ensures:
 * - API handlers see the same entities as client components
 * - Works in both monorepo and npm modes
 * - No require() calls that fail in pre-compiled npm packages
 */
export class EntityRegistry {
  /**
   * Register a new entity configuration
   * Adds to the singleton in queries.ts
   */
  register(config: EntityConfig): void {
    const validation = this.validateConfiguration(config)
    if (!validation.valid) {
      throw new Error(`Invalid entity configuration for "${config.slug}": ${validation.errors.join(', ')}`)
    }

    // Add to singleton registry
    const entry: EntityRegistryEntry = {
      name: config.slug,
      config,
      parent: null,
      children: config.childEntities ? Object.keys(config.childEntities) : [],
      depth: 0,
      tableName: config.tableName || config.slug,
      routePrefix: config.slug,
    }
    addEntityToRegistry(entry)

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn(`Entity "${config.slug}" configuration warnings:`, validation.warnings)
    }
  }

  /**
   * Get entity configuration by slug
   * Delegates to singleton in queries.ts
   */
  get(slug: string): EntityConfig | undefined {
    return getEntityBySlug(slug)
  }

  /**
   * Get entity configuration by slug (alias for get)
   */
  getBySlug(slug: string): EntityConfig | undefined {
    return getEntityBySlug(slug)
  }

  /**
   * Get all registered entities
   * Delegates to singleton in queries.ts
   */
  getAll(): EntityConfig[] {
    const entities = getRegisteredEntities()
    // Filter to only return EntityConfig (not ChildEntityDefinition)
    return entities.filter((e): e is EntityConfig => 'slug' in e && 'enabled' in e)
  }

  /**
   * Get only enabled entities
   */
  getEnabled(): EntityConfig[] {
    return this.getAll().filter(entity => entity.enabled)
  }

  /**
   * Get entities that have a specific feature enabled
   */
  getByFeature(feature: keyof EntityConfig['ui']['features']): EntityConfig[] {
    return this.getEnabled().filter(entity => entity.ui.features[feature] === true)
  }






  /**
   * Get effective limits for user (returns unlimited for now since plans are not enforced)
   */
  getEffectiveLimits(entityName: string, planType: PlanType, userFlags: UserFlag[] = []): EntityLimits {
    const entity = this.get(entityName)
    if (!entity) throw new Error(`Entity "${entityName}" not found`)

    // SKIP PLAN LIMITS - return unlimited for now
    // Plan configuration is maintained but not enforced
    
    // Flag-based features - flagAccess is not part of new EntityConfig structure
    // TODO: Implement flag-based access control if needed
    const flagFeatures: string[] = []

    return {
      maxRecords: 'unlimited',
      features: flagFeatures
    }
  }

  /**
   * Get child entities configuration for a parent entity
   */
  getChildEntities(parentEntityName: string): ChildEntityConfig | undefined {
    const entity = this.get(parentEntityName)
    return entity?.childEntities
  }

  /**
   * Get specific child entity configuration
   */
  getChildConfig(parentEntityName: string, childName: string): ChildEntityDefinition | undefined {
    const childEntities = this.getChildEntities(parentEntityName)
    return childEntities?.[childName]
  }

  /**
   * Check if entity has child entities
   */
  hasChildEntities(entityName: string): boolean {
    const entity = this.get(entityName)
    return !!(entity?.childEntities && Object.keys(entity.childEntities).length > 0)
  }

  /**
   * Get child entities for API inclusion based on requested children
   */
  getChildrenForAPI(parentEntityName: string, includedChildren?: string[]): ChildEntityDefinition[] {
    const childEntities = this.getChildEntities(parentEntityName)
    if (!childEntities) return []

    if (!includedChildren || includedChildren.includes('all')) {
      return Object.values(childEntities)
    }

    return includedChildren
      .map(childName => childEntities[childName])
      .filter((child): child is ChildEntityDefinition => !!child)
  }

  /**
   * Validate entity configuration
   */
  private validateConfiguration(config: EntityConfig | ChildEntityDefinition): EntityConfigValidation {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if this is a child entity (doesn't have enabled property - only parent entities have it)
    const isChildEntity = !('enabled' in config)

    if (isChildEntity) {
      // Child entity validation - only validate properties that child entities have
      const childConfig = config as ChildEntityDefinition
      if (!childConfig.permissions) {
        warnings.push('Child entity has no permissions defined')
      }
      if (!Array.isArray(childConfig.fields)) {
        errors.push('Child entity must have fields array')
      }
      return { valid: errors.length === 0, errors, warnings }
    }

    // Parent entity validation - safe to cast now
    const entityConfig = config as EntityConfig

    // Basic validation
    if (!entityConfig.slug?.trim()) errors.push('Entity slug is required')
    if (!entityConfig.names?.singular?.trim()) errors.push('Entity singular name is required')
    if (!entityConfig.names?.plural?.trim()) errors.push('Entity plural name is required')
    if (!entityConfig.icon) errors.push('Icon is required')

    // Features validation - enabled is at top level now
    if (typeof entityConfig.enabled !== 'boolean') {
      errors.push('enabled must be a boolean')
    }

    // NOTE: Permissions are now defined centrally in permissions.config.ts
    // Entity configs no longer contain permission definitions

    // Child entities validation
    if (entityConfig.childEntities) {
      for (const [childName, childConfig] of Object.entries(entityConfig.childEntities)) {
        if (!childConfig.table?.trim()) {
          errors.push(`Child entity "${childName}" must have a table name`)
        }
        if (!Array.isArray(childConfig.fields)) {
          errors.push(`Child entity "${childName}" must have fields array`)
        }
      }
    }

    // TODO: Re-implement these validations for new EntityConfig structure if needed
    // - Plan limits validation
    // - Database configuration validation
    // - API configuration validation
    // - Routes validation

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Get detailed access result for user and entity (excluding plan validation)
   */
  getAccessResult(
    entityName: string,
    action: CRUDOperation,
    userRole: UserRole,
    planType: PlanType,
    userFlags: UserFlag[] = []
  ): EntityAccessResult {
    const entity = this.get(entityName)
    
    if (!entity) {
      return { allowed: false, reason: 'Entity not found' }
    }

    if (!entity.enabled) {
      return { allowed: false, reason: 'Entity is disabled' }
    }

    // Check role permissions via actions array (if defined in entity config)
    // NOTE: When permissions are centralized in permissions.config.ts, this check is skipped
    // and the PermissionService should be used instead
    const actionConfig = entity.permissions?.actions?.find(a => a.action === action)
    if (entity.permissions && (!actionConfig || !actionConfig.roles.includes(userRole))) {
      return { allowed: false, reason: 'Insufficient role permissions' }
    }

    // TODO: Implement flag-based access control if needed
//     // Check flag access
//     if (entity.flagAccess) {
//       const { excludedFlags = [], availableInFlags = [] } = entity.flagAccess
//       
//       // Check if user has any excluded flags
//       if (excludedFlags.some(flag => userFlags.includes(flag))) {
//         return { allowed: false, reason: 'User has excluded flag' }
//       }
//       
//       // If there are required flags, user must have at least one
//       if (availableInFlags.length > 0) {
//         if (!availableInFlags.some(flag => userFlags.includes(flag))) {
//           return { allowed: false, reason: 'User does not have required flags' }
//         }
//       }
//     }

    // SKIP PLAN VALIDATION - plans are not enforced in this version

    // Get effective limits and features
    const limits = this.getEffectiveLimits(entityName, planType, userFlags)
    const features = limits.features || []

    return {
      allowed: true,
      limits,
      features
    }
  }

  /**
   * Check if user is at or near entity limits
   */
  checkLimits(
    entityName: string,
    planType: PlanType,
    currentUsage: EntityUsageStats,
    userFlags: UserFlag[] = []
  ): { withinLimits: boolean; warnings: string[]; errors: string[] } {
    const limits = this.getEffectiveLimits(entityName, planType, userFlags)
    const warnings: string[] = []
    const errors: string[] = []

    // Check record limits
    if (limits.maxRecords !== 'unlimited') {
      const recordLimit = limits.maxRecords as number
      const usage = currentUsage.currentRecords / recordLimit

      if (currentUsage.currentRecords >= recordLimit) {
        errors.push(`Record limit exceeded: ${currentUsage.currentRecords}/${recordLimit}`)
      } else if (usage >= 0.8) {
        warnings.push(`Approaching record limit: ${currentUsage.currentRecords}/${recordLimit}`)
      }
    }

    // Check storage limits
    if (limits.maxStorage && limits.maxStorage !== 'unlimited' && currentUsage.storageUsed) {
      const storageLimit = limits.maxStorage as number
      const usage = currentUsage.storageUsed / storageLimit

      if (currentUsage.storageUsed >= storageLimit) {
        errors.push(`Storage limit exceeded: ${currentUsage.storageUsed}MB/${storageLimit}MB`)
      } else if (usage >= 0.8) {
        warnings.push(`Approaching storage limit: ${currentUsage.storageUsed}MB/${storageLimit}MB`)
      }
    }

    // Check API call limits
    if (limits.maxApiCalls && limits.maxApiCalls !== 'unlimited' && currentUsage.apiCalls) {
      const apiLimit = limits.maxApiCalls as number
      const usage = currentUsage.apiCalls / apiLimit

      if (currentUsage.apiCalls >= apiLimit) {
        errors.push(`API call limit exceeded: ${currentUsage.apiCalls}/${apiLimit}`)
      } else if (usage >= 0.8) {
        warnings.push(`Approaching API limit: ${currentUsage.apiCalls}/${apiLimit}`)
      }
    }

    return {
      withinLimits: errors.length === 0,
      warnings,
      errors
    }
  }

  /**
   * Initialize registry
   *
   * ARCHITECTURE: This is now a NO-OP for backwards compatibility.
   * The singleton in queries.ts is populated by:
   * - Server: The layout imports registry and calls setEntityRegistry()
   * - Client: DashboardShell calls setServerEntities() during hydration
   *
   * The EntityRegistry class is a facade - it doesn't need initialization.
   */
  async initialize(): Promise<void> {
    // No-op - the singleton is already populated by the layout
    // This method exists for backwards compatibility
    const count = this.getAll().length
    if (count > 0) {
      console.log(`[EntityRegistry] Already initialized with ${count} entities from singleton`)
    } else {
      console.log('[EntityRegistry] Singleton empty - will be populated by layout import')
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalEntities: number
    enabledEntities: number
    entitiesWithChildren: number
    entitiesWithExternalAPI: number
  } {
    const all = this.getAll()
    const enabled = this.getEnabled()
    
    return {
      totalEntities: all.length,
      enabledEntities: enabled.length,
      entitiesWithChildren: enabled.filter(e => this.hasChildEntities(e.slug)).length,
      entitiesWithExternalAPI: enabled.filter(e => e.access.api).length
    }
  }

  /**
   * Update an existing entity configuration
   * Delegates to singleton in queries.ts
   */
  updateEntity(slug: string, updates: Partial<EntityConfig>): void {
    const existing = this.get(slug)
    if (!existing) {
      throw new Error(`Entity "${slug}" not found`)
    }

    const updated = { ...existing, ...updates }
    const validation = this.validateConfiguration(updated)

    if (!validation.valid) {
      throw new Error(`Invalid entity update for "${slug}": ${validation.errors.join(', ')}`)
    }

    // Re-register to update in singleton
    this.register(updated)

    if (validation.warnings.length > 0) {
      console.warn(`Entity "${slug}" update warnings:`, validation.warnings)
    }
  }

  /**
   * Remove an entity from the registry
   * Delegates to singleton in queries.ts
   */
  removeEntity(slug: string): void {
    if (!removeEntityFromRegistry(slug)) {
      throw new Error(`Entity "${slug}" not found`)
    }
  }

  /**
   * Export all entity configurations
   */
  exportConfigs(): EntityConfig[] {
    return this.getAll()
  }

  /**
   * Import entity configurations
   */
  importConfigs(configs: EntityConfig[]): void {
    configs.forEach(config => this.register(config))
  }

  /**
   * Check if registry is initialized
   * Delegates to singleton in queries.ts
   */
  isInitialized(): boolean {
    return isRegistryInitialized()
  }

  /**
   * Reset the registry (alias for clear)
   */
  reset(): void {
    this.clear()
  }

  /**
   * Clear all registered entities (mainly for testing)
   * Delegates to singleton in queries.ts
   */
  clear(): void {
    clearEntityRegistry()
  }
}

// Global registry instance
export const entityRegistry = new EntityRegistry()

// Server-side initialization happens on-demand via ensureInitialized()
// NO auto-initialization to prevent client/server import issues

// Convenience functions
export function registerEntity(config: EntityConfig): void {
  entityRegistry.register(config)
}

export function getEntityConfig(name: string): EntityConfig | undefined {
  return entityRegistry.get(name)
}

export function getEnabledEntities(): EntityConfig[] {
  return entityRegistry.getEnabled()
}


export function getEntityLimits(
  entityName: string,
  planType: PlanType,
  userFlags: UserFlag[] = []
): EntityLimits {
  return entityRegistry.getEffectiveLimits(entityName, planType, userFlags)
}

/**
 * Ensure the entity registry is fully initialized
 * MIGRATION: Now uses build-time registries (zero runtime I/O)
 */
export async function ensureInitialized(): Promise<void> {
  await entityRegistry.initialize()
}

/**
 * Get all entity configurations (includes theme and plugin entities)
 */
export function getAllEntityConfigs(): EntityConfig[] {
  return entityRegistry.getAll()
}

/**
 * Get registry statistics
 * MIGRATION: Now shows entities from theme and plugin registries
 */
export function getRegistryStats() {
  return {
    totalEntities: entityRegistry.getAll().length,
    enabledEntities: entityRegistry.getEnabled().length,
    initialized: entityRegistry.isInitialized(),
    source: 'singleton (queries.ts)'
  }
}