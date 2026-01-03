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
import { ENTITY_METADATA, type EntityName, type SearchResultType, type SystemSearchType } from '@nextsparkjs/registries/entity-types';
export type { EntityName, SearchResultType, SystemSearchType };
/**
 * EntityTypeService
 *
 * Static service class for entity type queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export declare class EntityTypeService {
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
    static isEntityType(type: SearchResultType): type is EntityName;
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
    static getAllNames(): EntityName[];
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
    static getPriority(type: SearchResultType): number;
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
    static getSystemTypes(): readonly SystemSearchType[];
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
    static getMetadata(): typeof ENTITY_METADATA;
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
    static getCount(): number;
}
/**
 * @deprecated Use EntityTypeService.isEntityType() instead
 */
export declare const isEntityType: typeof EntityTypeService.isEntityType;
/**
 * @deprecated Use EntityTypeService.getAllNames() instead
 */
export declare const getAllEntityNames: typeof EntityTypeService.getAllNames;
/**
 * @deprecated Use EntityTypeService.getPriority() instead
 */
export declare const getSearchTypePriority: typeof EntityTypeService.getPriority;
//# sourceMappingURL=entity-type.service.d.ts.map