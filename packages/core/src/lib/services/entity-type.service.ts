/**
 * EntityTypeService - Provides runtime entity type queries
 *
 * This service layer abstracts entity-types registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) with zero I/O.
 *
 * @example
 * ```typescript
 * import { EntityTypeService } from './'
 *
 * // Check if a type is an entity (vs system type)
 * const isEntity = EntityTypeService.isEntityType('customers') // true
 * const isSystem = EntityTypeService.isEntityType('page') // false
 *
 * // Get all entity names
 * const names = EntityTypeService.getAllNames() // ['customers', 'pages', ...]
 *
 * // Get search priority for a type
 * const priority = EntityTypeService.getPriority('customers') // 14
 * ```
 */

import {
  SEARCH_TYPE_PRIORITIES,
  ENTITY_METADATA,
  type EntityName,
  type SearchResultType,
  type SystemSearchType,
} from '@nextsparkjs/registries/entity-types'

// Re-export types for convenience
export type { EntityName, SearchResultType, SystemSearchType }

/**
 * System search types (non-entity types)
 * Used for type guard validation
 */
const SYSTEM_TYPES: readonly SystemSearchType[] = ['task', 'page', 'setting', 'entity'] as const

/**
 * EntityTypeService
 *
 * Static service class for entity type queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export class EntityTypeService {
  /**
   * Check if a type is an entity type (vs system type)
   *
   * @param type - The search result type to check
   * @returns True if the type is an entity, false if it's a system type
   *
   * @example
   * ```typescript
   * EntityTypeService.isEntityType('customers') // true
   * EntityTypeService.isEntityType('page') // false
   * EntityTypeService.isEntityType('setting') // false
   * ```
   */
  static isEntityType(type: SearchResultType): type is EntityName {
    return !SYSTEM_TYPES.includes(type as SystemSearchType)
  }

  /**
   * Get all available entity names
   *
   * @returns Array of all entity names from the registry
   *
   * @example
   * ```typescript
   * const names = EntityTypeService.getAllNames()
   * // ['customers', 'pages', 'posts', 'tasks']
   * ```
   */
  static getAllNames(): EntityName[] {
    // Return a copy to prevent mutation of the original metadata
    return [...ENTITY_METADATA.entityNames] as EntityName[]
  }

  /**
   * Get search priority for a result type
   *
   * Higher numbers indicate higher priority in search results.
   * Returns 0 for unknown types.
   *
   * @param type - The search result type
   * @returns Priority number (higher = more relevant)
   *
   * @example
   * ```typescript
   * EntityTypeService.getPriority('customers') // 14
   * EntityTypeService.getPriority('page') // 5
   * EntityTypeService.getPriority('unknown') // 0
   * ```
   */
  static getPriority(type: SearchResultType): number {
    return SEARCH_TYPE_PRIORITIES[type] ?? 0
  }

  /**
   * Get all system types (non-entity types)
   *
   * @returns Array of system search types
   *
   * @example
   * ```typescript
   * const systemTypes = EntityTypeService.getSystemTypes()
   * // ['task', 'page', 'setting', 'entity']
   * ```
   */
  static getSystemTypes(): readonly SystemSearchType[] {
    return SYSTEM_TYPES
  }

  /**
   * Get metadata about the entity types registry
   *
   * @returns Registry metadata object
   *
   * @example
   * ```typescript
   * const meta = EntityTypeService.getMetadata()
   * // { totalEntities: 4, entityNames: [...], generatedAt: '...', source: '...' }
   * ```
   */
  static getMetadata(): typeof ENTITY_METADATA {
    return ENTITY_METADATA
  }

  /**
   * Get the total count of registered entities
   *
   * @returns Number of entities
   *
   * @example
   * ```typescript
   * const count = EntityTypeService.getCount() // 4
   * ```
   */
  static getCount(): number {
    return ENTITY_METADATA.totalEntities
  }
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================
// These function exports maintain backward compatibility with existing code
// that imports functions directly from the registry.

/**
 * @deprecated Use EntityTypeService.isEntityType() instead
 */
export const isEntityType = EntityTypeService.isEntityType

/**
 * @deprecated Use EntityTypeService.getAllNames() instead
 */
export const getAllEntityNames = EntityTypeService.getAllNames

/**
 * @deprecated Use EntityTypeService.getPriority() instead
 */
export const getSearchTypePriority = EntityTypeService.getPriority
