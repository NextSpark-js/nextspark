/**
 * Client-Only Entity Registry
 *
 * Provides minimal entity functionality for client components
 * without any server-side imports or contents integration
 */

'use client'

import type { EntityConfig, EntityIcon } from './types'

/**
 * Icon registry - maps entity slug to icon component
 * Pre-populated by auto-generated entity-registry.client.ts before hydration
 * This allows non-lucide icons (e.g. Phosphor) to survive server→client serialization
 */
const entityIconRegistry = new Map<string, EntityIcon>()

/**
 * Register an entity icon for client-side use
 * Called by auto-generated entity-registry.client.ts
 */
export function registerEntityIcon(slug: string, icon: EntityIcon): void {
  if (icon) {
    entityIconRegistry.set(slug, icon)
  }
}

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
 * Merges pre-registered icons from entityIconRegistry to preserve non-lucide icons
 */
export function setServerEntities(entities: EntityConfig[]): void {
  for (const entity of entities) {
    // If we have a pre-registered icon for this entity (from entity-registry.client.ts),
    // use it instead of the deserialized one (which falls back to lucide Box for non-lucide icons)
    const registeredIcon = entityIconRegistry.get(entity.slug)
    if (registeredIcon) {
      entity.icon = registeredIcon
    }
    clientEntityRegistry.register(entity)
  }
  console.log(`[EntityRegistry] Client-side: registered ${entities.length} entities from server (${entityIconRegistry.size} icons from registry)`)
}

/**
 * Client-safe function to get all entity configurations
 * Returns entities from the client registry (populated by DashboardShell)
 */
export function getAllEntityConfigs(): EntityConfig[] {
  const clientEntities = clientEntityRegistry.getAll()

  if (clientEntities.length === 0) {
    // Registry not yet hydrated - this is normal during initial render
    // DashboardShell will call setServerEntities() to populate it
    console.log('[EntityRegistry] Client registry empty - waiting for hydration from DashboardShell')
  }

  return clientEntities
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