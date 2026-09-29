import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { CoreRouteManifestError, loadCoreRouteManifest, loadProtectedTargets } from '../core-routes.mjs'
import { HostPlanError, PLAN_DIAGNOSTICS, planHost, resolveHostPlan } from '../plan.mjs'

const PAGE = 'export default function Page() { return null }\n'
const ROUTE = 'export async function GET() { return Response.json({}) }\n'

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-host-plan-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const core = (target, kind = 'page', extra = {}) => ({ kind, target, specifier: `@nextsparkjs/core/routes/${target.replace(/\.tsx?$/, '')}`, file: `/core/${target}`, protected: false, ...extra })

const summary = routes => routes.map(route => `${route.target} <- ${route.origin}:${route.specifier}${route.overrides ? ` (overrides ${route.overrides})` : ''}`)

test('core < plugin < project: a higher layer replaces a lower one at the same route file', () => {
  const { root, cleanup } = project({
    'templates/about/page.tsx': PAGE,
    'templates/pricing/page.tsx': PAGE,
    'api/notes/route.ts': ROUTE,
    'plugins/blog/templates/about/page.tsx': PAGE,
    'plugins/blog/templates/blog/page.tsx': PAGE,
    'plugins/blog/api/posts/route.ts': ROUTE,
  })
  try {
    const routes = resolveHostPlan({
      coreRoutes: [core('layout.tsx', 'layout'), core('about/page.tsx'), core('blog/page.tsx'), core('page.tsx')],
      plugins: [{ name: 'blog', root: join(root, 'plugins/blog'), importBase: '@/plugins/blog' }],
      project: { root },
    })
    assert.deepEqual(summary(routes), [
      'about/page.tsx <- project:@/templates/about/page (overrides plugins/blog/templates/about/page.tsx)',
      'api/notes/route.ts <- project:@/api/notes/route',
      'api/plugins/blog/posts/route.ts <- plugin:@/plugins/blog/api/posts/route',
      'blog/page.tsx <- plugin:@/plugins/blog/templates/blog/page (overrides core route @nextsparkjs/core/routes/blog/page)',
      'layout.tsx <- core:@nextsparkjs/core/routes/layout',
      'page.tsx <- core:@nextsparkjs/core/routes/page',
      'pricing/page.tsx <- project:@/templates/pricing/page',
    ])
    assert.equal(routes.find(route => route.target === 'about/page.tsx').file, join(root, 'templates/about/page.tsx'))
  } finally {
    cleanup()
  }
})

test('the extension does not decide the slot: templates/about/page.ts replaces core about/page.tsx', () => {
  const { root, cleanup } = project({ 'templates/about/page.ts': PAGE })
  try {
    const routes = resolveHostPlan({ coreRoutes: [core('about/page.tsx')], project: { root } })
    assert.deepEqual(summary(routes), ['about/page.ts <- project:@/templates/about/page (overrides core route @nextsparkjs/core/routes/about/page)'])
  } finally {
    cleanup()
  }
})

test('two project files for one route are a collision naming both sources', () => {
  const { root, cleanup } = project({ 'templates/api/notes/route.ts': ROUTE, 'api/notes/route.ts': ROUTE, 'templates/x/page.tsx': PAGE, 'templates/x/page.ts': PAGE })
  try {
    const { diagnostics } = planHost({ coreRoutes: [], project: { root } })
    assert.deepEqual(diagnostics.map(d => [d.code, d.sources]), [
      [PLAN_DIAGNOSTICS.COLLISION, ['api/notes/route.ts', 'templates/api/notes/route.ts']],
      [PLAN_DIAGNOSTICS.COLLISION, ['templates/x/page.ts', 'templates/x/page.tsx']],
    ])
    assert.match(diagnostics[0].message, /src\/app\/api\/notes\/route\.ts: two project files provide this route: api\/notes\/route\.ts and templates\/api\/notes\/route\.ts/)
    assert.throws(() => resolveHostPlan({ coreRoutes: [], project: { root } }), HostPlanError)
  } finally {
    cleanup()
  }
})

