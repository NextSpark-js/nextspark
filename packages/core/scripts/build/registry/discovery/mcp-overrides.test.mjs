/** Tests for root-first MCP override discovery. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverMcpOverrides } from './mcp-overrides.mjs'

async function makeProject(entities) {
  const root = await mkdtemp(join(tmpdir(), 'mcp-overrides-test-'))
  const entitiesDir = join(root, 'entities')
  for (const [slug, files] of Object.entries(entities)) {
    const entityDir = join(entitiesDir, slug)
    await mkdir(entityDir, { recursive: true })
    for (const file of files) await writeFile(join(entityDir, file), '// fixture\n')
  }
  return { root, config: { projectSourceDir: root, projectName: 'test-project' } }
}

test('returns an empty array when the project has no entities directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-overrides-test-'))
  try { assert.deepEqual(await discoverMcpOverrides({ projectSourceDir: root, projectName: 'test-project' }), []) }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('finds mcp.ts at the entity folder root, not nested under api/', async () => {
  const { root, config } = await makeProject({ customers: ['customers.config.ts', 'mcp.ts'] })
  try {
    const result = await discoverMcpOverrides(config)
    assert.equal(result.length, 1)
    assert.deepEqual(result[0], { slug: 'customers', importPath: '@/entities/customers/mcp', themeName: 'test-project' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('skips entities that have no mcp.ts and nested api/mcp.ts files', async () => {
  const { root, config } = await makeProject({ customers: ['mcp.ts'], tasks: ['tasks.config.ts'] })
  await mkdir(join(root, 'entities/orders/api'), { recursive: true })
  await writeFile(join(root, 'entities/orders/api/mcp.ts'), '// wrong spot\n')
  try { assert.deepEqual((await discoverMcpOverrides(config)).map(r => r.slug), ['customers']) }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('discovers multiple project entity overrides', async () => {
  const { root, config } = await makeProject({ customers: ['mcp.ts'], tasks: ['mcp.ts'], posts: [] })
  try { assert.deepEqual((await discoverMcpOverrides(config)).map(r => r.slug).sort(), ['customers', 'tasks']) }
  finally { await rm(root, { recursive: true, force: true }) }
})
