/**
 * Tests for the block-registry generators.
 *
 * What matters is which module carries which binding. block-registry.ts holds a
 * static import of every block component, for server rendering, so whatever
 * imports it bundles every block. Client components render blocks through
 * block-registry.lazy.ts, which must not import a component statically, and read
 * configs through block-registry.client.ts, which must not import one at all.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/block-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  generateBlockRegistry,
  generateBlockRegistryClient,
  generateBlockRegistryLazy
} from '../generators/block-registry.mjs'

function block(slug, category) {
  const base = `@/contents/themes/default/blocks/${slug}`
  return {
    slug,
    name: slug,
    description: `${slug} block`,
    category,
    icon: 'Box',
    scope: ['pages'],
    hasExamples: false,
    themeName: 'default',
    paths: {
      component: `${base}/component`,
      schema: `${base}/schema`,
      fields: `${base}/fields`,
      thumbnail: `/theme/blocks/${slug}/thumbnail.png`,
    },
  }
}

const blocks = [block('hero', 'hero'), block('cta-section', 'cta')]
const config = { outputDir: '/tmp/registries', projectRoot: '/tmp/project' }
const staticComponentImport = /^import .* from '[^']*\/component'/m

test('the lazy registry loads each component on demand and imports none statically', () => {
  const out = generateBlockRegistryLazy(blocks)
  assert.doesNotMatch(out, staticComponentImport)
  assert.match(out, /'hero': React\.lazy\(\(\) => import\('@\/contents\/themes\/default\/blocks\/hero\/component'\)/)
  assert.match(out, /'cta-section': React\.lazy\(\(\) => import\('@\/contents\/themes\/default\/blocks\/cta-section\/component'\)/)
})

test('the client registry imports no component', () => {
  const out = generateBlockRegistryClient(blocks, config)
  assert.doesNotMatch(out, staticComponentImport)
  assert.doesNotMatch(out, /import\('[^']*\/component'\)/)
})

test('the server registry imports components statically and re-exports the other halves', () => {
  const out = generateBlockRegistry(blocks, config)
  assert.match(out, staticComponentImport)
  assert.match(out, /export \* from '\.\/block-registry\.client'/)
  assert.match(out, /export \{ BLOCK_COMPONENTS \} from '\.\/block-registry\.lazy'/)
  assert.doesNotMatch(out, /React\.lazy/)
})

test('with no blocks, each half still exports what its importers expect', () => {
  assert.match(generateBlockRegistryLazy([]), /export const BLOCK_COMPONENTS\b/)
  assert.match(generateBlockRegistryClient([], config), /export const BLOCK_REGISTRY\b/)
  const server = generateBlockRegistry([], config)
  assert.match(server, /export \{ BLOCK_COMPONENTS \} from '\.\/block-registry\.lazy'/)
  assert.match(server, /export const BLOCK_COMPONENTS_SSR\b/)
})
