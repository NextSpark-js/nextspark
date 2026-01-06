/**
 * Entity Queries
 *
 * Query functions for the Entity Registry.
 * These operate on the auto-generated ENTITY_REGISTRY data.
 *
 * Uses dynamic require to load the registry at runtime (not compile time)
 * because the registry is generated in the user's project, not in the core package.
 *
 * @module core/lib/entities/queries
 */

import type { EntityConfig, ChildEntityDefinition } from './types'

/**
 * Generic EntityRegistryEntry type (matches generated registry structure)
 * The actual EntityName type is project-specific and should be imported
 * directly from @nextsparkjs/registries/entity-registry when needed.
 */
export interface EntityRegistryEntry {
  name: string
  config: EntityConfig | ChildEntityDefinition
  parent: string | null
  children: string[]
  depth: number
  tableName: string
  routePrefix: string
  pluginContext?: {
    pluginName: string
    pluginDir: string
  }
  themeContext?: {
    themeName: string
    themeDir: string
  }
  schema?: any
  relations?: any
}

export interface EntityRegistryMetadata {
  totalEntities: number
  rootEntities: number
  maxDepth: number
  generatedAt: string
  entityNames: string[]
}

export interface EntityOwner {
  type: 'plugin' | 'theme'
  name: string
}

// Cache for the registry (loaded once per runtime)
let _cachedRegistry: Record<string, EntityRegistryEntry> | null = null
let _cachedMetadata: EntityRegistryMetadata | null = null

/**
 * Load the entity registry dynamically
 * This allows the core package to work with the project-generated registry
 */
function getRegistry(): Record<string, EntityRegistryEntry> {
  if (_cachedRegistry) return _cachedRegistry

  try {
    const registry = require('@nextsparkjs/registries/entity-registry')
    _cachedRegistry = registry.ENTITY_REGISTRY
    _cachedMetadata = registry.ENTITY_METADATA
    return _cachedRegistry!
  } catch (error) {
    console.warn('[EntityQueries] Registry not available yet (run registry:build first)')
    return {}
  }
}

/**
 * Get all registered entity configs
 */
export function getRegisteredEntities(): (EntityConfig | ChildEntityDefinition)[] {
  return Object.values(getRegistry()).map(entry => entry.config)
}

/**
 * Get entity config by name
 */
export function getEntity(name: string): EntityConfig | ChildEntityDefinition | undefined {
  return getRegistry()[name]?.config
}

/**
 * Get entity with full metadata
 */
export function getEntityMetadata(name: string): EntityRegistryEntry | undefined {
  return getRegistry()[name]
}

/**
 * Get root entities (no parent)
 */
export function getRootEntities(): EntityRegistryEntry[] {
  return Object.values(getRegistry()).filter(entry => entry.parent === null)
}

/**
 * Get child entities of a parent
 */
export function getChildEntities(parentName: string): EntityRegistryEntry[] {
  return Object.values(getRegistry()).filter(entry => entry.parent === parentName)
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
    childNodes: buildEntityHierarchy(root.name)
  }))
}

function buildEntityHierarchy(entityName: string): EntityTreeNode[] {
  const children = getChildEntities(entityName)
  return children.map(child => ({
    ...child,
    childNodes: buildEntityHierarchy(child.name)
  }))
}

/**
 * Get entities by depth level
 */
export function getEntitiesByDepth(depth: number): EntityRegistryEntry[] {
  return Object.values(getRegistry()).filter(entry => entry.depth === depth)
}

/**
 * Get table name for entity
 */
export function getEntityTableName(name: string): string | undefined {
  return getRegistry()[name]?.tableName
}

/**
 * Get entity by table name (reverse lookup)
 */
export function getEntityByTableName(tableName: string): EntityRegistryEntry | undefined {
  return Object.values(getRegistry()).find(entry => entry.tableName === tableName)
}

/**
 * Get entities from a specific plugin
 */
export function getPluginEntities(pluginName: string): EntityRegistryEntry[] {
  return Object.values(getRegistry()).filter(
    entry => entry.pluginContext?.pluginName === pluginName
  )
}

/**
 * Get entities from a specific theme
 */
export function getThemeEntities(themeName: string): EntityRegistryEntry[] {
  return Object.values(getRegistry()).filter(
    entry => entry.themeContext?.themeName === themeName
  )
}

/**
 * Get entity owner (plugin or theme)
 */
export function getEntityOwner(entityName: string): EntityOwner | null {
  const entity = getRegistry()[entityName]
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
  return Object.values(getRegistry())
    .find(entry => entry.config.slug === slug)?.config
}

/**
 * Get entity metadata (totals, counts, etc.)
 */
export function getEntityRegistryMetadata(): EntityRegistryMetadata | null {
  // Ensure registry is loaded (which also loads metadata)
  getRegistry()
  return _cachedMetadata
}

/**
 * Get the raw registry object
 * Use this when you need direct access to the registry
 */
export function getEntityRegistry(): Record<string, EntityRegistryEntry> {
  return getRegistry()
}
