/**
 * Scheduled Action Handler: Invalidate Pattern Cache
 *
 * Asynchronously invalidates ISR cache for all pages using a pattern.
 * This is triggered when a pattern's blocks are updated, ensuring
 * dependent pages are refreshed without blocking the update request.
 *
 * @module core/lib/scheduled-actions/handlers/invalidate-pattern-cache
 */

import { revalidatePath } from 'next/cache'
import { registerScheduledAction } from '../registry'
import { PatternUsageService } from '../../services/pattern-usage.service'
import { entityRegistry } from '../../entities/registry'
import { getEntityBasePath } from '../../entities/schema-generator'
import type { ScheduledAction } from '../types'

/**
 * Payload for pattern cache invalidation action
 */
interface InvalidatePatternCachePayload {
  patternId: string
  userId: string
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
 * Register the pattern cache invalidation handler
 *
 * Call this function during app initialization to register the handler.
 * The handler processes invalidations in batches for better performance.
 */
export function registerPatternCacheInvalidationHandler(): void {
  registerScheduledAction(
    'pattern:invalidate-cache',
    async (payload: unknown, action: ScheduledAction): Promise<void> => {
      const { patternId, userId } = payload as InvalidatePatternCachePayload

      console.info(
        `[ScheduledAction:pattern:invalidate-cache] Starting for pattern ${patternId} (action: ${action.id})`
      )

      // Get all entities using this pattern
      // NOTE: Limited to 1000 usages per invalidation run to prevent timeouts.
      // For patterns with >1000 usages, only the first 1000 pages are invalidated.
      // This is acceptable because:
      // 1. Patterns with 1000+ usages are extremely rare
      // 2. ISR will eventually refresh remaining pages on next request
      // 3. Multiple scheduled action runs can be triggered if needed
      const MAX_USAGES = 1000
      const { usages, total } = await PatternUsageService.getUsagesWithEntityInfo(
        patternId,
        userId,
        { limit: MAX_USAGES }
      )

      if (total === 0) {
        console.info(
          `[ScheduledAction:pattern:invalidate-cache] Pattern ${patternId} has no usages, nothing to invalidate`
        )
        return
      }

      if (total > MAX_USAGES) {
        console.warn(
          `[ScheduledAction:pattern:invalidate-cache] Pattern ${patternId} has ${total} usages, ` +
          `only invalidating first ${MAX_USAGES}. Remaining pages will refresh via ISR.`
        )
      }

      const invalidatedPaths: string[] = []

      // Process in batches for better performance
      const BATCH_SIZE = 10
      for (let i = 0; i < usages.length; i += BATCH_SIZE) {
        const batch = usages.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (usage) => {
            const publicUrl = getEntityPublicUrl(usage.entityType, usage.entitySlug)

            if (publicUrl) {
              try {
                revalidatePath(publicUrl)
                invalidatedPaths.push(publicUrl)
              } catch (error) {
                console.warn(
                  `[ScheduledAction:pattern:invalidate-cache] Failed to revalidate ${publicUrl}:`,
                  error
                )
              }
            }
          })
        )
      }

      console.info(
        `[ScheduledAction:pattern:invalidate-cache] Pattern ${patternId}: ` +
        `Invalidated ${invalidatedPaths.length}/${total} pages. ` +
        `Sample paths: ${invalidatedPaths.slice(0, 5).join(', ')}${invalidatedPaths.length > 5 ? '...' : ''}`
      )
    },
    {
      description: 'Invalidate ISR cache for pages using a pattern',
      timeout: 30000 // 30 seconds timeout for large invalidations
    }
  )

  console.log('[ScheduledActions] Registered handler: pattern:invalidate-cache')
}
