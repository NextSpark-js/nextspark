/**
 * Pattern Usage Hooks
 *
 * Integrates pattern usage tracking with the entity hook system.
 * Automatically syncs pattern usages when entities with blocks are created/updated/deleted.
 * Also handles ISR cache invalidation when patterns are updated.
 *
 * @module PatternUsageHooks
 */

import { revalidatePath } from 'next/cache'
import { getGlobalHooks } from '../plugins/hook-system'
import { PatternUsageService } from '../services/pattern-usage.service'
import { entityRegistry } from './registry'
import { getEntityBasePath } from './schema-generator'
import type { EntityHookData } from './entity-hooks'

/**
 * Check if an entity has blocks (builder-enabled entities)
 *
 * @param entityName - Entity slug name
 * @returns true if entity has builder.enabled: true
 */
function hasBlocksColumn(entityName: string): boolean {
  try {
    const entityConfig = entityRegistry.get(entityName)
    return entityConfig?.builder?.enabled === true
  } catch {
    return false
  }
}

/**
 * Extract blocks from entity data
 *
 * @param data - Entity data object
 * @returns Array of blocks or empty array
 */
function extractBlocks(data: Record<string, unknown> | undefined): unknown[] {
  if (!data || !('blocks' in data)) return []
  const blocks = data.blocks
  if (!Array.isArray(blocks)) return []
  return blocks
}

/**
 * Build public URL for an entity
 *
 * Uses entity's basePath configuration to construct the public URL.
 * Returns null if entity has no public page (access.public === false).
 *
 * @param entityType - Entity slug (e.g., 'pages', 'posts')
 * @param entitySlug - Slug of the specific entity instance
 * @returns Public URL or null if no public page
 *
 * @example
 * // Pages with basePath '/'
 * getEntityPublicUrl('pages', 'about') // '/about'
 *
 * // Posts with basePath '/blog'
 * getEntityPublicUrl('posts', 'hello-world') // '/blog/hello-world'
 */
function getEntityPublicUrl(entityType: string, entitySlug: string | undefined): string | null {
  if (!entitySlug) return null

  try {
    const entityConfig = entityRegistry.get(entityType)
    if (!entityConfig) return null

    // Check if entity has public pages
    if (entityConfig.access?.public === false) return null

    // Get base path (e.g., '/' for pages, '/blog' for posts)
    const basePath = getEntityBasePath(entityConfig)

    // Build full public URL
    if (basePath === '/') {
      return `/${entitySlug}`
    } else if (basePath) {
      return `${basePath}/${entitySlug}`
    }

    // Fallback: use entity slug as path prefix
    return `/${entityType}/${entitySlug}`
  } catch {
    return null
  }
}

/**
 * Invalidate ISR cache for all pages using a pattern
 *
 * Queries pattern_usages to find all entities using the pattern,
 * then calls revalidatePath for each entity's public URL.
 *
 * @param patternId - ID of the updated pattern
 * @param userId - User ID for RLS queries
 */
async function invalidateDependentPagesCache(patternId: string, userId: string): Promise<void> {
  try {
    // Get all entities using this pattern
    const { usages, total } = await PatternUsageService.getUsagesWithEntityInfo(
      patternId,
      userId,
      { limit: 1000 } // High limit to get all usages
    )

    if (total === 0) {
      console.log(`[PatternUsageHooks] Pattern ${patternId} has no usages, no cache invalidation needed`)
      return
    }

    // Track invalidated paths for logging
    const invalidatedPaths: string[] = []

    // Invalidate cache for each entity's public URL
    for (const usage of usages) {
      const publicUrl = getEntityPublicUrl(usage.entityType, usage.entitySlug)

      if (publicUrl) {
        try {
          revalidatePath(publicUrl)
          invalidatedPaths.push(publicUrl)
        } catch (error) {
          console.warn(`[PatternUsageHooks] Failed to revalidate ${publicUrl}:`, error)
        }
      }
    }

    console.log(
      `[PatternUsageHooks] Pattern ${patternId} updated. ` +
      `Invalidated ISR cache for ${invalidatedPaths.length}/${total} pages: ` +
      `${invalidatedPaths.slice(0, 5).join(', ')}${invalidatedPaths.length > 5 ? '...' : ''}`
    )
  } catch (error) {
    // Log but don't fail - cache invalidation is best-effort
    console.error(`[PatternUsageHooks] Error invalidating cache for pattern ${patternId}:`, error)
  }
}

