/**
 * Tests for discoverMcpOverrides.
 *
 * Run: node --test packages/core/scripts/build/registry/discovery/mcp-overrides.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { discoverMcpOverrides } from './mcp-overrides.mjs'

async function makeThemeFixture(entities) {
  const root = await mkdtemp(join(tmpdir(), 'mcp-overrides-test-'))
  const themesDir = join(root, 'themes')
  const themeName = 'testtheme'
  const entitiesDir = join(themesDir, themeName, 'entities')

  for (const [slug, files] of Object.entries(entities)) {
    const entityDir = join(entitiesDir, slug)
    await mkdir(entityDir, { recursive: true })
    for (const file of files) {
      await writeFile(join(entityDir, file), '// fixture\n')
    }
  }

  return { root, themesDir, themeName }
}

test('returns an empty array when there is no active theme', async () => {
  const result = await discoverMcpOverrides({ activeTheme: undefined, themesDir: '/nonexistent' })
  assert.deepEqual(result, [])
})

test('returns an empty array when the theme has no entities directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-overrides-test-'))
  const result = await discoverMcpOverrides({ activeTheme: 'ghost', themesDir: join(root, 'themes') })
  assert.deepEqual(result, [])
  await rm(root, { recursive: true, force: true })
})

test('finds mcp.ts at the entity folder root, not nested under api/', async () => {
  const { root, themesDir, themeName } = await makeThemeFixture({
    customers: ['customers.config.ts', 'mcp.ts'],
  })
  const result = await discoverMcpOverrides({ activeTheme: themeName, themesDir })
  assert.equal(result.length, 1)
  assert.equal(result[0].slug, 'customers')
  assert.equal(result[0].importPath, `@/contents/themes/${themeName}/entities/customers/mcp`)
  await rm(root, { recursive: true, force: true })
})

test('skips entities that have no mcp.ts', async () => {
  const { root, themesDir, themeName } = await makeThemeFixture({
    customers: ['customers.config.ts', 'mcp.ts'],
    tasks: ['tasks.config.ts'],
  })
  const result = await discoverMcpOverrides({ activeTheme: themeName, themesDir })
  assert.deepEqual(result.map((r) => r.slug), ['customers'])
  await rm(root, { recursive: true, force: true })
})

test('does NOT match a preset-style entities/<slug>/api/mcp.ts (wrong location)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-overrides-test-'))
  const themesDir = join(root, 'themes')
  const themeName = 'testtheme'
  await mkdir(join(themesDir, themeName, 'entities', 'customers', 'api'), { recursive: true })
  await writeFile(join(themesDir, themeName, 'entities', 'customers', 'api', 'mcp.ts'), '// wrong spot\n')

  const result = await discoverMcpOverrides({ activeTheme: themeName, themesDir })
  assert.deepEqual(result, [])
  await rm(root, { recursive: true, force: true })
})

test('discovers multiple entity overrides in the same theme', async () => {
  const { root, themesDir, themeName } = await makeThemeFixture({
    customers: ['mcp.ts'],
    tasks: ['mcp.ts'],
    posts: [],
  })
  const result = await discoverMcpOverrides({ activeTheme: themeName, themesDir })
  assert.deepEqual(result.map((r) => r.slug).sort(), ['customers', 'tasks'])
  await rm(root, { recursive: true, force: true })
})
