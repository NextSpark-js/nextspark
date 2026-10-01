import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { checkBudget, measureRoutes, routeKeyFor, validateBudget } from './starter-route-js.mjs'

const SCRIPT = fileURLToPath(new URL('./starter-route-js.mjs', import.meta.url))
const BUDGET = JSON.parse(readFileSync(new URL('./starter-route-js-budget.json', import.meta.url), 'utf8'))

/** A build output with the files Next.js writes that the verifier reads. */
function build({ routes, chunks, rootMainFiles = ['static/chunks/main.js'] }) {
  const app = mkdtempSync(path.join(tmpdir(), 'starter-route-js-'))
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(app, '.next', file)), { recursive: true })
    writeFileSync(path.join(app, '.next', file), content)
  }
  write('build-manifest.json', JSON.stringify({ rootMainFiles, polyfillFiles: ['static/chunks/polyfill.js'] }))
  write('app-path-routes-manifest.json', JSON.stringify(Object.fromEntries(Object.entries(routes).map(([key, { url }]) => [key, url]))))
  for (const [key, { entries }] of Object.entries(routes)) {
    const manifest = { moduleLoading: {}, clientModules: {}, entryJSFiles: entries }
    write(`server/app${key}_client-reference-manifest.js`, `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(key)}]=${JSON.stringify(manifest)}`)
  }
  for (const [file, content] of Object.entries(chunks)) write(file, content)
  return { app, cleanup: () => rmSync(app, { recursive: true, force: true }) }
}

const gz = text => gzipSync(Buffer.from(text)).length

test('a route is its root main files plus the chunks of its layouts and page, without the source map comment', () => {
  const main = 'console.log("main")'
  const layout = 'export const layout = 1'
  const page = 'export const page = "support"'
  const { app, cleanup } = build({
    routes: { '/(public)/support/page': { url: '/support', entries: { '[project]/src/app/layout': ['static/chunks/layout.js'], '[project]/src/app/(public)/support/page': ['static/chunks/layout.js', 'static/chunks/page.js'] } } },
    chunks: { 'static/chunks/main.js': main, 'static/chunks/layout.js': `${layout}\n//# sourceMappingURL=layout.js.map`, 'static/chunks/page.js': page, 'static/chunks/polyfill.js': 'x'.repeat(5000) },
  })
  try {
    const measured = measureRoutes({ app, routes: ['/support'], markers: ['support', 'superadmin-sidebar'] })
    assert.deepEqual(measured['/support'], {
      files: 3,
      rawBytes: Buffer.byteLength(main + layout + page),
      gzipBytes: gz(main) + gz(layout) + gz(page),
      markers: ['support'],
    })
  } finally {
    cleanup()
  }
})

test('a URL without a route of its own is measured on the dynamic route that serves it, the most specific first', () => {
  const routes = {
    '/(public)/page': '/',
    '/(public)/[...slug]/page': '/[...slug]',
    '/dashboard/(main)/[entity]/page': '/dashboard/[entity]',
    '/dashboard/(main)/tasks/page': '/dashboard/tasks',
    '/dashboard/(main)/[entity]/[id]/page': '/dashboard/[entity]/[id]',
    '/(public)/docs/[[...path]]/page': '/docs/[[...path]]',
    '/api/health/route': '/api/health',
  }
  assert.equal(routeKeyFor(routes, '/'), '/(public)/page')
  assert.equal(routeKeyFor(routes, '/blog'), '/(public)/[...slug]/page')
  assert.equal(routeKeyFor(routes, '/blog/a/b'), '/(public)/[...slug]/page')
  assert.equal(routeKeyFor(routes, '/dashboard/tasks'), '/dashboard/(main)/tasks/page')
  assert.equal(routeKeyFor(routes, '/dashboard/posts'), '/dashboard/(main)/[entity]/page')
  assert.equal(routeKeyFor(routes, '/dashboard/posts/1'), '/dashboard/(main)/[entity]/[id]/page')
  assert.equal(routeKeyFor(routes, '/docs'), '/(public)/docs/[[...path]]/page')
  assert.equal(routeKeyFor(routes, '/api/health'), '/(public)/[...slug]/page', 'only pages are routes with JavaScript')
  assert.equal(routeKeyFor({ '/(public)/page': '/' }, '/missing'), null)
})

