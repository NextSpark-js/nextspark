/**
 * Stage 4 (#203): the API explorer's docs.md and presets.ts live with each route - core's next to its
 * route module in the package, the project's next to its handler in api/ - and a generated host serves
 * the project's api/ at /api/<path> and plugins at /api/plugins/<plugin>/**, so the registries name them there.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/api-docs-colocated.test.mjs
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { discoverApiPresets } from '../discovery/api-presets.mjs'
import { discoverRouteFiles } from '../discovery/plugins.mjs'
import { generateRouteHandlersRegistry } from '../generators/route-handlers.mjs'

const presets = endpoint => `export default defineApiEndpoint({\n  endpoint: '${endpoint}',\n  summary: 'S',\n  presets: [{ id: 'a', title: 'A', method: 'GET' }]\n})\n`

async function world(files) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-api-docs-'))
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  const config = { projectRoot: root, projectSourceDir: root, projectName: 'p', coreDir: join(root, 'core') }
  return { root, config, cleanup: () => rm(root, { recursive: true, force: true }) }
}

const byEndpoint = list => Object.fromEntries(list.map(entry => [entry.endpoint, entry]))

test('core\'s docs and presets are read from next to its route modules; the project\'s api/ maps to /api/<path>', async () => {
  const w = await world({
    'api/ai/usage/docs.md': '# Usage\n',
    'api/ai/usage/presets.ts': presets('/api/ai/usage'),
    'api/reports/docs.md': '# Reports\n',
    'core/src/routes/api/v1/billing/docs.md': '# Billing API\n',
    'core/src/routes/api/v1/billing/presets.ts': presets('/api/v1/billing'),
    'core/src/routes/api/v1/[entity]/docs.md': '# Dynamic Entity API\n',
  })
  try {
    const { docs, presets: found } = await discoverApiPresets(w.config)
    assert.deepEqual(Object.keys(byEndpoint(docs)).sort(), ['/api/ai/usage', '/api/reports', '/api/v1/[entity]', '/api/v1/billing'])
    assert.deepEqual(docs.map(doc => [doc.endpoint, doc.source]).sort(), [
      ['/api/ai/usage', 'route'],
      ['/api/reports', 'route'],
      ['/api/v1/[entity]', 'core'],
      ['/api/v1/billing', 'core'],
    ])
    assert.equal(byEndpoint(docs)['/api/v1/billing'].filePath, 'core/src/routes/api/v1/billing/docs.md')
    assert.equal(byEndpoint(docs)['/api/reports'].filePath, 'api/reports/docs.md', 'a project doc stays next to its handler')
    assert.deepEqual(found.map(entry => [entry.endpoint, entry.source]).sort(), [['/api/ai/usage', 'route'], ['/api/v1/billing', 'core']])
  } finally {
    await w.cleanup()
  }
})

test('the published package keeps them under dist/routes/api; a source checkout wins over a stale build', async () => {
  const published = await world({ 'core/dist/routes/api/v1/users/docs.md': '# Users\n', 'core/dist/routes/api/v1/users/presets.ts': presets('/api/v1/users') })
  const both = await world({ 'core/src/routes/api/v1/users/docs.md': '# Users (source)\n', 'core/dist/routes/api/v1/teams/docs.md': '# Teams (stale)\n' })
  try {
    const fromDist = await discoverApiPresets(published.config)
    assert.deepEqual(fromDist.docs.map(doc => [doc.endpoint, doc.filePath]), [['/api/v1/users', 'core/dist/routes/api/v1/users/docs.md']])
    assert.equal(fromDist.presets.length, 1)
    const both_ = await discoverApiPresets(both.config)
    assert.deepEqual(both_.docs.map(doc => doc.endpoint), ['/api/v1/users'], 'src/routes wins')
  } finally {
    await published.cleanup()
    await both.cleanup()
  }
})

test('a project doc for an endpoint wins over core\'s for the same endpoint', async () => {
  const w = await world({ 'api/v1/x/docs.md': '# Mine\n', 'core/src/routes/api/v1/x/docs.md': '# Core\n' })
  try {
    const { docs } = await discoverApiPresets(w.config)
    assert.deepEqual(docs.map(doc => [doc.endpoint, doc.title, doc.source]), [['/api/v1/x', 'Mine', 'route']])
  } finally {
    await w.cleanup()
  }
})

test('the route registry of a generated host executes nothing and names the URLs the routes are served at', async () => {
  const plugin = { name: 'ai', importBase: '@/plugins/ai', routeFiles: [{ relativePath: 'generate', methods: ['POST'] }, { relativePath: '/', methods: ['GET'] }] }
  const theme = { name: 'default', routeFiles: [{ relativePath: 'ai/usage', methods: ['GET'] }] }

  const legacy = generateRouteHandlersRegistry([plugin], [theme], [], [], { generatedHost: false })
  assert.match(legacy, /import \* as plugin_ai_generate from '@\/plugins\/ai\/api\/generate\/route'/)
  assert.match(legacy, /path: '\/api\/v1\/theme\/default\/ai\/usage'/)
  assert.match(legacy, /path: '\/api\/v1\/plugin\/ai\/generate'/)
  assert.match(legacy, /'default\/ai\/usage': \{\n    GET: /)

  const host = generateRouteHandlersRegistry([plugin], [theme], [], [], { generatedHost: true })
  assert.doesNotMatch(host, /^import \* as /m, 'no handler is imported: every route is a route file of its own')
  assert.doesNotMatch(host, /RouteHandler \| undefined>> = \{\n  '/, 'no handler is registered')
  assert.match(host, /path: '\/api\/ai\/usage', methods: \["GET"\], category: 'theme', source: 'default'/)
  assert.match(host, /path: '\/api\/plugins\/ai\/generate'/)
  assert.match(host, /path: '\/api\/plugins\/ai', methods: \["GET"\]/)
  assert.doesNotMatch(host, /\/api\/v1\/(theme|plugin)/)
})

test('a plugin\'s route files are named at the URL the host serves them at', async () => {
  const w = await world({ 'plugin/api/lookup/route.ts': 'export async function GET() {}\n', 'plugin/api/route.ts': 'export async function POST() {}\n' })
  try {
    const paths = async options => (await discoverRouteFiles(join(w.root, 'plugin/api'), 'search', '@/plugins/search', options)).map(route => route.path).sort()
    assert.deepEqual(await paths({ generatedHost: true }), ['/api/plugins/search', '/api/plugins/search/lookup'])
    assert.deepEqual(await paths(), ['/api/v1/plugin/search', '/api/v1/plugin/search/lookup'])
  } finally {
    await w.cleanup()
  }
})
