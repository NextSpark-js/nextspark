/**
 * Pattern Usage Hooks
 *
 * Integrates pattern usage tracking with the entity hook system.
 * Automatically syncs pattern usages when entities with blocks are created/updated/deleted.
 *
 * @module PatternUsageHooks
 */

import { getGlobalHooks } from '../plugins/hook-system'
import { PatternUsageService } from '../services/pattern-usage.service'
import { entityRegistry } from './registry'
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

  console.log('[PatternUsageHooks] Initialized pattern usage tracking hooks')
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
