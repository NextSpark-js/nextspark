/**
 * Public Entity Resolver
 * 
 * Similar to entity resolver but specifically for public-facing pages.
 * Determines which entities are publicly accessible and handles custom overrides.
 */

import { entityRegistry, ensureInitialized } from '../../entities/registry'
import type { EntityConfig } from '../../entities/types'
import { existsSync } from 'fs'
import { join } from 'path'

export interface PublicEntityResolution {
  entityName: string
  entityConfig: EntityConfig | null
  hasCustomOverride: boolean
  isValidPublicEntity: boolean
  hasArchivePage: boolean
  hasSinglePage: boolean
}

/**
 * Resolve entity from public URL path
 */
export async function resolvePublicEntityFromUrl(pathname: string): Promise<PublicEntityResolution> {
  // Extract entity name from URL path
  // Examples: 
  // /products -> products
  // /products/123 -> products
  const segments = pathname.split('/').filter(Boolean)
  
  if (segments.length === 0) {
    return {
      entityName: '',
      entityConfig: null,
      hasCustomOverride: false,
      isValidPublicEntity: false,
      hasArchivePage: false,
      hasSinglePage: false
    }
  }

  const entitySlug = segments[0] // This is the slug from URL (e.g., "products", "clients")

  // Get entity config from registry by slug
  await ensureInitialized()
  const entityConfig = entityRegistry.getBySlug(entitySlug)

  if (!entityConfig) {
    return {
      entityName: entitySlug,
      entityConfig: null,
      hasCustomOverride: false,
      isValidPublicEntity: false,
      hasArchivePage: false,
      hasSinglePage: false
    }
  }

  // Check if entity is public and enabled
  const isPublicEntity = entityConfig.access?.public && entityConfig.enabled

  if (!isPublicEntity) {
    return {
      entityName: entityConfig.slug,
      entityConfig,
      hasCustomOverride: false,
      isValidPublicEntity: false,
      hasArchivePage: false,
      hasSinglePage: false
    }
  }

  // Check if custom override exists (using slug for path)
  const hasCustomOverride = await checkPublicCustomOverride(entitySlug)

  return {
    entityName: entityConfig.slug,
    entityConfig,
    hasCustomOverride,
    isValidPublicEntity: true,
    hasArchivePage: entityConfig.ui?.public?.hasArchivePage ?? false,
    hasSinglePage: entityConfig.ui?.public?.hasSinglePage ?? false
  }
}

/**
 * Check if entity has custom override in public (contents) folder
 */
async function checkPublicCustomOverride(entityName: string): Promise<boolean> {
  try {
    // Check if custom route file exists for list page
    const customListPath = join(
      process.cwd(), 
      'app', 
      '(public)', 
      '(contents)', 
      entityName, 
      'page.tsx'
    )
    
    return existsSync(customListPath)
  } catch (error) {
    console.warn(`Error checking public custom override for ${entityName}:`, error)
    return false
  }
}

/**
 * Get all public entities that can be handled
 */
export async function getPublicEntities(): Promise<EntityConfig[]> {
  await ensureInitialized()
  const allEntities = entityRegistry.getAll()

  return allEntities.filter(entity =>
    entity.enabled &&
    entity.access?.public &&
    (entity.ui?.public?.hasArchivePage || entity.ui?.public?.hasSinglePage)
  )
}

/**
 * Validate public entity supports the requested page type
 */
export function validatePublicEntityPage(
  entityConfig: EntityConfig,
  pageType: 'archive' | 'single'
): boolean {
  if (!entityConfig.access?.public || !entityConfig.enabled) {
    return false
  }

  switch (pageType) {
    case 'archive':
      return entityConfig.ui?.public?.hasArchivePage ?? false
    case 'single':
      return entityConfig.ui?.public?.hasSinglePage ?? false
    default:
      return false
  }
}