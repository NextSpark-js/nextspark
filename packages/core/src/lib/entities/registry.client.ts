/**
 * Client-Only Entity Registry
 *
 * Provides minimal entity functionality for client components
 * without any server-side imports or contents integration
 */

'use client'

import type { EntityConfig } from './types'

/**
 * Client-only entity registry with minimal functionality
 */
class ClientEntityRegistry {
  private entities: Map<string, EntityConfig> = new Map()

  /**
   * Register a new entity configuration
   */
  register(config: EntityConfig): void {
    this.entities.set(config.slug, config)
  }

  /**
   * Get entity configuration by name
   */
  get(name: string): EntityConfig | undefined {
    return this.entities.get(name)
  }

  /**
   * Get all registered entities
   */
  getAll(): EntityConfig[] {
    return Array.from(this.entities.values())
  }

  /**
   * Get only enabled entities
   */
  getEnabled(): EntityConfig[] {
    return this.getAll().filter(entity => entity.enabled)
  }

  /**
   * Clear all registered entities
   */
  clear(): void {
    this.entities.clear()
  }
}

// Global client registry instance
export const clientEntityRegistry = new ClientEntityRegistry()

/**
 * Set entities from server-side data
 * Called by EntityProvider when receiving server data
 */
export function setServerEntities(entities: EntityConfig[]): void {
  for (const entity of entities) {
    clientEntityRegistry.register(entity)
  }
  console.log(`[EntityRegistry] Client-side: registered ${entities.length} entities from server`)
}

/**
 * Client-safe function to get all entity configurations
 * Uses build-time registry with serializable data only
 */
export function getAllEntityConfigs(): EntityConfig[] {
  // If client registry is populated, use it (for backwards compatibility)
  const clientEntities = clientEntityRegistry.getAll()
  if (clientEntities.length > 0) {
    return clientEntities
  }

  // Otherwise, use build-time registry (stripping non-serializable data)
  try {
    const { ENTITY_REGISTRY } = require('@nextsparkjs/registries/entity-registry')
    // Import fallback icon dynamically
    const { Package } = require('lucide-react')

    return Object.values(ENTITY_REGISTRY).map((entry: any) => {
      const config = entry.config

      // Create serializable config (exclude functions like translation loaders)
      return {
        ...config,
        icon: config.icon || Package, // Use fallback icon if original is missing
        i18n: config.i18n ? {
          ...config.i18n,
          loaders: {} // Remove loader functions (functions can't be serialized to client)
        } : undefined
      }
    }).filter((config: any) => config.slug) // Only full EntityConfig (not ChildEntityDefinition)
  } catch (error) {
    console.error('[EntityRegistry] Failed to load from build-time registry:', error)
    return []
  }
}

/**
 * Client-safe function to get enabled entities
 * Data must be provided via EntityProvider/Context from server component
 */
export function getEnabledEntities(): EntityConfig[] {
  return clientEntityRegistry.getEnabled()
}

/**
 * Client-safe function to register entity
 */
export function registerEntity(config: EntityConfig): void {
  clientEntityRegistry.register(config)
}

/**
 * Client-safe function to get entity config
 */
export function getEntityConfig(name: string): EntityConfig | undefined {
  return clientEntityRegistry.get(name)
}