/**
 * Block components for server rendering: direct imports, no React.lazy, so a
 * public page renders its blocks in the HTML without waiting on client JS.
 *
 * They come from block-registry.ts, which imports every block component
 * statically. A client component that imports this module carries every block
 * into its bundle, so only server code imports it; client code uses loader.ts.
 *
 * @module core/lib/blocks/loader.server
 */

import { ComponentType } from 'react'
import { BLOCK_COMPONENTS_SSR } from '@nextsparkjs/registries/block-registry'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockComponent = ComponentType<any>

/** Every block component for server rendering, by slug. */
export function getBlockComponentsSSR(): Record<string, BlockComponent> {
  return BLOCK_COMPONENTS_SSR
}

/** A block component for server rendering, or undefined when the slug has none. */
export function getBlockComponentSSR(slug: string): BlockComponent | undefined {
  return BLOCK_COMPONENTS_SSR[slug]
}
