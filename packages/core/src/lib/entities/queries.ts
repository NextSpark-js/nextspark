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
  routePrefix?: string
  pluginContext?: {
    pluginName: string
    pluginDir?: string
  } | null
  themeContext?: {
    themeName: string
    themeDir?: string
  } | null
  schema?: any
  relations?: any
  // Additional properties from generated registry
  relativePath?: string
  hasComponents?: boolean
  hasHooks?: boolean
  hasMigrations?: boolean
  hasMessages?: boolean
  hasAssets?: boolean
  messagesPath?: string
  isCore?: boolean
  source?: 'core' | 'theme' | 'plugin'
}

export interface EntityRegistryMetadata {
  totalEntities: number
  rootEntities?: number
  maxDepth: number
  generatedAt: string
  entityNames?: string[]
  entities?: string[]
  // Additional generated metadata
  pluginEntities?: number
  themeEntities?: number
  entitiesWithComponents?: number
  entitiesWithHooks?: number
  entitiesWithMigrations?: number
  entitiesWithMessages?: number
  entitiesWithAssets?: number
}

export interface EntityOwner {
  type: 'plugin' | 'theme'
  name: string
}

// Cache for the registry (loaded once per runtime)
let _cachedRegistry: Record<string, EntityRegistryEntry> | null = null
let _cachedMetadata: EntityRegistryMetadata | null = null

/**
 * Register the entity registry from the project
 * This should be called by the dashboard layout which imports the registry directly
 * (webpack resolves the @nextsparkjs/registries alias at compile time)
 */
export function setEntityRegistry(
  registry: Record<string, EntityRegistryEntry>,
  metadata?: EntityRegistryMetadata
): void {
  _cachedRegistry = registry
  _cachedMetadata = metadata || null

  const entityCount = Object.keys(registry || {}).length
  console.log(`[EntityQueries] Registry set with ${entityCount} entities`)
}

/**
 * Add a single entity to the registry
 * Used by EntityRegistry.register() for programmatic registration
 */
export function addEntityToRegistry(entry: EntityRegistryEntry): void {
  if (!_cachedRegistry) {
    _cachedRegistry = {}
  }
  _cachedRegistry[entry.name] = entry
}

/**
 * Remove an entity from the registry
 */
export function removeEntityFromRegistry(name: string): boolean {
  if (!_cachedRegistry || !_cachedRegistry[name]) {
    return false
  }
  delete _cachedRegistry[name]
  return true
}

/**
 * Clear the registry (for testing)
 */
export function clearEntityRegistry(): void {
  _cachedRegistry = null
  _cachedMetadata = null
}

/**
 * Check if registry is initialized
 */
export function isRegistryInitialized(): boolean {
  return _cachedRegistry !== null && Object.keys(_cachedRegistry).length > 0
}

/**
 * Get the entity registry
 * Returns cached registry or empty object if not yet registered
 */
function getRegistry(): Record<string, EntityRegistryEntry> {
  if (_cachedRegistry) return _cachedRegistry

  // Registry not yet set - this is expected on first load
  // The layout will call setEntityRegistry() with the imported registry
  console.log('[EntityQueries] Registry not yet initialized (will be set by layout)')
  return {}
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
export function getEntityBySlug(slug: string): EntityConfig | undefined {
  const entry = Object.values(getRegistry())
    .find(entry => 'slug' in entry.config && entry.config.slug === slug)
  return entry?.config as EntityConfig | undefined
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
