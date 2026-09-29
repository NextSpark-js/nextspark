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
  generateBlockRegistryLazy,
  generateBlockSchemas
} from '../generators/block-registry.mjs'
import { readSchemaExport } from '../discovery/blocks.mjs'
import { validateGeneratedModule } from '../host/static-imports.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

function block(slug, category) {
  const base = `@/blocks/${slug}`
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
  assert.match(out, /'hero': React\.lazy\(\(\) => import\('@\/blocks\/hero\/component'\)/)
  assert.match(out, /'cta-section': React\.lazy\(\(\) => import\('@\/blocks\/cta-section\/component'\)/)
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

test('the schema map imports each block schema statically, keyed by slug, in the registry grammar', async () => {
  const withSchema = [{ ...block('hero', 'hero'), exportsSchema: true }, { ...block('cta-section', 'cta'), exportsSchema: true }]
  const content = generateBlockSchemas([...withSchema, { ...block('benefits', 'content'), exportsSchema: false }])
  assert.match(content, /^import \{ schema as hero_schema \} from '@\/blocks\/hero\/schema'$/m)
  assert.match(content, /^import \{ schema as cta_section_schema \} from '@\/blocks\/cta-section\/schema'$/m)
  assert.match(content, /'hero': hero_schema/)
  assert.match(content, /'cta-section': cta_section_schema/)
  assert.doesNotMatch(content, /benefits/, 'a block without a `schema` export gets no entry')
  assert.doesNotMatch(content, /import\(|require\(/, 'nothing is loaded by a runtime path')
  const ts = await loadTypeScriptFor(process.cwd())
  assert.deepEqual(validateGeneratedModule({ ts, source: content, file: 'block-schemas.ts', grammar: 'registry' }), [])
  assert.deepEqual(validateGeneratedModule({ ts, source: generateBlockSchemas([]), file: 'block-schemas.ts', grammar: 'registry' }), [])
})

test('discovery reads the `schema` export from the syntax tree: a const zod schema only', async () => {
  const ts = await loadTypeScriptFor(process.cwd())
  const read = source => readSchemaExport(source, 'schema.ts', ts)
  const accepted = {
    'export const': "import { z } from 'zod'\nexport const schema = z.object({})",
    'export { schema } of a const': "import { z } from 'zod'\nconst schema = z.object({})\nexport { schema }",
    'export { alias as schema } of a const': "import { z } from 'zod'\nconst heroSchema = z.object({})\nexport { heroSchema as schema }",
    'exported const beside a type of the same name': "import { z } from 'zod'\nexport const schema = z.object({})\nexport type Schema = z.infer<typeof schema>",
  }
  for (const [label, source] of Object.entries(accepted)) assert.deepEqual(read(source), { exportsSchema: true }, label)

  const rejected = {
    'line comment': "// The old convention was: export const schema = z.object({})\nexport const legacySchema = 1",
    'block comment': "/* export const schema = z.object({}) */\nexport const legacySchema = 1",
    'string literal': "export const docs = 'export const schema = z.object({})'",
    'template literal': 'export const docs = `export { schema }`',
    'type-only specifier': "type schema = string\nexport { type schema }",
    'type-only export clause': "type schema = string\nexport type { schema }",
    'interface named schema': 'export interface schema { a: string }',
    'type alias named schema': 'export type schema = { a: string }',
    'function': 'export function schema() { return null }',
    'class': 'export class schema {}',
    'let': "import { z } from 'zod'\nexport let schema = z.object({})",
    'var': "import { z } from 'zod'\nexport var schema = z.object({})",
    'declare const': 'export declare const schema: unknown',
    'destructuring': "export const { schema } = { schema: 1 }",
    'export { local } of a let': "import { z } from 'zod'\nlet s = z.object({})\nexport { s as schema }",
    'export { imported as schema }': "import { heroSchema } from './base'\nexport { heroSchema as schema }",
    're-export from another module': "export { schema } from './base'",
    'renamed away': "import { z } from 'zod'\nconst schema = z.object({})\nexport { schema as heroSchema }",
    'no export at all': 'export const heroSchema = 1',
  }
  for (const [label, source] of Object.entries(rejected)) {
    const result = read(source)
    assert.equal(result.exportsSchema, false, label)
    assert.ok(result.reason.length > 0, `${label} carries a reason`)
  }
})

test('a block schema.ts discovery rejects gets no map entry, so the app still builds', async () => {
  const ts = await loadTypeScriptFor(process.cwd())
  const commented = readSchemaExport("// export const schema = z.object({})\nexport const legacySchema = 1", 'schema.ts', ts)
  const content = generateBlockSchemas([{ ...block('legacy', 'content'), exportsSchema: commented.exportsSchema }])
  assert.doesNotMatch(content, /legacy/)
  assert.match(content, /^export const BLOCK_SCHEMAS = \{\}$/m)
})