test('two plugins providing one route collide, naming both plugins', () => {
  const { root, cleanup } = project({ 'plugins/a/templates/shop/page.tsx': PAGE, 'plugins/b/templates/shop/page.tsx': PAGE })
  try {
    const plugins = ['b', 'a'].map(name => ({ name, root: join(root, 'plugins', name), importBase: `@/plugins/${name}` }))
    const { diagnostics } = planHost({ coreRoutes: [core('shop/page.tsx')], plugins, project: { root: join(root, 'none') } })
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].code, PLAN_DIAGNOSTICS.COLLISION)
    assert.deepEqual(diagnostics[0].sources, ['plugins/a/templates/shop/page.tsx', 'plugins/b/templates/shop/page.tsx'])
    assert.match(diagnostics[0].message, /two plugins provide this route: plugins\/a\/templates\/shop\/page\.tsx and plugins\/b\/templates\/shop\/page\.tsx/)
  } finally {
    cleanup()
  }
})

test('a plugin or project file over a protected core route is refused, naming both', () => {
  const { root, cleanup } = project({ 'plugins/a/templates/dashboard/layout.tsx': PAGE, 'templates/dashboard/layout.tsx': PAGE })
  try {
    const { routes, diagnostics } = planHost({
      coreRoutes: [core('dashboard/layout.tsx', 'layout', { protected: true })],
      plugins: [{ name: 'a', root: join(root, 'plugins/a'), importBase: '@/plugins/a' }],
      project: { root },
    })
    assert.deepEqual(diagnostics.map(d => [d.code, d.sources]), [
      [PLAN_DIAGNOSTICS.PROTECTED, ['core route @nextsparkjs/core/routes/dashboard/layout', 'templates/dashboard/layout.tsx']],
      [PLAN_DIAGNOSTICS.PROTECTED, ['core route @nextsparkjs/core/routes/dashboard/layout', 'plugins/a/templates/dashboard/layout.tsx']],
    ])
    assert.match(diagnostics[1].message, /plugins\/a\/templates\/dashboard\/layout\.tsx would replace the protected core route @nextsparkjs\/core\/routes\/dashboard\/layout/)
    assert.equal(routes[0].origin, 'core')
  } finally {
    cleanup()
  }
})

test('a page and a Route Handler left in one directory conflict', () => {
  const { root, cleanup } = project({ 'templates/feed/route.ts': ROUTE })
  try {
    const { diagnostics } = planHost({ coreRoutes: [core('feed/page.tsx')], project: { root } })
    assert.deepEqual(diagnostics.map(d => d.code), [PLAN_DIAGNOSTICS.PAGE_ROUTE_CONFLICT])
    assert.deepEqual(diagnostics[0].sources, ['core route @nextsparkjs/core/routes/feed/page', 'templates/feed/route.ts'])
  } finally {
    cleanup()
  }
})

test('only route files are planned: components, tests, dotfiles and node_modules are ignored', () => {
  const { root, cleanup } = project({
    'templates/blog/page.tsx': PAGE,
    'templates/blog/components/Card.tsx': PAGE,
    'templates/blog/page.test.tsx': PAGE,
    'templates/blog/page.meta.ts': 'export const x = 1\n',
    'templates/.hidden/page.tsx': PAGE,
    'templates/node_modules/x/page.tsx': PAGE,
    'templates/blog/opengraph-image2.tsx': PAGE,
  })
  try {
    assert.deepEqual(resolveHostPlan({ coreRoutes: [], project: { root } }).map(route => `${route.kind}:${route.target}`), ['opengraph-image:blog/opengraph-image2.tsx', 'page:blog/page.tsx'])
  } finally {
    cleanup()
  }
})

