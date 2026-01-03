/**
 * Meta System Adapter
 *
 * Provides meta configuration for entities using the modern Entity Registry.
 * Simplified from the legacy dual-registry system to use only entity-registry.
 */

import { getEntityConfig, getAllEntityConfigs } from './registry'
import type { EntityConfig } from './types'

/**
 * Meta configuration interface
 * Derived from EntityConfig for backward compatibility
 */
export interface MetaEntityConfig {
  entityType: string
  tableName: string
  metaTableName: string
  idColumn: string
  apiPath: string
}

/**
 * Meta System Adapter
 * Provides meta configuration derived from the modern entity registry
 */
export class MetaSystemAdapter {
  /**
   * Get meta configuration for an entity
   * Derives meta table info from the entity's slug
   */
  getMetaConfig(entityName: string): {
    tableName: string
    metaTableName: string
    idColumn: string
    apiPath: string
  } | null {
    const config = getEntityConfig(entityName)

    if (config && config.access?.metadata) {
      return {
        tableName: config.slug,
        metaTableName: `${config.slug}_metas`,
        idColumn: 'entityId',
        apiPath: `/api/v1/${config.slug}`
      }
    }

    // Fallback for 'user' entity (core entity that always exists)
    if (entityName === 'user' || entityName === 'users') {
      return {
        tableName: 'users',
        metaTableName: 'users_metas',
        idColumn: 'userId',
        apiPath: '/api/v1/users'
      }
    }

    return null
  }

  /**
   * Check if entity supports metadata
   */
  supportsMetadata(entityName: string): boolean {
    const config = getEntityConfig(entityName)
    if (config) {
      return config.access?.metadata || false
    }
    // Core user entity always supports metadata
    return entityName === 'user' || entityName === 'users'
  }

  /**
   * Get entity API path
   */
  getApiPath(entityName: string): string | null {
    const config = this.getMetaConfig(entityName)
    return config?.apiPath || null
  }

  /**
   * Get all supported entity types that have metadata
   */
  getSupportedEntityTypes(): string[] {
    return getAllEntityConfigs()
      .filter((config: EntityConfig) => config.access?.metadata)
      .map((config: EntityConfig) => config.slug)
  }

  /**
   * Convert entity config to meta config format
   */
  toMetaConfig(entityConfig: EntityConfig): MetaEntityConfig | null {
    if (!entityConfig.access?.metadata) {
      return null
    }

    return {
      entityType: entityConfig.slug,
      tableName: entityConfig.slug,
      metaTableName: `${entityConfig.slug}_metas`,
      idColumn: 'entityId',
      apiPath: `/api/v1/${entityConfig.slug}`
    }
  }

  /**
   * Validate entity configuration compatibility
   */
  validateCompatibility(entityName: string): {
    compatible: boolean
    issues: string[]
    recommendations: string[]
  } {
    const config = getEntityConfig(entityName)

    if (!config) {
      return {
        compatible: false,
        issues: [`Entity "${entityName}" not found in registry`],
        recommendations: ['Add entity configuration to the appropriate location']
      }
    }

    return {
      compatible: true,
      issues: [],
      recommendations: []
    }
  }

  /**
   * Generate migration report for all entities
   */
  generateMigrationReport(): {
    fullyMigrated: string[]
    needsMigration: string[]
    newEntitiesOnly: string[]
    compatibilityIssues: Array<{ entityName: string; issues: string[] }>
  } {
    const entities = getAllEntityConfigs()

    return {
      fullyMigrated: entities.map((e: EntityConfig) => e.slug),
      needsMigration: [],
      newEntitiesOnly: [],
      compatibilityIssues: []
    }
  }
}

// Global adapter instance
export const metaSystemAdapter = new MetaSystemAdapter()

// Convenience functions for backward compatibility
export function getMetaConfigForEntity(entityName: string): ReturnType<MetaSystemAdapter['getMetaConfig']> {
  return metaSystemAdapter.getMetaConfig(entityName)
}

export function checkEntitySupportsMetadata(entityName: string): boolean {
  return metaSystemAdapter.supportsMetadata(entityName)
}

export function getEntityApiPath(entityName: string): string | null {
  return metaSystemAdapter.getApiPath(entityName)
}

export function validateEntityCompatibility(entityName: string): ReturnType<MetaSystemAdapter['validateCompatibility']> {
  return metaSystemAdapter.validateCompatibility(entityName)
}
