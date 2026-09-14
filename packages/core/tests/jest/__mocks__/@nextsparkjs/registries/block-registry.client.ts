/**
 * The client half of the block registry, for tests.
 *
 * Re-exports the mock's configs rather than restating them, so the two halves
 * cannot drift the way the generated pair must not.
 */
export { BLOCK_REGISTRY, BLOCK_METADATA } from './block-registry'

export const BLOCK_CATEGORIES: string[] = []