test('cache-mode suffixes are separate slots only for a host that declares the modes', () => {
  const { root, cleanup } = project({ 'templates/isr/page.isr.tsx': PAGE, 'templates/cached/page.cc.tsx': PAGE })
  try {
    assert.deepEqual(resolveHostPlan({ coreRoutes: [], project: { root } }), [])
    assert.deepEqual(resolveHostPlan({ coreRoutes: [], project: { root }, modes: ['isr', 'cc'] }).map(route => [route.target, route.mode]), [
      ['cached/page.cc.tsx', 'cc'],
      ['isr/page.isr.tsx', 'isr'],
    ])
  } finally {
    cleanup()
  }
})

test('a symlinked route source is reported, not followed', () => {
  const { root, cleanup } = project({ 'elsewhere/page.tsx': PAGE })
  try {
    mkdirSync(join(root, 'templates/linked'), { recursive: true })
    symlinkSync(join(root, 'elsewhere/page.tsx'), join(root, 'templates/linked/page.tsx'))
    const { routes, diagnostics } = planHost({ coreRoutes: [], project: { root } })
    assert.deepEqual(routes, [])
    assert.deepEqual(diagnostics.map(d => d.code), [PLAN_DIAGNOSTICS.SOURCE_SYMLINK])
  } finally {
    cleanup()
  }
})

test('the plan is deterministic: input order does not change it', () => {
  const { root, cleanup } = project({ 'templates/b/page.tsx': PAGE, 'templates/a/page.tsx': PAGE, 'plugins/z/api/x/route.ts': ROUTE, 'plugins/y/api/x/route.ts': ROUTE })
  try {
    const plugins = ['z', 'y'].map(name => ({ name, root: join(root, 'plugins', name), importBase: `@/plugins/${name}` }))
    const coreRoutes = [core('b/page.tsx'), core('layout.tsx', 'layout'), core('Z/page.tsx')]
    const one = resolveHostPlan({ coreRoutes, plugins, project: { root } })
    const two = resolveHostPlan({ coreRoutes: [...coreRoutes].reverse(), plugins: [...plugins].reverse(), project: { root } })
    assert.deepEqual(one, two)
    // Code-unit order (uppercase first), not locale order
    assert.deepEqual(one.map(route => route.target), ['Z/page.tsx', 'a/page.tsx', 'api/plugins/y/x/route.ts', 'api/plugins/z/x/route.ts', 'b/page.tsx', 'layout.tsx'])
  } finally {
    cleanup()
  }
})

