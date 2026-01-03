/**
 * Entity Resolver
 * 
 * Resolves entity configurations from URLs and determines if custom
 * overrides exist in (contents) folders.
 */

import { entityRegistry, ensureInitialized } from '../../entities/registry'
import type { EntityConfig } from '../../entities/types'
import { existsSync } from 'fs'
import { join } from 'path'

export interface EntityResolution {
  entityName: string
  entityConfig: EntityConfig | null
  hasCustomOverride: boolean
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
      hasCustomOverride: false,
      isValidEntity: false
    }
  }

  const entitySlug = segments[2] // This is the slug from URL (e.g., "products", "tasks")

  // Check if this is a core endpoint that should not be handled generically
  if (isCorePath(entitySlug)) {
    return {
      entityName: entitySlug,
      entityConfig: null,
      hasCustomOverride: true, // Treat core as override
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
      hasCustomOverride: false,
      isValidEntity: false
    }
  }

  // Check if custom override exists (using slug for path)
  const hasCustomOverride = await checkCustomOverride(entitySlug)

  return {
    entityName: entityConfig.slug, // Use slug as entityName for new structure
    entityConfig,
    hasCustomOverride,
    isValidEntity: true
  }
}

/**
 * Check if entity has custom override in (contents) folder
 */
async function checkCustomOverride(entityName: string): Promise<boolean> {
  try {
    // Check if custom route file exists
    const customRoutePath = join(
      process.cwd(), 
      'app', 
      'api', 
      'v1', 
      '(contents)', 
      entityName, 
      'route.ts'
    )
    
    return existsSync(customRoutePath)
  } catch (error) {
    console.warn(`Error checking custom override for ${entityName}:`, error)
    return false
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
      return entityConfig.enabled
    case 'create':
      // Check if create is allowed via permissions
      // When permissions are centralized, assume allowed (PermissionService handles this)
      return entityConfig.enabled && (entityConfig.permissions?.actions?.some(a => a.action === 'create') ?? true)
    case 'update':
      // Check if update is allowed via permissions
      // When permissions are centralized, assume allowed (PermissionService handles this)
      return entityConfig.enabled && (entityConfig.permissions?.actions?.some(a => a.action === 'update') ?? true)
    case 'delete':
      // Check if delete is allowed via permissions
      // When permissions are centralized, assume allowed (PermissionService handles this)
      return entityConfig.enabled && (entityConfig.permissions?.actions?.some(a => a.action === 'delete') ?? true)
    default:
      return false
  }
}