test('the check fails a route over its budget and a signed-out route that carries a dashboard-only marker', () => {
  const budget = { routes: { '/support': { maxGzipBytes: 100, public: true }, '/dashboard': { maxGzipBytes: 100, public: false }, '/login': { maxGzipBytes: 100, public: true } } }
  assert.deepEqual(checkBudget(budget, {
    '/support': { files: 2, rawBytes: 300, gzipBytes: 100, markers: [] },
    '/dashboard': { files: 2, rawBytes: 300, gzipBytes: 90, markers: ['superadmin-sidebar'] },
    '/login': { files: 2, rawBytes: 300, gzipBytes: 101, markers: ['superadmin-sidebar'] },
  }), [
    '/login: 101 gzip bytes of JavaScript, over the budget of 100 (+1)',
    '/login: a signed-out route loads dashboard-only code ("superadmin-sidebar" is in its chunks)',
  ])
  assert.deepEqual(checkBudget(budget, {}), ['/support: not measured', '/dashboard: not measured', '/login: not measured'])
})

test('the tracked budget is valid and covers public, auth and dashboard routes', () => {
  assert.deepEqual(validateBudget(BUDGET), [])
  const routes = Object.entries(BUDGET.routes)
  for (const url of ['/', '/support', '/login', '/signup', '/dashboard', '/dashboard/tasks']) assert.ok(BUDGET.routes[url], url)
  for (const [url, rule] of routes) {
    assert.equal(rule.public, !url.startsWith('/dashboard'), url)
    // The ceiling is the 0.1.0-beta.191 reference plus a small tolerance, never more than 2%
    assert.ok(rule.maxGzipBytes >= rule.reference191GzipBytes && rule.maxGzipBytes <= Math.ceil(rule.reference191GzipBytes * 1.02), url)
  }
  assert.deepEqual(validateBudget({ kind: 'x', schemaVersion: 1, dashboardOnlyMarkers: ['ab'], routes: { support: { maxGzipBytes: 0 } } }), [
    'kind must be "starter-route-js-budget" and schemaVersion 1',
    'dashboardOnlyMarkers must be an array of strings of 6 characters or more',
    'support: a route is a pathname',
    'support: maxGzipBytes must be a positive integer',
    'support: public must be a boolean',
  ])
})

test('the command exits 0 within budget, 1 over it and 2 without a build', () => {
  const { app, cleanup } = build({
    routes: { '/(public)/page': { url: '/', entries: { '[project]/src/app/layout': ['static/chunks/a.js'] } } },
    chunks: { 'static/chunks/main.js': 'm', 'static/chunks/a.js': 'a'.repeat(2000) },
  })
  const budgetFile = path.join(app, 'budget.json')
  const run = maxGzipBytes => {
    writeFileSync(budgetFile, JSON.stringify({ kind: 'starter-route-js-budget', schemaVersion: 1, dashboardOnlyMarkers: [], routes: { '/': { maxGzipBytes, public: true } } }))
    return spawnSync(process.execPath, [SCRIPT, '--app', app, '--budget', budgetFile], { encoding: 'utf8' })
  }
  try {
    assert.equal(run(10_000).status, 0)
    const over = run(10)
    assert.equal(over.status, 1)
    assert.match(over.stderr, /\/: \d+ gzip bytes of JavaScript, over the budget of 10/)
    assert.equal(spawnSync(process.execPath, [SCRIPT, '--app', path.join(app, 'nowhere'), '--budget', budgetFile], { encoding: 'utf8' }).status, 2)
    assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2)
  } finally {
    cleanup()
  }
})

test('every dashboard-only marker is still in core\'s source, so a rename cannot silently turn its check off', () => {
  const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url))
  const files = readdirSync(coreSrc, { recursive: true }).filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
  const sources = files.map(file => readFileSync(path.join(coreSrc, file), 'utf8'))
  const missing = BUDGET.dashboardOnlyMarkers.filter(marker => !sources.some(source => source.includes(marker)))
  assert.deepEqual(missing, [], 'a marker no core module contains anymore: update dashboardOnlyMarkers in starter-route-js-budget.json')
})
