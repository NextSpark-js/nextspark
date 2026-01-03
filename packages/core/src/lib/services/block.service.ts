/**
 * Block Service
 *
 * Provides block lookup and query operations.
 * Uses pre-computed data from block-registry for O(1) operations.
 *
 * @module BlockService
 */

import type { BlockConfig, BlockCategory } from '../../types/blocks'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

/**
 * Block Service - Provides runtime block queries
 *
 * This service layer abstracts block registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) or O(n) with zero I/O.
 */
export class BlockService {
  /**
   * Get all registered blocks
   *
   * @returns Array of all block configurations
   *
   * @example
   * ```typescript
   * const blocks = BlockService.getAll()
   * // Returns all 16 blocks from the registry
   * ```
   */
  static getAll(): BlockConfig[] {
    return Object.values(BLOCK_REGISTRY)
  }

  /**
   * Get block by slug
   *
   * @param slug - Unique block identifier
   * @returns Block configuration or undefined if not found
   *
   * @example
   * ```typescript
   * const heroBlock = BlockService.get('hero')
   * if (heroBlock) {
   *   console.log(heroBlock.name) // "Hero Section"
   * }
   * ```
   */
  static get(slug: string): BlockConfig | undefined {
    return BLOCK_REGISTRY[slug]
  }

  /**
   * Get blocks by category
   *
   * @param category - Block category to filter by
   * @returns Array of blocks in the specified category
   *
   * @example
   * ```typescript
   * const heroBlocks = BlockService.getByCategory('hero')
   * // Returns all hero blocks (4 blocks)
   * ```
   */
  static getByCategory(category: BlockCategory): BlockConfig[] {
    return Object.values(BLOCK_REGISTRY).filter(block => block.category === category)
  }

  /**
   * Check if block exists
   *
   * @param slug - Block slug to check
   * @returns True if block exists in registry
   *
   * @example
   * ```typescript
   * if (BlockService.has('hero')) {
   *   // Block exists, safe to use
   * }
   * ```
   */
  static has(slug: string): boolean {
    return slug in BLOCK_REGISTRY
  }
}
