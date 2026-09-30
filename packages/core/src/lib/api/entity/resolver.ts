/**
 * Entity Resolver
 * 
 * Resolves entity configurations from URLs.
 */

import { entityRegistry, ensureInitialized } from '../../entities/registry'
import type { EntityConfig } from '../../entities/types'

export interface EntityResolution {
  entityName: string
  entityConfig: EntityConfig | null
  isValidEntity: boolean
}

/**
 * Resolve entity from API URL path
 */
export async function resolveEntityFromUrl(pathname: string): Promise<EntityResolution> {
  // Extract entity name from URL path
  // Examples:
  // /api/v1/products -> products
  // /api/v1/tasks/123 -> tasks
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length < 3 || segments[0] !== 'api' || segments[1] !== 'v1') {
    return {
      entityName: '',
      entityConfig: null,
      isValidEntity: false
    }
  }

  const entitySlug = segments[2] // This is the slug from URL (e.g., "products", "tasks")

  // Check if this is a core endpoint that should not be handled generically
  if (isCorePath(entitySlug)) {
    return {
      entityName: entitySlug,
      entityConfig: null,
      isValidEntity: false
    }
  }

  // Get entity config from registry by slug
  await ensureInitialized()
  const entityConfig = entityRegistry.getBySlug(entitySlug)

  if (!entityConfig) {
    return {
      entityName: entitySlug,
      entityConfig: null,
      isValidEntity: false
    }
  }

  return {
    entityName: entityConfig.slug, // Use slug as entityName for new structure
    entityConfig,
    isValidEntity: true
  }
}

/**
 * Check if path is a core endpoint (users, auth, system, etc.)
 */
function isCorePath(entityName: string): boolean {
  const corePaths = [
    'users',
    'api-keys',
    'auth', 
    'system',
    'health',
    'internal',
    'admin',
    'debug'
  ]
  
  return corePaths.includes(entityName)
}

/**
 * Get all registered entities that can be handled generically
 */
export async function getGenericEntities(): Promise<string[]> {
  await ensureInitialized()
  const allEntities = entityRegistry.getAll()

  return allEntities
    .filter(entity => entity.enabled) // Use new EntityConfig structure
    .map(entity => entity.slug) // Use slug instead of name
    .filter(slug => !isCorePath(slug))
}

/**
 * Validate entity supports the requested operation
 */
export function validateEntityOperation(
  entityConfig: EntityConfig,
  operation: 'list' | 'create' | 'read' | 'update' | 'delete'
): boolean {
  // New EntityConfig structure has enabled at root level, not features.enabled
  if (!entityConfig.enabled) {
    return false
  }

  switch (operation) {
    case 'list':
    case 'read':
    case 'create':
    case 'update':
    case 'delete':
      // Entity enabled check only - PermissionService handles role-based permissions
      // Permissions are defined centrally in permissions.config.ts
      return entityConfig.enabled
    default:
      return false
  }
}