/**
 * Initialize pattern usage hooks
 *
 * Call this function during app initialization to register the hooks.
 * The hooks will automatically track pattern usages for all builder-enabled entities.
 *
 * @example
 * ```typescript
 * // In your app initialization (e.g., layout.tsx or a server initialization file)
 * import { initPatternUsageHooks } from '@nextsparkjs/core/lib/entities/pattern-usage-hooks'
 *
 * initPatternUsageHooks()
 * ```
 */
export function initPatternUsageHooks(): void {
  const hooks = getGlobalHooks()

  // Hook: entity.created - Sync usages when entity is created
  hooks.addAction('entity.created', async (hookData: unknown) => {
    const data = hookData as EntityHookData
    const { entityName, data: entityData, userId } = data

    // Skip if entity doesn't have blocks
    if (!hasBlocksColumn(entityName)) return

    // Skip patterns themselves (they don't reference other patterns)
    if (entityName === 'patterns') return

    const entity = entityData as Record<string, unknown> | undefined
    if (!entity?.id || !entity?.teamId) return

    const blocks = extractBlocks(entity)
    if (blocks.length === 0) return

    await PatternUsageService.syncUsages(
      entityName,
      String(entity.id),
      String(entity.teamId),
      blocks as Parameters<typeof PatternUsageService.syncUsages>[3],
      userId || 'system'
    )
  })

  // Hook: entity.updated - Sync usages when entity is updated
  hooks.addAction('entity.updated', async (hookData: unknown) => {
    const data = hookData as EntityHookData
    const { entityName, data: entityData, userId } = data

    // Skip if entity doesn't have blocks
    if (!hasBlocksColumn(entityName)) return

    // Skip patterns themselves
    if (entityName === 'patterns') return

    const entity = entityData as Record<string, unknown> | undefined
    if (!entity?.id || !entity?.teamId) return

    const blocks = extractBlocks(entity)

    // Sync even if blocks is empty (might have removed all patterns)
    await PatternUsageService.syncUsages(
      entityName,
      String(entity.id),
      String(entity.teamId),
      blocks as Parameters<typeof PatternUsageService.syncUsages>[3],
      userId || 'system'
    )
  })

  // Hook: entity.deleted - Remove usages when entity is deleted
  hooks.addAction('entity.deleted', async (hookData: unknown) => {
    const data = hookData as EntityHookData
    const { entityName, id, userId } = data

    // Skip if entity doesn't have blocks
    if (!hasBlocksColumn(entityName)) return

    // Skip patterns themselves (handled by DB CASCADE)
    if (entityName === 'patterns') return

    if (!id) return

    await PatternUsageService.removeEntityUsages(
      entityName,
      id,
      userId || 'system'
    )
  })

  // Hook: entity.patterns.updated - Invalidate ISR cache for pages using the updated pattern
  // This ensures that when a pattern's blocks are modified, all pages using that pattern
  // are immediately refreshed instead of waiting for ISR expiration (1 hour default)
  hooks.addAction('entity.patterns.updated', async (hookData: unknown) => {
    const data = hookData as EntityHookData
    const { id, userId } = data

    if (!id) return

    // Invalidate cache for all pages using this pattern
    await invalidateDependentPagesCache(id, userId || 'system')
  })

  console.log('[PatternUsageHooks] Initialized pattern usage tracking and cache invalidation hooks')
}

/**
 * Check if pattern usage hooks are initialized
 *
 * Useful for debugging or conditional initialization.
 */
export function isPatternUsageHooksInitialized(): boolean {
  const hooks = getGlobalHooks()
  return hooks.hasHook('entity.created')
}
