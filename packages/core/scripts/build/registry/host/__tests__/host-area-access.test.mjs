/**
 * Role-gated areas (#203, S21): every page, layout, template and default served under the URL of a core layout that
 * declares `access` (/superadmin, /devtools) is composed with that wrapper, whoever provides it, so each segment checks
 * the session's role on the server before it renders. A layout cannot protect its pages on its own: Next renders every
 * segment of a route separately, and a page's RSC ships even when its layout redirects.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-area-access.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { CoreRouteManifestError, loadCoreRouteManifest } from '../core-routes.mjs'
import { PLAN_NOTICES, planHost } from '../plan.mjs'
import { renderHost } from '../render.mjs'
import { validateGeneratedModule } from '../static-imports.mjs'
import { loadTypeScriptFor } from '../../shared/typescript-compiler.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const ts = await loadTypeScriptFor(CORE_ROOT)

const PAGE = 'export default function Page() { return null }\n'
const LAYOUT = 'export default function Layout({ children }) { return children }\n'
const ACCESS = ['withSuperadminAccess', 'withDevtoolsAccess', 'withSuperadminMetadata', 'withDevtoolsMetadata', 'withSuperadminRouteAccess', 'withDevtoolsRouteAccess'].map(name => `export function ${name}(S) { return S }\n`).join('')
const GUARDS = 'export function withSuperadminGuard(L) { return L }\nexport function withDevtoolsGuard(L) { return L }\n'

const CORE_FILES = {
  'superadmin/layout.tsx': LAYOUT,
  'superadmin/page.tsx': PAGE,
  'superadmin/loading.tsx': PAGE,
  'superadmin/docs/[section]/page.tsx': `${PAGE}export async function generateStaticParams() { return [] }\nexport async function generateMetadata() { return { title: 'Doc title' } }\nexport const dynamicParams = false\n`,
  'devtools/layout.tsx': LAYOUT,
  'devtools/api/layout.tsx': LAYOUT,
  'dashboard/page.tsx': PAGE,
  'superadmin-guide/page.tsx': PAGE,
}

/** A fake core (manifest entries + modules) and a throwaway project under one temporary directory. */
function world(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-area-access-'))
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  write('core/_internal/area-access.tsx', ACCESS)
  write('core/_internal/superadmin-layout.tsx', GUARDS)
  write('core/_internal/devtools-layout.tsx', GUARDS)
  for (const [path, content] of Object.entries(CORE_FILES)) write(`core/${path}`, content)
  for (const [path, content] of Object.entries(files)) write(`source/${path}`, content)
  const specifier = target => `@nextsparkjs/core/routes/${target.replace(/\.tsx$/, '')}`
  const kind = target => (/\/layout\.tsx$/.test(target) ? 'layout' : /\/loading\.tsx$/.test(target) ? 'loading' : 'page')
  const access = (name, metadata, handler) => ({ wrapper: name, metadata, handler, specifier: '@nextsparkjs/core/routes/_internal/area-access' })
  const compose = (name, file) => ({ wrapper: name, specifier: `@nextsparkjs/core/routes/_internal/${file}` })
  const entries = Object.keys(CORE_FILES).map(target => ({
    kind: kind(target),
    target,
    specifier: specifier(target),
    ...(target === 'superadmin/layout.tsx' ? { compose: compose('withSuperadminGuard', 'superadmin-layout'), access: access('withSuperadminAccess', 'withSuperadminMetadata', 'withSuperadminRouteAccess') } : {}),
    ...(target === 'devtools/layout.tsx' ? { compose: compose('withDevtoolsGuard', 'devtools-layout'), access: access('withDevtoolsAccess', 'withDevtoolsMetadata', 'withDevtoolsRouteAccess') } : {}),
  }))
  const resolveFile = spec => join(root, 'core', `${spec.slice('@nextsparkjs/core/routes/'.length)}.tsx`)
  const manifest = (extra = {}) => loadCoreRouteManifest({ coreRoot: join(root, 'core'), entries, resolveFile, isProtected: () => false, ...extra })
  return { root, source: join(root, 'source'), entries, manifest, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const render = routes => renderHost({ routes, projectRoot: CORE_ROOT })
const byTarget = (routes, target) => routes.find(route => route.target === target)
const contentOf = (result, target) => result.files.find(file => file.path === `src/app/${target}`)?.content

test('every page and layout under an area is composed with its access wrapper, and its generateMetadata too; the area layout, fallbacks and other URLs are not', async () => {
  const w = world()
  try {
    const { routes } = await w.manifest()
    const planned = planHost({ coreRoutes: routes, project: { root: w.source } })
    assert.deepEqual(planned.diagnostics, [])
    const wrapperOf = target => byTarget(planned.routes, target).access?.wrapper ?? null
    assert.equal(wrapperOf('superadmin/page.tsx'), 'withSuperadminAccess')
    assert.equal(wrapperOf('superadmin/docs/[section]/page.tsx'), 'withSuperadminAccess')
    assert.equal(wrapperOf('devtools/api/layout.tsx'), 'withDevtoolsAccess', 'a nested layout renders separately too')
    assert.equal(wrapperOf('superadmin/layout.tsx'), null, 'the area layout is checked by its own message wrapper')
    assert.equal(wrapperOf('devtools/layout.tsx'), null)
    assert.equal(wrapperOf('superadmin/loading.tsx'), null, 'a loading state renders before any check and carries no area data')
    assert.equal(wrapperOf('dashboard/page.tsx'), null)
    assert.equal(wrapperOf('superadmin-guide/page.tsx'), null, 'matched by URL segment, not by prefix')

    const result = await render(planned.routes)
    assert.deepEqual(result.diagnostics, [])
    assert.equal(
      contentOf(result, 'superadmin/docs/[section]/page.tsx'),
      [
        '// Generated by NextSpark from @nextsparkjs/core/routes/superadmin/docs/[section]/page. Do not edit: regenerated on every build.',
        'import NextSparkTemplate from "@nextsparkjs/core/routes/superadmin/docs/[section]/page"',
        'import { withSuperadminAccess } from "@nextsparkjs/core/routes/_internal/area-access"',
        'export default withSuperadminAccess(NextSparkTemplate)',
        'export { generateStaticParams } from "@nextsparkjs/core/routes/superadmin/docs/[section]/page"',
        'import { generateMetadata as NextSparkGenerateMetadata } from "@nextsparkjs/core/routes/superadmin/docs/[section]/page"',
        'import { withSuperadminMetadata } from "@nextsparkjs/core/routes/_internal/area-access"',
        'export const generateMetadata = withSuperadminMetadata(NextSparkGenerateMetadata)',
        'export const dynamicParams = false',
        '',
      ].join('\n')
    )
    assert.match(contentOf(result, 'superadmin/layout.tsx'), /^export \{ default \} from "@nextsparkjs\/core\/routes\/superadmin\/layout"$/m)
    assert.match(contentOf(result, 'superadmin/loading.tsx'), /^export \{ default \} from /m)
    for (const file of result.files.filter(file => /withSuperadminAccess|withDevtoolsAccess/.test(file.content))) {
      assert.equal(file.grammar, 'composed-facade', file.path)
      assert.deepEqual(validateGeneratedModule({ ts, source: file.content, file: file.path, grammar: 'composed-facade' }), [], file.path)
    }
  } finally {
    w.cleanup()
  }
})

test("a project's and a plugin's pages and layouts under an area are composed too, in any route group, client pages included", async () => {
  const w = world({
    'templates/superadmin/value-propositions/page.tsx': `'use client'\n${PAGE}`,
    'templates/superadmin/reports/layout.tsx': LAYOUT,
    'templates/superadmin/page.tsx': PAGE,
    'templates/(staff)/devtools/extra/page.tsx': PAGE,
    'plugins/acme/templates/superadmin/plugins/acme-settings/page.tsx': PAGE,
  })
  try {
    const { routes } = await w.manifest()
    const planned = planHost({
      coreRoutes: routes,
      project: { root: w.source },
      plugins: [{ name: 'acme', root: join(w.source, 'plugins/acme'), importBase: '@/plugins/acme', capabilities: ['web'] }],
    })
    assert.deepEqual(planned.diagnostics, [])
    const expectations = {
      'superadmin/value-propositions/page.tsx': ['project', 'withSuperadminAccess'],
      'superadmin/reports/layout.tsx': ['project', 'withSuperadminAccess'],
      'superadmin/page.tsx': ['project', 'withSuperadminAccess'],
      '(staff)/devtools/extra/page.tsx': ['project', 'withDevtoolsAccess'],
      'superadmin/plugins/acme-settings/page.tsx': ['plugin', 'withSuperadminAccess'],
    }
    for (const [target, [origin, wrapper]] of Object.entries(expectations)) {
      const route = byTarget(planned.routes, target)
      assert.equal(route?.origin, origin, target)
      assert.equal(route.access?.wrapper, wrapper, target)
    }
    const result = await render(planned.routes)
    assert.deepEqual(result.diagnostics, [])
    const client = contentOf(result, 'superadmin/value-propositions/page.tsx')
    assert.match(client, /^import NextSparkTemplate from "@\/templates\/superadmin\/value-propositions\/page"$/m)
    assert.match(client, /^export default withSuperadminAccess\(NextSparkTemplate\)$/m)
    assert.doesNotMatch(client, /use client/, 'the facade is a server module rendering the client page after the check')
  } finally {
    w.cleanup()
  }
})

test("a project override of the area layout keeps core's guard composition (whose message wrapper checks), not the access wrapper", async () => {
  const w = world({ 'templates/superadmin/layout.tsx': LAYOUT })
  try {
    const { routes } = await w.manifest()
    const planned = planHost({ coreRoutes: routes, project: { root: w.source } })
    const layout = byTarget(planned.routes, 'superadmin/layout.tsx')
    assert.equal(layout.origin, 'project')
    assert.equal(layout.compose.wrapper, 'withSuperadminGuard')
    assert.equal(layout.access, undefined)
    const result = await render(planned.routes)
    assert.deepEqual(result.diagnostics, [])
    assert.match(contentOf(result, 'superadmin/layout.tsx'), /^export default withSuperadminGuard\(NextSparkTemplate\)$/m)
  } finally {
    w.cleanup()
  }
})

test('the manifest loader: access only on layouts, resolved to a file, and never dropped by a variant', async () => {
  const w = world()
  try {
    const variants = { cacheComponents: [{ kind: 'layout', target: 'superadmin/layout.tsx', specifier: '@nextsparkjs/core/routes/superadmin/layout' }] }
    const on = await w.manifest({ cacheComponents: true, variants })
    const layout = byTarget(on.routes, 'superadmin/layout.tsx')
    assert.equal(layout.access.wrapper, 'withSuperadminAccess', 'a variant without access keeps the access of the entry it replaces')
    assert.equal(layout.access.file, join(w.root, 'core/_internal/area-access.tsx'))

    const onPage = w.entries.map(entry => (entry.target === 'superadmin/page.tsx' ? { ...entry, access: { wrapper: 'withSuperadminAccess', specifier: '@nextsparkjs/core/routes/_internal/area-access' } } : entry))
    await assert.rejects(w.manifest({ entries: onPage }), error => error instanceof CoreRouteManifestError && error.problems.some(problem => /superadmin\/page\.tsx\): only a layout can declare access/.test(problem)))
    const malformed = w.entries.map(entry => (entry.target === 'devtools/layout.tsx' ? { ...entry, access: { wrapper: 'with Access', metadata: 'a b', handler: 7, specifier: '../x', extra: 1 } } : entry))
    await assert.rejects(w.manifest({ entries: malformed }), error =>
      ['access.wrapper must be an identifier', 'access.metadata must be an identifier', 'access.handler must be an identifier', 'access.specifier must be a package subpath', 'access has unknown keys extra'].every(text => error.problems.some(problem => problem.includes(text)))
    )
  } finally {
    w.cleanup()
  }
})

test('an intercepting route is checked by the URL it intercepts: (.), (..), (..)(..) and (...)', async () => {
  const w = world({
    'templates/@modal/(.)superadmin/users/page.tsx': PAGE,
    'templates/dashboard/@panel/(...)devtools/config/page.tsx': PAGE,
    'templates/superadmin/@modal/(..)devtools/flows/page.tsx': PAGE,
    'templates/dashboard/x/@modal/(..)(..)superadmin/teams/page.tsx': PAGE,
    'templates/superadmin/@modal/(.)reports/page.tsx': PAGE,
    'templates/@modal/(.)dashboard/page.tsx': PAGE,
    'templates/superadmin/@modal/(..)dashboard/page.tsx': PAGE,
  })
  try {
    const { routes } = await w.manifest()
    const planned = planHost({ coreRoutes: routes, project: { root: w.source } })
    const wrapperOf = target => byTarget(planned.routes, target)?.access?.wrapper ?? null
    assert.equal(wrapperOf('@modal/(.)superadmin/users/page.tsx'), 'withSuperadminAccess')
    assert.equal(wrapperOf('dashboard/@panel/(...)devtools/config/page.tsx'), 'withDevtoolsAccess')
    assert.equal(wrapperOf('superadmin/@modal/(..)devtools/flows/page.tsx'), 'withDevtoolsAccess', '(..) leaves /superadmin for /devtools')
    assert.equal(wrapperOf('dashboard/x/@modal/(..)(..)superadmin/teams/page.tsx'), 'withSuperadminAccess')
    assert.equal(wrapperOf('superadmin/@modal/(.)reports/page.tsx'), 'withSuperadminAccess')
    assert.equal(wrapperOf('@modal/(.)dashboard/page.tsx'), null)
    assert.equal(wrapperOf('superadmin/@modal/(..)dashboard/page.tsx'), null, 'it intercepts /dashboard, outside the area')
    const result = await render(planned.routes)
    assert.deepEqual(result.diagnostics, [])
    assert.match(contentOf(result, '@modal/(.)superadmin/users/page.tsx'), /^export default withSuperadminAccess\(NextSparkTemplate\)$/m)
  } finally {
    w.cleanup()
  }
})

test("a Route Handler under an area has every method but OPTIONS composed with the area's handler check", async () => {
  const w = world({
    'templates/devtools/export/route.ts':
      'export async function GET() { return Response.json({}) }\nexport async function POST() { return Response.json({}) }\n' +
      'export async function OPTIONS() { return new Response(null) }\nexport const dynamic = "force-dynamic"\n',
    'templates/(staff)/superadmin/report/route.ts': 'export async function GET() { return Response.json({}) }\n',
    'templates/dashboard/export/route.ts': 'export async function GET() { return Response.json({}) }\n',
  })
  try {
    const { routes } = await w.manifest()
    const planned = planHost({ coreRoutes: routes, project: { root: w.source } })
    assert.deepEqual(planned.diagnostics, [])
    assert.equal(byTarget(planned.routes, 'dashboard/export/route.ts').access, undefined)
    const result = await render(planned.routes)
    assert.deepEqual(result.diagnostics, [])
    assert.equal(
      contentOf(result, 'devtools/export/route.ts'),
      [
        '// Generated by NextSpark from @/templates/devtools/export/route. Do not edit: regenerated on every build.',
        'export { OPTIONS } from "@/templates/devtools/export/route"',
        'import { GET as NextSparkGET, POST as NextSparkPOST } from "@/templates/devtools/export/route"',
        'import { withDevtoolsRouteAccess } from "@nextsparkjs/core/routes/_internal/area-access"',
        'export const GET = withDevtoolsRouteAccess(NextSparkGET)',
        'export const POST = withDevtoolsRouteAccess(NextSparkPOST)',
        'export const dynamic = "force-dynamic"',
        '',
      ].join('\n')
    )
    assert.match(contentOf(result, '(staff)/superadmin/report/route.ts'), /^export const GET = withSuperadminRouteAccess\(NextSparkGET\)$/m)
    assert.match(contentOf(result, 'dashboard/export/route.ts'), /^export \{ GET \} from /m)
    for (const target of ['devtools/export/route.ts', '(staff)/superadmin/report/route.ts']) {
      const file = result.files.find(candidate => candidate.path === `src/app/${target}`)
      assert.equal(file.grammar, 'composed-facade', target)
      assert.deepEqual(validateGeneratedModule({ ts, source: file.content, file: target, grammar: 'composed-facade' }), [], target)
    }
  } finally {
    w.cleanup()
  }
})

test('a metadata file under an area cannot be guarded: a warning notice names it, and it stays a plain facade', async () => {
  const w = world({
    'templates/superadmin/reports/opengraph-image.tsx': 'export default function Image() { return null }\n',
    'templates/devtools/icon.tsx': 'export default function Icon() { return null }\n',
    'templates/opengraph-image.tsx': 'export default function Image() { return null }\n',
  })
  try {
    const { routes } = await w.manifest()
    const planned = planHost({ coreRoutes: routes, project: { root: w.source } })
    const unguarded = planned.notices.filter(notice => notice.code === PLAN_NOTICES.AREA_FILE_UNGUARDED)
    assert.deepEqual(unguarded.map(notice => notice.target).sort(), ['devtools/icon.tsx', 'superadmin/reports/opengraph-image.tsx'])
    assert.match(unguarded.find(notice => notice.target === 'devtools/icon.tsx').message, /templates\/devtools\/icon\.tsx is a metadata file under \/devtools/)
    assert.equal(byTarget(planned.routes, 'devtools/icon.tsx').access, undefined)
  } finally {
    w.cleanup()
  }
})
