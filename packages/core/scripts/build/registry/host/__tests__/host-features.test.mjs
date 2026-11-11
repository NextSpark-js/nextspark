/**
 * The `features` flags of nextspark.config.ts in the generated host (#425): a flag set to false leaves its core routes
 * out of the plan (and so of `prepare --check`, which plans the same way), out of the API route list of the
 * registries, and the generated `features` registry carries it to the UI.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-features.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { planHost } from '../plan.mjs'
import { FEATURE_DIAGNOSTICS, featureConfigDiagnostics, omittingFeature } from '../features.mjs'
import { generateFeatures } from '../../generators/features.mjs'
import { missingProxyAreas } from '../proxy-areas.mjs'
import { discoverCoreRoutes } from '../../discovery/core-routes.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const MANIFEST = JSON.parse(readFileSync(join(CORE_ROOT, 'src/routes/manifest.json'), 'utf8'))
const PAGE = 'export default function Page() { return null }\n'

const core = route => ({ ...route, file: `/core/${route.target}`, protected: false })
const targets = planned => planned.routes.map(route => route.target)

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-host-features-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const BILLING_OFF = [
  'api/cron/billing/lifecycle/route.ts',
  'api/v1/billing/cancel/route.ts',
  'api/v1/billing/change-plan/route.ts',
  'api/v1/billing/checkout/route.ts',
  'api/v1/billing/portal/route.ts',
  'api/v1/billing/webhooks/lemonsqueezy/route.ts',
  'api/v1/billing/webhooks/paddle/route.ts',
  'api/v1/billing/webhooks/polar/route.ts',
  'api/v1/billing/webhooks/stripe/route.ts',
  'api/v1/teams/[teamId]/invoices/[invoiceNumber]/route.ts',
  'api/v1/teams/[teamId]/invoices/route.ts',
  'dashboard/settings/billing/loading.tsx',
  'dashboard/settings/billing/page.tsx',
  'dashboard/settings/invoices/[invoiceNumber]/page.tsx',
  'dashboard/settings/invoices/loading.tsx',
  'dashboard/settings/invoices/page.tsx',
  'dashboard/settings/plans/loading.tsx',
  'dashboard/settings/plans/page.tsx',
]

test('features.billing: false leaves out the payment routes and pages of the manifest, and keeps what plans as tiers read', () => {
  const omitted = MANIFEST.filter(route => omittingFeature(route.target, { billing: false })).map(route => route.target).sort()
  assert.deepEqual(omitted, BILLING_OFF)
  for (const kept of ['api/v1/billing/plans/route.ts', 'api/v1/billing/check-action/route.ts', 'api/v1/teams/[teamId]/subscription/route.ts', 'api/v1/teams/[teamId]/usage/[limitSlug]/route.ts', 'superadmin/subscriptions/page.tsx', 'api/superadmin/subscriptions/route.ts']) {
    assert.ok(MANIFEST.some(route => route.target === kept), kept)
    assert.equal(omittingFeature(kept, { billing: false }), null, kept)
  }
  // true, or not set: nothing is left out
  assert.equal(MANIFEST.filter(route => omittingFeature(route.target, { billing: true }) || omittingFeature(route.target, {})).length, 0)
})

test('the plan has no billing route with the flag off, and the same routes as before with it on or unset', () => {
  const coreRoutes = MANIFEST.filter(route => route.kind === 'page' || route.kind === 'route' || route.kind === 'loading').map(core)
  const { root, cleanup } = project({})
  try {
    const on = planHost({ coreRoutes, project: { root }, features: { billing: true } })
    const unset = planHost({ coreRoutes, project: { root } })
    const off = planHost({ coreRoutes, project: { root }, features: { billing: false } })
    assert.deepEqual(off.diagnostics, [])
    assert.deepEqual(targets(on), targets(unset))
    assert.deepEqual(targets(on).filter(target => !targets(off).includes(target)), BILLING_OFF)
  } finally {
    cleanup()
  }
})

test('a project page at a path billing left out is the project\'s own route', () => {
  const { root, cleanup } = project({ 'templates/dashboard/settings/billing/page.tsx': PAGE })
  try {
    const coreRoutes = MANIFEST.filter(route => route.target.startsWith('dashboard/settings/billing/')).map(core)
    const planned = planHost({ coreRoutes, project: { root }, features: { billing: false } })
    assert.deepEqual(planned.diagnostics, [])
    assert.deepEqual(planned.routes.map(route => `${route.target} <- ${route.origin}`), ['dashboard/settings/billing/page.tsx <- project'])
  } finally {
    cleanup()
  }
})

test('billing.webhookExtensions with features.billing: false stops prepare, naming both settings', () => {
  assert.deepEqual(featureConfigDiagnostics({ features: { billing: true }, billing: { webhookExtensions: { stripe: './x' } } }), [])
  assert.deepEqual(featureConfigDiagnostics({ features: { billing: false } }), [])
  const [diagnostic, ...rest] = featureConfigDiagnostics({ features: { billing: false }, billing: { webhookExtensions: { stripe: './x', polar: './y' } } })
  assert.equal(rest.length, 0)
  assert.equal(diagnostic.code, FEATURE_DIAGNOSTICS.BILLING_WEBHOOK_EXTENSIONS)
  assert.match(diagnostic.message, /features\.billing to false/)
  assert.match(diagnostic.message, /billing\.webhookExtensions .*\(stripe, polar\)/)
})

test('the API route list of the registries leaves out the routes of a flag that is off', async () => {
  const on = (await discoverCoreRoutes({ coreDir: CORE_ROOT, features: { billing: true } })).map(route => route.path)
  const off = (await discoverCoreRoutes({ coreDir: CORE_ROOT, features: { billing: false } })).map(route => route.path)
  assert.ok(on.includes('/api/v1/billing/checkout'))
  assert.deepEqual(on.filter(path => !off.includes(path)).sort(), ['/api/v1/billing/cancel', '/api/v1/billing/change-plan', '/api/v1/billing/checkout', '/api/v1/billing/portal', '/api/v1/billing/webhooks/lemonsqueezy', '/api/v1/billing/webhooks/paddle', '/api/v1/billing/webhooks/polar', '/api/v1/billing/webhooks/stripe'])
  assert.ok(off.includes('/api/v1/billing/check-action'))
})

test('the features registry carries the flags, every one true unless set to false', () => {
  assert.match(generateFeatures({ billing: false }), /export const FEATURES: \{ readonly billing: boolean; readonly superadmin: boolean \} = \{"billing":false,"superadmin":true\}/)
  assert.match(generateFeatures({ superadmin: false }), /= \{"billing":true,"superadmin":false\}/)
  assert.match(generateFeatures({}), /= \{"billing":true,"superadmin":true\}/)
  assert.match(generateFeatures(), /= \{"billing":true,"superadmin":true\}/)
})

test('features.superadmin: false leaves out the /superadmin area and /api/superadmin, and nothing else', () => {
  const omitted = MANIFEST.filter(route => omittingFeature(route.target, { superadmin: false })).map(route => route.target)
  assert.ok(omitted.includes('superadmin/layout.tsx'))
  assert.ok(omitted.includes('superadmin/docs/[section]/[page]/page.tsx'))
  assert.ok(omitted.includes('api/superadmin/users/route.ts'))
  assert.deepEqual(omitted.filter(target => !/^(api\/)?superadmin\//.test(target)), [])
  assert.deepEqual(MANIFEST.filter(route => /^(api\/)?superadmin\//.test(route.target)).map(route => route.target).sort(), omitted.sort())
  assert.ok(MANIFEST.some(route => route.target.startsWith('devtools/')), 'devtools is a manifest area')
  assert.equal(MANIFEST.filter(route => route.target.startsWith('devtools/') && omittingFeature(route.target, { superadmin: false })).length, 0)
})

test('with the superadmin area off, a project or plugin route under /superadmin stops the plan instead of being served without the role check', () => {
  const { root, cleanup } = project({
    'templates/superadmin/reports/page.tsx': PAGE,
    'templates/dashboard/reports/page.tsx': PAGE,
    'api/superadmin-stats/route.ts': 'export async function GET() { return Response.json({}) }\n',
    'plugins/audit/templates/superadmin/audit/page.tsx': PAGE,
  })
  try {
    const coreRoutes = MANIFEST.filter(route => /^(superadmin|devtools)\//.test(route.target) || route.target === 'layout.tsx').map(core)
    const plugins = [{ name: 'audit', root: join(root, 'plugins/audit'), importBase: '@/plugins/audit' }]
    const on = planHost({ coreRoutes, project: { root }, plugins, features: { superadmin: true } })
    assert.deepEqual(on.diagnostics, [])
    assert.equal(on.routes.find(route => route.target === 'superadmin/reports/page.tsx').access.wrapper, 'withSuperadminAccess')

    const off = planHost({ coreRoutes, project: { root }, plugins, features: { superadmin: false } })
    assert.deepEqual(off.diagnostics.map(diagnostic => `${diagnostic.code} ${diagnostic.target}`).sort(), [
      `${FEATURE_DIAGNOSTICS.AREA_OFF} superadmin/audit/page.tsx`,
      `${FEATURE_DIAGNOSTICS.AREA_OFF} superadmin/reports/page.tsx`,
    ])
    assert.match(off.diagnostics[0].message, /is under \/superadmin, but nextspark\.config\.ts sets features\.superadmin to false.*served to anyone/)
    // devtools keeps its layout and its role check
    assert.ok(off.routes.some(route => route.target === 'devtools/layout.tsx' && route.origin === 'core'))
    assert.ok(off.routes.filter(route => route.target.startsWith('devtools/') && route.kind === 'page').every(route => route.access?.wrapper === 'withDevtoolsAccess'))
  } finally {
    cleanup()
  }
})

test('the proxy notice does not ask for /superadmin when the area is off', () => {
  const source = "export function proxy(request) { if (request.nextUrl.pathname.startsWith('/dashboard')) return null }\n"
  assert.deepEqual(missingProxyAreas(source).map(area => area.path), ['/superadmin', '/devtools'])
  assert.deepEqual(missingProxyAreas(source, { superadmin: false }).map(area => area.path), ['/devtools'])
})
