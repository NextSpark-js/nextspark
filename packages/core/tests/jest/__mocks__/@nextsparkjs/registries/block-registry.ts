/**
 * Mock Block Registry for Jest tests
 */

export const BLOCK_REGISTRY: Record<string, any> = {}

export const BLOCK_COMPONENTS: Record<string, any> = {}

export const BLOCK_METADATA = {
  generated: new Date().toISOString(),
  totalBlocks: 0,
}
