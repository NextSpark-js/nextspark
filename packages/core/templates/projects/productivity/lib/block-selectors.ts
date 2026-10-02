/**
 * Block selectors, and a `sel` bound to them alone.
 *
 * Block components import `sel` from here, not from ./selectors: that file merges CORE_SELECTORS (every domain's
 * map, ~10 kB gzip), and the loader that renders a page imports every block, so a block importing it puts the
 * whole map on each public page. ./selectors re-exports BLOCK_SELECTORS, so Cypress still reaches the same paths.
 */

import { createSelectorHelpers } from '@nextsparkjs/core/lib/selectors/selector-factory'

/**
 * Block-specific selectors for the productivity theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  // Blocks the pages and blog content features copy into the project (blocks/hero, blocks/post-content)
  hero: {
    container: 'block-hero',
    cta: 'hero-cta',
  },
  postContent: {
    container: 'block-post-content',
    divider: 'post-content-divider',
    cta: 'post-content-cta',
  },
} as const

export const { sel } = createSelectorHelpers({ blocks: BLOCK_SELECTORS })
