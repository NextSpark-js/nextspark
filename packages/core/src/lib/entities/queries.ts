/**
 * Entity Queries
 *
 * Query functions for the Entity Registry.
 * These operate on the auto-generated ENTITY_REGISTRY data.
 *
 * @module core/lib/entities/queries
 */

import {
  ENTITY_REGISTRY,
  ENTITY_METADATA,
  type EntityName,
  type EntityRegistryEntry
} from '@nextsparkjs/registries/entity-registry'
import type { EntityConfig, ChildEntityDefinition } from './types'

export interface EntityOwner {
  type: 'plugin' | 'theme'
  name: string
}

/**
 * Get all registered entity configs
 */
export function getRegisteredEntities(): (EntityConfig | ChildEntityDefinition)[] {
  return Object.values(ENTITY_REGISTRY).map(entry => entry.config)
}

/**
 * Get entity config by name
 */
export function getEntity(name: EntityName): EntityConfig | ChildEntityDefinition | undefined {
  return ENTITY_REGISTRY[name]?.config
}

/**
 * Get entity with full metadata
 */
export function getEntityMetadata(name: EntityName): EntityRegistryEntry | undefined {
  return ENTITY_REGISTRY[name]
}

/**
 * Get root entities (no parent)
 */
export function getRootEntities(): EntityRegistryEntry[] {
  return Object.values(ENTITY_REGISTRY).filter(entry => entry.parent === null)
}

/**
 * Get child entities of a parent
 */
export function getChildEntities(parentName: EntityName): EntityRegistryEntry[] {
  return Object.values(ENTITY_REGISTRY).filter(entry => entry.parent === parentName)
}

export interface EntityTreeNode extends Omit<EntityRegistryEntry, 'children'> {
  childNodes: EntityTreeNode[]
}

/**
 * Get entity tree (hierarchical)
 */
export function getEntityTree(): EntityTreeNode[] {
  const roots = getRootEntities()
  return roots.map(root => ({
    ...root,
    childNodes: buildEntityHierarchy(root.name as EntityName)
  }))
}

function buildEntityHierarchy(entityName: EntityName): EntityTreeNode[] {
  const children = getChildEntities(entityName)
  return children.map(child => ({
    ...child,
    childNodes: buildEntityHierarchy(child.name as EntityName)
  }))
}

/**
 * Get entities by depth level
 */
export function getEntitiesByDepth(depth: number): EntityRegistryEntry[] {
  return Object.values(ENTITY_REGISTRY).filter(entry => entry.depth === depth)
}

/**
 * Get table name for entity
 */
export function getEntityTableName(name: EntityName): string | undefined {
  return ENTITY_REGISTRY[name]?.tableName
}

/**
 * Get entity by table name (reverse lookup)
 */
export function getEntityByTableName(tableName: string): EntityRegistryEntry | undefined {
  return Object.values(ENTITY_REGISTRY).find(entry => entry.tableName === tableName)
}

/**
 * Get entities from a specific plugin
 */
export function getPluginEntities(pluginName: string): EntityRegistryEntry[] {
  return (Object.values(ENTITY_REGISTRY) as EntityRegistryEntry[]).filter(
    entry => entry.pluginContext?.pluginName === pluginName
  )
}

/**
 * Get entities from a specific theme
 */
export function getThemeEntities(themeName: string): EntityRegistryEntry[] {
  return Object.values(ENTITY_REGISTRY).filter(
    entry => entry.themeContext?.themeName === themeName
  )
}

/**
 * Get entity owner (plugin or theme)
 */
export function getEntityOwner(entityName: EntityName): EntityOwner | null {
  const entity = ENTITY_REGISTRY[entityName] as EntityRegistryEntry | undefined
  if (!entity) return null

  if (entity.pluginContext) {
    return { type: 'plugin', name: entity.pluginContext.pluginName }
  }
  if (entity.themeContext) {
    return { type: 'theme', name: entity.themeContext.themeName }
  }
  return null
}

/**
 * Get entity by slug
 */
export function getEntityBySlug(slug: string): EntityConfig | ChildEntityDefinition | undefined {
  return Object.values(ENTITY_REGISTRY)
    .find(entry => entry.config.slug === slug)?.config
}

/**
 * Get entity metadata (totals, counts, etc.)
 */
export function getEntityRegistryMetadata() {
  return ENTITY_METADATA
}

// Re-export for convenience
export { ENTITY_REGISTRY, ENTITY_METADATA, type EntityName, type EntityRegistryEntry }