test('loadCoreRouteManifest: null without a manifest; entries validated; files resolved; protection applied', async () => {
  const { root, cleanup } = project({
    'src/routes/manifest.json': JSON.stringify([
      { kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout' },
      { kind: 'page', target: 'dashboard/page.tsx', specifier: '@nextsparkjs/core/routes/dashboard/page', protected: true },
    ]),
    'src/routes/layout.tsx': PAGE,
    'dist/routes/dashboard/page.js': PAGE,
    'package.json': JSON.stringify({ name: '@nextsparkjs/core', exports: { './routes/*': { types: './dist/routes/*.d.ts', import: './dist/routes/*.js' } } }),
  })
  try {
    assert.equal(await loadCoreRouteManifest({ coreRoot: join(root, 'missing') }), null)
    const manifest = await loadCoreRouteManifest({ coreRoot: root })
    assert.match(manifest.hash, /^[0-9a-f]{64}$/)
    assert.deepEqual(manifest.routes.map(route => [route.target, route.file.slice(root.length), route.protected]), [
      ['layout.tsx', '/src/routes/layout.tsx', false],
      ['dashboard/page.tsx', '/dist/routes/dashboard/page.js', true],
    ])
    await assert.rejects(loadCoreRouteManifest({ coreRoot: root, entries: [{ kind: 'pagee', target: '../x', specifier: '' }] }), error => {
      assert.ok(error instanceof CoreRouteManifestError)
      assert.equal(error.problems.length, 3)
      return true
    })
    await assert.rejects(loadCoreRouteManifest({ coreRoot: root, entries: [{ kind: 'page', target: 'x/page.tsx', specifier: '@nextsparkjs/core/routes/nowhere' }] }), /no module found for @nextsparkjs\/core\/routes\/nowhere/)
  } finally {
    cleanup()
  }
})

test("core's PROTECTED_PATHS are protected targets (any protection level)", async () => {
  const coreRoot = join(import.meta.dirname, '../../../../..')
  const isProtected = await loadProtectedTargets(coreRoot)
  assert.equal(isProtected('dashboard/layout.tsx'), true)
  assert.equal(isProtected('layout.tsx'), true)
  assert.equal(isProtected('about/page.tsx'), false)
})

test('core route variants: variants.json replaces entries by target only when the host has cacheComponents on', async () => {
  const { root, cleanup } = project({
    'src/routes/manifest.json': JSON.stringify([
      { kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout' },
      { kind: 'page', target: 'page.tsx', specifier: '@nextsparkjs/core/routes/page' },
    ]),
    'src/routes/variants.json': JSON.stringify({ cacheComponents: [{ kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout.ppr' }] }),
    'src/routes/layout.tsx': PAGE,
    'src/routes/layout.ppr.tsx': PAGE,
    'src/routes/page.tsx': PAGE,
  })
  try {
    const specifiers = manifest => manifest.routes.map(route => `${route.target}=${route.specifier}`)
    const off = await loadCoreRouteManifest({ coreRoot: root, cacheComponents: false })
    const unknown = await loadCoreRouteManifest({ coreRoot: root })
    const on = await loadCoreRouteManifest({ coreRoot: root, cacheComponents: true })
    assert.deepEqual(specifiers(off), ['layout.tsx=@nextsparkjs/core/routes/layout', 'page.tsx=@nextsparkjs/core/routes/page'])
    assert.deepEqual(specifiers(unknown), specifiers(off))
    assert.deepEqual(specifiers(on), ['layout.tsx=@nextsparkjs/core/routes/layout.ppr', 'page.tsx=@nextsparkjs/core/routes/page'])
    assert.equal(on.routes[0].file, join(root, 'src/routes/layout.ppr.tsx'))
    assert.deepEqual(on.variantsApplied, ['layout.tsx'])
    assert.notEqual(on.hash, off.hash, 'the setting is part of the input hash')

    for (const [variants, expected] of [
      [{ cacheComponents: [{ kind: 'page', target: 'nowhere/page.tsx', specifier: '@nextsparkjs/core/routes/x' }] }, /replaces no manifest entry/],
      [{ cacheComponents: [{ kind: 'page', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/x' }] }, /kind page differs from the manifest's layout/],
      [{ turbo: [] }, /unknown setting "turbo"/],
    ]) {
      await assert.rejects(loadCoreRouteManifest({ coreRoot: root, variants, cacheComponents: false }), expected)
    }
  } finally {
    cleanup()
  }
})

test("readCacheComponents reads only a literal next.config setting", async () => {
  const { readCacheComponents } = await import('../prepare.mjs')
  const cases = [
    [{}, undefined],
    [{ 'next.config.ts': 'export default { cacheComponents: true }\n' }, true],
    [{ 'next.config.mjs': 'const c = {\n  // cacheComponents: true,\n  cacheComponents: false,\n}\nexport default c\n' }, false],
    [{ 'next.config.js': 'module.exports = { cacheComponents: process.env.CC === "1" }\n' }, undefined],
    [{ 'next.config.ts': 'export default { cacheComponents: flag }\n' }, undefined],
    [{ 'next.config.ts': 'export default a ? { cacheComponents: true } : { cacheComponents: false }\n' }, undefined],
  ]
  for (const [files, expected] of cases) {
    const { root, cleanup } = project(files)
    try {
      assert.equal(readCacheComponents(root), expected, JSON.stringify(files))
    } finally {
      cleanup()
    }
  }
})
