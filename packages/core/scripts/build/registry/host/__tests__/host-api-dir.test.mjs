/**
 * The project's API directory is configurable (`apiDir` in nextspark.config.ts, default `api`) (#415): the plan, the
 * facades, the registries and `prepare --check` follow it, and the default stays as it was.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverThemes } from '../../discovery/themes.mjs'
import { PLAN_DIAGNOSTICS, planHost } from '../plan.mjs'
import { checkHost, predictHost, prepareHost, projectHostConfig } from '../prepare.mjs'
import { foreignFilesDiagnostic } from '../generation.mjs'
import { loadFixtureCoreRoutes } from '../../../../../tests/fixtures/host-conformance/plan.mjs'
import { PAGE, ROUTE, read, write } from './host-helpers.mjs'

function project(apiDir) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-host-api-dir-'))
  write(root, 'nextspark.config.ts', `export default { plugins: []${apiDir ? `, apiDir: '${apiDir}'` : ''} }\n`)
  write(root, 'package.json', JSON.stringify({ name: 'host-api-dir', dependencies: { next: '16.4.2' } }))
  write(root, 'templates/pricing/page.tsx', PAGE('Pricing'))
  write(root, `${apiDir ?? 'api'}/ping/route.ts`, ROUTE)
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const facadeOf = files => files.find(file => file.path === 'src/app/api/ping/route.ts').content
const summary = planned => planned.routes.filter(route => route.origin === 'project').map(route => `${route.target} <- ${route.specifier} (${route.source})`)

test('the plan reads the configured directory and still serves it at /api/<path>', () => {
  const { root, cleanup } = project('server/api')
  try {
    const planned = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.', apiDir: 'server/api' } })
    assert.deepEqual(planned.diagnostics, [])
    assert.deepEqual(summary(planned).filter(line => line.startsWith('api/')), ['api/ping/route.ts <- @/server/api/ping/route (server/api/ping/route.ts)'])
  } finally {
    cleanup()
  }
})

test('without apiDir the plan is the one apiDir: "api" gives', () => {
  const { root, cleanup } = project()
  try {
    const unset = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.' } })
    const explicit = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.', apiDir: 'api' } })
    assert.deepEqual(summary(unset), summary(explicit))
    assert.deepEqual(summary(unset).filter(line => line.startsWith('api/')), ['api/ping/route.ts <- @/api/ping/route (api/ping/route.ts)'])
  } finally {
    cleanup()
  }
})

test('route files left in api/ after moving the directory stop the plan; other files there do not', () => {
  const { root, cleanup } = project('routes')
  try {
    write(root, 'api/helper.ts', 'export const helper = 1\n')
    write(root, 'api/client/error.ts', 'export const error = 1\n')
    const clean = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.', apiDir: 'routes' } })
    assert.deepEqual(clean.diagnostics, [])

    write(root, 'api/old/route.ts', ROUTE)
    const left = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.', apiDir: 'routes' } })
    assert.deepEqual(left.diagnostics.map(item => item.code), [PLAN_DIAGNOSTICS.API_DIR_LEFTOVER])
    assert.deepEqual(left.diagnostics[0].sources, ['api/old/route.ts'])
    assert.match(left.diagnostics[0].message, /sets apiDir to "routes", but api\/ still has route files \(api\/old\/route\.ts\): move them to routes\//)
  } finally {
    cleanup()
  }
})

test('the namespace refusal names the configured directory', () => {
  const { root, cleanup } = project('routes')
  try {
    write(root, 'routes/v1/mine/route.ts', ROUTE)
    const planned = planHost({ coreRoutes: [], project: { root, importBase: '@', label: '.', apiDir: 'routes' } })
    assert.deepEqual(planned.diagnostics.map(item => item.code), [PLAN_DIAGNOSTICS.API_NAMESPACE])
    assert.match(planned.diagnostics[0].message, /routes\/v1\/mine\/route\.ts would be served in a namespace it does not own: core owns \/api\/v1\/\*\*, the project's routes\/ is served/)
  } finally {
    cleanup()
  }
})

test('the message about foreign files names the configured directory, and api/ by default', () => {
  assert.match(foreignFilesDiagnostic(['src/app/x.ts'], 'routes').message, /to templates\/ or routes\/ \(route sources\)/)
  assert.match(foreignFilesDiagnostic(['src/app/x.ts']).message, /to templates\/ or api\/ \(route sources\)/)
})

test('the project discovery names the route modules of the configured directory', async () => {
  const { root, cleanup } = project('routes')
  try {
    write(root, 'config/theme.config.ts', "export const projectThemeConfig = { name: 'demo' }\n")
    const [theme] = await discoverThemes({ projectSourceDir: root, apiDir: 'routes', plugins: [] })
    assert.deepEqual(theme.routeFiles.map(file => file.filePath), ['@/routes/ping/route'])
  } finally {
    cleanup()
  }
})

test('a real project with the directory moved: the facade is the default one but for the import, docs follow, and --check sees the new directory', { timeout: 300_000 }, async () => {
  const fallback = project()
  const moved = project('server/api')
  try {
    write(fallback.root, 'api/ping/docs.md', '# Ping\n\nThe ping route.\n')
    write(moved.root, 'server/api/ping/docs.md', '# Ping\n\nThe ping route.\n')
    const configOf = root => ({ ...projectHostConfig({ projectRoot: root }), loadCoreRoutes: loadFixtureCoreRoutes })

    const defaultConfig = configOf(fallback.root)
    const defaultRun = await prepareHost(defaultConfig)
    const movedConfig = configOf(moved.root)
    const movedRun = await prepareHost(movedConfig)

    assert.equal(facadeOf(movedRun.files), facadeOf(defaultRun.files).replaceAll('@/api/ping/route', '@/server/api/ping/route'))
    assert.match(facadeOf(defaultRun.files), /from "@\/api\/ping\/route"/)
    assert.equal(read(moved.root, 'src/app/api/ping/route.ts'), facadeOf(movedRun.files))

    const docs = run => run.files.find(file => file.path === '.nextspark/registries/api-docs-registry.ts').content
    assert.match(docs(defaultRun), /['"]\/api\/ping['"]/)
    assert.match(docs(movedRun), /['"]\/api\/ping['"]/, 'the docs next to a route in the moved directory keep its URL')
    assert.match(docs(movedRun), /server\/api\/ping\/docs\.md/)

    assert.deepEqual(await checkHost(movedConfig), { ok: true, problems: [] })
    write(moved.root, 'server/api/ping/route.ts', `${ROUTE}// edited\n`)
    const stale = await checkHost(movedConfig)
    assert.equal(stale.ok, false, 'a source edited in the moved directory is stale')
    assert.ok(movedConfig.watch.dirs.includes(join(moved.root, 'server/api')), 'nextspark dev watches the moved directory')

    write(moved.root, 'src/app/foreign/page.tsx', PAGE('Foreign'))
    await assert.rejects(prepareHost(movedConfig), /to templates\/ or server\/api\/ \(route sources\)/)
    assert.match(JSON.stringify(await predictHost(movedConfig)), /to templates\/ or server\/api\/ \(route sources\)/)
  } finally {
    fallback.cleanup()
    moved.cleanup()
  }
})

test('a project without apiDir hashes the same inputs under api/', { timeout: 180_000 }, async () => {
  const { root, cleanup } = project()
  try {
    const config = { ...projectHostConfig({ projectRoot: root }), loadCoreRoutes: loadFixtureCoreRoutes }
    assert.ok(Object.keys(config.inputs({}).files).includes('api/ping/route.ts'))
    assert.deepEqual(config.watch.dirs.filter(dir => dir.endsWith('/api')), [join(root, 'api')])
  } finally {
    cleanup()
  }
})
