#!/usr/bin/env node
/**
 * Generated-host conformance (#203, stage 1).
 *
 * Builds the two hosts of packages/core/tests/fixtures/host-conformance - `manual/` (hand-written
 * Next.js app, the reference) and `generated/` (src/app emitted by the facade emitter) - from the
 * same root-first source, with `next build --webpack` and `--turbopack`, in the legacy ISR and
 * the Cache Components variant, and compares per variant:
 *
 * - the route list (server/app-paths-manifest.json) and Next's build route table;
 * - the rendering mode of every route (prerender-manifest.json: static / ISR revalidate /
 *   dynamic / PPR, fallbacks, initial status) and the Server Action / 'use cache' references;
 * - HTTP behavior on `next start`: status, redirect Location, cache headers, notFound, the
 *   rendered title/markers, route handler and metadata route bodies, a Server Action;
 * - client JS per route: client module boundaries and chunks per entry (client reference
 *   manifests) and the scripts each HTML response loads.
 *
 * It also checks that the manual host is a byte-identical placement of the source (so it is an
 * honest reference) and that no generated file contains a variable-keyed lookup.
 * Writes a Markdown report and exits non-zero on any difference.
 *
 * Usage: node scripts/performance/host-conformance.mjs [--report <file.md>]
 *          [--bundlers webpack,turbopack] [--modes isr,cc] [--skip-build]
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE = join(REPO_ROOT, 'packages/core/tests/fixtures/host-conformance')
const NEXT_BIN = createRequire(join(REPO_ROOT, 'packages/core/package.json')).resolve('next/dist/bin/next')

const { generate } = await import(join(FIXTURE, 'generate.mjs'))
const { validateGeneratedModule } = await import(join(REPO_ROOT, 'packages/core/scripts/build/registry/host/static-imports.mjs'))
const { loadTypeScriptFor } = await import(join(REPO_ROOT, 'packages/core/scripts/build/registry/shared/typescript-compiler.mjs'))
const { canonicalText, compareArtifacts: compareArtifactLists, cssDigests, labelModules, normalizedBytes, scanChunk } = await import(join(REPO_ROOT, 'scripts/performance/host-conformance-bytes.mjs'))
const EXPECTED_ARTIFACTS = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/performance/host-conformance-expected.json'), 'utf8'))
const { ROUTE_EXPORT_TABLE, analyzeRouteSource } = await import(join(REPO_ROOT, 'packages/core/scripts/build/registry/host/facade-emitter.mjs'))
const { BUNDLERS, FIXTURE_COMPOSITION_WRAPPERS, HOSTS, MODES, resolveRoutePlan } = await import(join(FIXTURE, 'plan.mjs'))

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}
const REPORT = resolve(option('report', join(FIXTURE, '.report/host-conformance.md')))
const SELECTED_BUNDLERS = option('bundlers', BUNDLERS.join(',')).split(',')
const SELECTED_MODES = option('modes', MODES.join(',')).split(',')
const SKIP_BUILD = args.includes('--skip-build')
const SESSION_COOKIE = 'fixture-session=fixture-user'

// ---------------------------------------------------------------------------
// Which RFC #203 "First proof" case a route belongs to
// ---------------------------------------------------------------------------

const CASES = {
  1: 'core page overridden by root templates/ page',
  2: 'protected data: data access, Route Handler, Server Action',
  3: 'Client Component page',
  4: 'generateStaticParams (plain and aliased) / notFound / redirect',
  5: 'legacy ISR (revalidate) / Cache Components + PPR',
  6: 'plugin route handler',
  7: 'generated server + client-safe registries',
  8: 'generateMetadata + sitemap.ts + icon, icon1, opengraph-image2',
  9: 'composed facades: a project layout composed with core\'s wrapper; one route per entity (+ its project template)',
  shell: 'root layout, not-found, error, global-error',
}

function caseOf(route) {
  const path = route.replace(/\/(page|route)$/, '') || '/'
  if (/^\/(about)?$/.test(path)) return '1'
  if (/notes/.test(path)) return '2'
  if (path === '/counter') return '3'
  if (/^\/(posts|items|go|aliased)/.test(path)) return '4'
  if (/^\/(isr|legacy-dynamic|cached|cached-module)$/.test(path)) return '5'
  if (path.startsWith('/api/plugins')) return '6'
  if (path === '/registry') return '7'
  if (/^\/(sitemap\.xml|icon|opengraph-image)/.test(path)) return '8'
  if (/^\/(shell|dashboard\/widgets)/.test(path)) return '9'
  return 'shell'
}

// ---------------------------------------------------------------------------
// Checks: every comparison is recorded, equal or not
// ---------------------------------------------------------------------------

const checks = []
function record({ variant, section, subject, caseId = caseOf(subject), manual, generated, equal }) {
  const same = equal ?? JSON.stringify(manual) === JSON.stringify(generated)
  checks.push({ variant, section, subject, caseId, manual, generated, equal: same })
  return same
}

// ---------------------------------------------------------------------------
// Fixture integrity: the reference is honest, the generated host has no lookups
// ---------------------------------------------------------------------------

function listFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

const toPosix = path => path.split(sep).join('/')

/**
 * A route the generator writes as a composition (a project layout over a wrapped core layout, a per-entity route,
 * a webhook) rather than as a facade of one module: the manual host has a hand-written composition there.
 */
const isComposed = route => Boolean(route.entityRoute || route.webhook || (route.compose && route.origin !== 'core'))

function checkManualHost(plan) {
  const appDir = join(FIXTURE, 'manual/src/app')
  const stripHeader = text => text.split('\n').filter(line => !line.startsWith('//')).join('\n')
  const expected = new Map(plan.map(route => [route.target, route]))
  const actual = listFiles(appDir).map(file => toPosix(relative(appDir, file)))
  for (const target of actual) {
    const route = expected.get(target)
    const composed = route && isComposed(route)
    record({
      variant: 'fixture',
      section: composed ? 'manual host = hand-written composition (equals the generated file)' : 'manual host = source placed at its route',
      subject: `src/app/${target}`,
      caseId: caseOf(`/${target}`),
      manual: route ? 'present' : 'extra file',
      generated:
        route &&
        (composed
          ? stripHeader(readFileSync(join(appDir, target), 'utf8')) === stripHeader(readFileSync(join(FIXTURE, 'generated/src/app', target), 'utf8'))
          : readFileSync(join(appDir, target), 'utf8') === readFileSync(route.file, 'utf8'))
          ? 'present'
          : composed
            ? 'differs from the generated composition'
            : 'differs from source',
    })
  }
  for (const target of expected.keys()) {
    if (!actual.includes(target)) {
      record({ variant: 'fixture', section: 'manual host = source placed at its route', subject: `src/app/${target}`, manual: 'missing', generated: 'present' })
    }
  }
  for (const name of ['entities.server.ts', 'entities.client.ts']) {
    const manual = stripHeader(readFileSync(join(FIXTURE, 'manual/registries', name), 'utf8'))
    const generated = stripHeader(readFileSync(join(FIXTURE, 'generated/.nextspark/registries', name), 'utf8'))
    record({ variant: 'fixture', section: 'registries (hand-written vs generated)', subject: name, caseId: '7', manual, generated })
  }
}

/**
 * The generated host must reach every module through a fixed specifier. Each generated file is
 * validated against the allowed grammar (static-imports.mjs, the same gate the emitter and the
 * registry generator apply): route files as `facade`, registries as `registry`. Any statement or
 * expression outside it is reported.
 */
async function checkNoLookups(plan) {
  const ts = await loadTypeScriptFor(join(REPO_ROOT, 'packages/core'))
  const grammars = [
    [join(FIXTURE, 'generated/src'), 'facade'],
    // The registries; .nextspark/generation.json is prepare's ownership record, not a module.
    [join(FIXTURE, 'generated/.nextspark/registries'), 'registry'],
  ]
  const findings = []
  let files = 0
  // A composed route is validated against the composed-facade grammar, every other route file against the plain one.
  const composedTargets = new Set(plan.filter(isComposed).map(route => `src/app/${route.target}`))
  for (const [root, grammar] of grammars) {
    for (const file of listFiles(root)) {
      files += 1
      const fileGrammar = grammar === 'facade' && composedTargets.has(toPosix(relative(join(FIXTURE, 'generated'), file))) ? 'composed-facade' : grammar
      for (const violation of validateGeneratedModule({ ts, source: readFileSync(file, 'utf8'), file, grammar: fileGrammar, wrappers: FIXTURE_COMPOSITION_WRAPPERS })) {
        findings.push(`${toPosix(relative(FIXTURE, file))}:${violation.line}: ${fileGrammar} ${violation.kind}: ${violation.text}`)
      }
    }
  }
  record({
    variant: 'fixture',
    section: 'generated files inside the allowed grammar',
    subject: `${files} generated files (facade, composed-facade and registry grammars)`,
    caseId: '7',
    manual: [],
    generated: findings,
  })
  return { files, findings }
}

// ---------------------------------------------------------------------------
// Build and artifacts
// ---------------------------------------------------------------------------

const distDir = (mode, bundler) => `.next-${bundler}-${mode}`
const hostEnv = (mode, bundler) => ({
  ...process.env,
  HOST_CACHE_MODE: mode,
  HOST_BUNDLER: bundler,
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'production',
})

async function build(host, mode, bundler) {
  const cwd = join(FIXTURE, host)
  if (!SKIP_BUILD) await rm(join(cwd, distDir(mode, bundler)), { recursive: true, force: true })
  if (SKIP_BUILD && existsSync(join(cwd, distDir(mode, bundler), 'BUILD_ID'))) {
    const log = await readFile(join(cwd, distDir(mode, bundler), 'host-conformance-build.log'), 'utf8').catch(() => '')
    return { ok: true, log, seconds: 0 }
  }
  const started = Date.now()
  const result = spawnSync(process.execPath, [NEXT_BIN, 'build', `--${bundler}`], {
    cwd,
    env: hostEnv(mode, bundler),
    encoding: 'utf8',
    timeout: 900_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`
  if (result.status === 0) await writeFile(join(cwd, distDir(mode, bundler), 'host-conformance-build.log'), log)
  return { ok: result.status === 0, log, seconds: Math.round((Date.now() - started) / 1000) }
}

/** Next's printed route table (symbols, revalidate/expire columns), whitespace-normalized. */
function routeTable(log) {
  const lines = log.split('\n')
  const start = lines.findIndex(line => line.startsWith('Route (app)'))
  if (start === -1) return []
  const table = []
  for (const line of lines.slice(start + 1)) {
    if (!/^[┌├└│ ]/.test(line) || line.trim() === '') break
    table.push(line.replace(/\s+/g, ' ').trim())
  }
  return table
}

/** Map a module path from either host's build output to one fixture-relative identity. */
function moduleIdentity(host, path, plan) {
  let clean = String(path).replace(/ <module evaluation>$/, '').replace(/#.*$/, '').replace(/\?.*$/, '').replace(/ \[.*\]$/, '')
  if (clean.startsWith('[project]/')) clean = join(REPO_ROOT, clean.slice('[project]/'.length))
  // webpack names server references relative to the host's src/, Turbopack relative to its root.
  else if (!isAbsolute(clean)) clean = existsSync(join(FIXTURE, host, 'src', clean)) ? join(FIXTURE, host, 'src', clean) : join(REPO_ROOT, clean)
  const appDir = join(FIXTURE, host, 'src/app') + sep
  if (clean.startsWith(appDir)) {
    const target = toPosix(clean.slice(appDir.length))
    const route = plan.find(candidate => candidate.target === target)
    // The manual host's route file is a byte-identical copy of the source module (checked).
    return route ? (route.file ? toPosix(relative(FIXTURE, route.file)) : `composed:${target}`) : `${host}-only:src/app/${target}`
  }
  const pnpmNext = clean.indexOf('/node_modules/next/')
  if (pnpmNext !== -1) return `next/${clean.slice(pnpmNext + '/node_modules/next/'.length).replace(/^dist\/esm\//, 'dist/')}`
  const nodeModules = clean.lastIndexOf('/node_modules/')
  if (nodeModules !== -1) return clean.slice(nodeModules + 1)
  return toPosix(relative(FIXTURE, clean))
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function loadClientManifest(dist, entry) {
  const file = join(dist, 'server/app', `${entry}_client-reference-manifest.js`)
  if (!existsSync(file)) return null
  const context = { globalThis: {} }
  context.self = context.globalThis
  vm.runInNewContext(readFileSync(file, 'utf8'), context)
  return context.globalThis.__RSC_MANIFEST?.[entry] ?? null
}

async function collectArtifacts(host, mode, bundler, plan, expected) {
  const dist = join(FIXTURE, host, distDir(mode, bundler))
  const appPaths = Object.keys(readJson(join(dist, 'server/app-paths-manifest.json'))).sort()

  const prerender = readJson(join(dist, 'prerender-manifest.json'))
  const strip = entry => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'htmlSize').sort(([a], [b]) => a.localeCompare(b)))
  const rendering = {}
  for (const [route, entry] of Object.entries(prerender.routes)) rendering[route] = { kind: 'prerendered', ...strip(entry) }
  for (const [route, entry] of Object.entries(prerender.dynamicRoutes)) rendering[route] = { kind: 'dynamic-route', ...strip(entry) }
  rendering.__notFoundRoutes = { kind: 'notFoundRoutes', routes: [...(prerender.notFoundRoutes ?? [])].sort() }

  const serverRefs = []
  const serverManifest = join(dist, 'server/server-reference-manifest.json')
  const actionIds = {}
  if (existsSync(serverManifest)) {
    for (const [id, entry] of Object.entries(readJson(serverManifest).node ?? {})) {
      const identity = `${moduleIdentity(host, entry.filename, plan)}#${entry.exportedName}`
      serverRefs.push(`${identity} <- ${Object.keys(entry.workers).sort().join(', ')}`)
      if (entry.exportedName === 'addNote') actionIds.addNote = id
    }
  }
  serverRefs.sort()

  // Module ids -> identities, from every client reference manifest. A route file of either host
  // is `route:<target>`, so the same route compares across hosts whatever its module id.
  const pageEntries = appPaths.filter(path => path.endsWith('/page'))
  const manifests = Object.fromEntries(pageEntries.map(entry => [entry, loadClientManifest(dist, entry)]))
  const appDir = join(FIXTURE, host, 'src/app') + sep
  const idToIdentity = new Map()
  for (const manifest of Object.values(manifests)) {
    for (const [path, module] of Object.entries(manifest?.clientModules ?? {})) {
      if (module.id === undefined) continue
      const clean = path.replace(/ <module evaluation>$/, '').replace(/#.*$/, '')
      const absolute = clean.startsWith('[project]/') ? join(REPO_ROOT, clean.slice('[project]/'.length)) : clean
      idToIdentity.set(Number(module.id), absolute.startsWith(appDir) ? `route:${toPosix(absolute.slice(appDir.length))}` : moduleIdentity(host, path, plan))
    }
  }
  const artifactKey = artifact => `${artifact.type}@${idToIdentity.get(artifact.factoryId) ?? `module-id:${artifact.factoryId}`}`

  const ts = await loadTypeScriptFor(join(REPO_ROOT, 'packages/core'))
  const chunks = new Map()
  for (const file of listFiles(join(dist, 'static/chunks')).filter(file => file.endsWith('.js'))) {
    const text = readFileSync(file, 'utf8')
    chunks.set(toPosix(relative(dist, file)), { text, scan: scanChunk({ text, ts, file }) })
  }
  // Every facade artifact in this host's client chunks, by module: counted per chunk occurrence.
  const artifactsFound = {}
  for (const { scan } of chunks.values()) {
    for (const artifact of scan.artifacts) {
      const key = artifactKey(artifact)
      artifactsFound[key] ??= { count: 0, shapes: [], bytes: [] }
      artifactsFound[key].count += 1
      artifactsFound[key].shapes.push(artifact.shape)
      artifactsFound[key].bytes.push(artifact.bytes)
    }
  }
  // Only artifacts on the fixed expected list for this host are removed before comparing.
  const removable = new Set(expected.filter(item => item.host === host).map(item => item.key))
  const excused = artifact => removable.has(artifactKey(artifact))
  // Identity-preserving labels of every module of the host (all emitted client chunks).
  const { labels, externals, rounds } = labelModules([...chunks.values()], excused)
  // Canonical digest of every client chunk (ids normalized, module maps sorted, expected artifacts
  // cut): equal digests mean the same code whatever the module ids.
  for (const chunk of chunks.values()) {
    chunk.digest = createHash('sha1').update(canonicalText(chunk.scan, chunk.text, excused, labels)).digest('hex').slice(0, 16)
  }
  const digestsOf = files => [...new Set([...files].map(name => name.replace(/^\/?_next\//, '').replace(/\?.*$/, '')))].map(file => chunks.get(file)?.digest ?? `missing:${file}`).sort()
  const allChunkDigests = [...chunks.values()].map(chunk => chunk.digest).sort()
  // CSS is compared by content: the multiset of digests, file names aside (cssDigests).
  const cssDigestsOf = files =>
    cssDigests([...files].map(name => name.replace(/^\/?_next\//, '').replace(/\?.*$/, '')), file => {
      const path = join(dist, file)
      return existsSync(path) ? readFileSync(path, 'utf8') : null
    })
  const measure = files => {
    const total = { bytes: 0, normalized: 0, removedArtifacts: 0, missing: [] }
    for (const file of new Set([...files].map(name => name.replace(/^\/?_next\//, '').replace(/\?.*$/, '')))) {
      const chunk = chunks.get(file)
      if (!chunk) {
        total.missing.push(file)
        continue
      }
      total.bytes += chunk.scan.bytes
      total.normalized += normalizedBytes(chunk.scan, chunk.text, excused, labels)
      total.removedArtifacts += chunk.scan.artifacts.filter(excused).reduce((sum, artifact) => sum + artifact.bytes, 0)
    }
    total.idLabels = total.normalized + total.removedArtifacts - total.bytes
    return total
  }

  const clientJs = {}
  for (const entry of pageEntries) {
    const manifest = manifests[entry]
    if (!manifest) {
      clientJs[entry] = { missing: true }
      continue
    }
    const chunkFiles = new Set()
    const boundaries = new Set()
    // Which module each client boundary of the entry points at, by canonical label: a manifest id
    // retargeted to another module changes it.
    const boundaryLabels = new Set()
    for (const [path, module] of Object.entries(manifest.clientModules ?? {})) {
      const files = (module.chunks ?? []).filter(chunk => typeof chunk === 'string' && chunk.endsWith('.js'))
      if (files.length === 0) continue
      files.forEach(file => chunkFiles.add(file))
      const identity = moduleIdentity(host, path, plan)
      boundaries.add(identity)
      boundaryLabels.add(`${identity} -> ${labels.get(Number(module.id)) ?? `external:${module.id}`}`)
    }
    for (const files of Object.values(manifest.entryJSFiles ?? {})) files.forEach(file => chunkFiles.add(file))
    const css = new Set(Object.values(manifest.entryCSSFiles ?? {}).flat().map(file => (typeof file === 'string' ? file : file.path)))
    clientJs[entry] = {
      boundaries: [...boundaries].sort(),
      boundaryLabels: [...boundaryLabels].sort(),
      chunks: chunkFiles.size,
      css: css.size,
      cssDigests: cssDigestsOf(css),
      bytes: measure(chunkFiles),
      digests: digestsOf(chunkFiles),
    }
  }

  const allCssDigests = cssDigestsOf(listFiles(join(dist, 'static')).filter(file => file.endsWith('.css')).map(file => toPosix(relative(dist, file))))
  return {
    dist,
    appPaths,
    rendering,
    serverRefs,
    clientJs,
    actionIds,
    measure,
    digestsOf,
    cssDigestsOf,
    allChunkDigests,
    allCssDigests,
    artifactsFound,
    labeling: { modules: labels.size, rounds, externals },
  }
}

// ---------------------------------------------------------------------------
// next start + HTTP probes
// ---------------------------------------------------------------------------

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })
}

async function startServer(host, mode, bundler) {
  const port = await freePort()
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: join(FIXTURE, host),
    env: hostEnv(mode, bundler),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => (output += chunk))
  child.stderr.on('data', chunk => (output += chunk))
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited (${child.exitCode}) for ${host}/${mode}/${bundler}:\n${output}`)
    try {
      await fetch(`${base}/`, { redirect: 'manual' })
      return { base, stop: () => stopServer(child), output: () => output }
    } catch {
      await new Promise(done => setTimeout(done, 250))
    }
  }
  child.kill('SIGKILL')
  throw new Error(`next start did not answer within 60s for ${host}/${mode}/${bundler}:\n${output}`)
}

function stopServer(child) {
  return new Promise(done => {
    if (child.exitCode !== null) return done()
    child.once('exit', done)
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 5000).unref()
  })
}

const COMPARED_HEADERS = ['location', 'content-type', 'cache-control', 'vary', 'x-nextjs-cache', 'x-nextjs-prerender', 'x-nextjs-postponed', 'x-action-redirect', 'x-nextjs-stale-time']

function probesFor(mode) {
  const probes = [
    { path: '/' },
    { path: '/about' },
    { path: '/about', label: '/about (RSC request)', headers: { RSC: '1' } },
    { path: '/counter' },
    { path: '/registry' },
    { path: '/posts/hello' },
    { path: '/posts/world' },
    { path: '/posts/nope' },
    { path: '/items/1' },
    { path: '/items/999' },
    { path: '/go/hello' },
    { path: '/aliased/one' },
    { path: '/aliased/nope' },
    { path: '/notes', label: '/notes (anonymous)' },
    { path: '/notes', label: '/notes (session)', headers: { Cookie: SESSION_COOKIE } },
    { path: '/api/notes', label: '/api/notes (anonymous)' },
    { path: '/api/notes', label: '/api/notes (session)', headers: { Cookie: SESSION_COOKIE } },
    { path: '/notes', label: 'Server Action addNote (anonymous)', action: 'addNote' },
    { path: '/notes', label: 'Server Action addNote (session)', action: 'addNote', headers: { Cookie: SESSION_COOKIE } },
    { path: '/api/plugins/hello/ping' },
    { path: '/sitemap.xml' },
    { path: '/icon' },
    { path: '/icon1' },
    { path: '/opengraph-image2' },
    { path: '/shell' },
    { path: '/dashboard/widgets' },
    { path: '/dashboard/widgets/7' },
    { path: '/dashboard/widgets/create' },
    { path: '/dashboard/widgets/7/edit' },
    { path: '/dashboard/nothing' },
    { path: '/does-not-exist' },
  ]
  if (mode === 'isr') probes.push({ path: '/isr' }, { path: '/legacy-dynamic' })
  if (mode === 'cc') probes.push({ path: '/cached' }, { path: '/cached-module' })
  return probes
}

async function runProbe(base, probe, artifacts) {
  const init = { redirect: 'manual', headers: { ...(probe.headers ?? {}) } }
  if (probe.action) {
    const id = artifacts.actionIds[probe.action]
    if (!id) return { error: `no Server Action id for ${probe.action}` }
    // A progressively-enhanced <form action={addNote}> submission (no client JS).
    const form = new FormData()
    form.set(`$ACTION_ID_${id}`, '')
    form.set('title', 'From the conformance script')
    init.method = 'POST'
    init.body = form
  }
  const response = await fetch(base + probe.path, init)
  const buffer = Buffer.from(await response.arrayBuffer())
  const headers = Object.fromEntries(COMPARED_HEADERS.map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null))
  const result = { status: response.status, headers }
  const type = response.headers.get('content-type') ?? ''
  if (type.startsWith('text/html')) {
    const html = buffer.toString('utf8')
    result.title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null
    result.markers = [...html.matchAll(/data-probe="([^"]+)"/g)].map(match => match[1])
    result.markers = [...new Set(result.markers)].sort()
    const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]))]
    result.scripts = scripts.length
    result.scriptBytes = artifacts.measure(scripts)
    result.scriptDigests = artifacts.digestsOf(scripts.filter(src => src.includes('/_next/static/')))
    const stylesheets = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map(match => match[1]).filter(href => href.includes('/_next/static/'))
    result.stylesheets = stylesheets.length
    result.stylesheetDigests = artifacts.cssDigestsOf(stylesheets)
  } else if (type.startsWith('text/x-component')) {
    result.body = `rsc payload (${buffer.length > 0 ? 'non-empty' : 'empty'})`
  } else if (/json|xml|text\/plain/.test(type)) {
    result.body = buffer.toString('utf8')
  } else {
    result.body = `sha1:${createHash('sha1').update(buffer).digest('hex')} (${buffer.length} bytes)`
  }
  return result
}

async function probeHost(host, mode, bundler, artifacts) {
  const server = await startServer(host, mode, bundler)
  const results = {}
  try {
    for (const probe of probesFor(mode)) {
      const label = probe.label ?? probe.path
      try {
        results[label] = await runProbe(server.base, probe, artifacts)
      } catch (error) {
        results[label] = { error: error.message }
      }
    }
  } finally {
    await server.stop()
  }
  return results
}

// ---------------------------------------------------------------------------
// Comparison of one variant
// ---------------------------------------------------------------------------

/**
 * The client-JS facade artifacts one variant may show are fixed data
 * (host-conformance-expected.json: module, host, exact shape, exact count), never learned from the
 * build being judged. The plan gives an independent rule for which (artifact, module, host)
 * triples must be on that list, and the two are cross-checked:
 * - Turbopack: every facade that carries a directive (`'use client'` error/global-error) is an
 *   extra re-export module in the generated host (`x.s([],#),x.i(#),` + group argument `,#`).
 * - webpack: a `'use client'` source forwarded by a directive-less facade (a client page) is the
 *   route entry file in the manual host, where webpack adds `n.r(t),`.
 */
function planArtifactRules(bundler, plan, routeDirectives) {
  const rules = []
  for (const route of plan) {
    const spec = ROUTE_EXPORT_TABLE.kinds[route.kind]
    const clientSource = (routeDirectives.get(route.target) ?? []).includes('use client')
    if (bundler === 'turbopack' && spec.facadeDirective) rules.push(`turbopack-reexport@route:${route.target}@generated`)
    if (bundler === 'webpack' && !spec.facadeDirective && clientSource) rules.push(`webpack-esm-marker@route:${route.target}@manual`)
  }
  return rules.sort()
}

function expectedArtifacts(variant, bundler, plan, routeDirectives) {
  const entries = EXPECTED_ARTIFACTS.variants[variant] ?? []
  const expected = entries.map(entry => ({ key: `${entry.artifact}@${entry.module}`, host: entry.host, shape: entry.shape, count: entry.count }))
  record({
    variant,
    section: 'client JS: expected artifact list (JSON) vs plan rules',
    subject: 'host-conformance-expected.json',
    caseId: 'shell',
    manual: planArtifactRules(bundler, plan, routeDirectives),
    generated: expected.map(item => `${item.key}@${item.host}`).sort(),
  })
  return expected
}

/** Record the comparison of both hosts' facade artifacts with the expected list. */
function compareArtifacts(variant, expected, manual, generated) {
  const results = compareArtifactLists({
    expected,
    manual: { artifacts: manual.artifactsFound },
    generated: { artifacts: generated.artifactsFound },
  })
  for (const { key, equal, note, manual: a, generated: b } of results) {
    const identity = key.slice(key.indexOf('@') + 1)
    record({
      variant,
      section: 'client JS: facade artifacts vs expected list',
      subject: key,
      caseId: identity.startsWith('route:') ? caseOf(`/${identity.slice('route:'.length)}`) : 'shell',
      manual: { count: a.count, shapes: [...new Set(a.shapes)], bytes: a.bytes, note },
      generated: { count: b.count, shapes: [...new Set(b.shapes)], bytes: b.bytes, note },
      equal,
    })
  }
}

/** Client JS bytes are equal only when the normalized sizes are identical and every chunk was read. */
function bytesExplained(a, b) {
  return Boolean(a && b) && a.missing.length === 0 && b.missing.length === 0 && a.normalized === b.normalized
}

const byteSummary = m =>
  m && {
    raw: m.bytes,
    normalized: m.normalized,
    removedExpectedArtifacts: m.removedArtifacts,
    idLabels: m.idLabels,
    ...(m.missing.length ? { missing: m.missing } : {}),
  }

function compareVariant(variant, builds, artifacts, http, expected) {
  const [manual, generated] = [artifacts.manual, artifacts.generated]
  compareArtifacts(variant, expected, manual, generated)
  record({ variant, section: 'route list (app-paths-manifest)', subject: 'all routes', caseId: 'shell', manual: manual.appPaths, generated: generated.appPaths })
  for (const route of new Set([...manual.appPaths, ...generated.appPaths])) {
    record({ variant, section: 'route list (app-paths-manifest)', subject: route, manual: manual.appPaths.includes(route), generated: generated.appPaths.includes(route) })
  }

  const tableManual = routeTable(builds.manual.log)
  const tableGenerated = routeTable(builds.generated.log)
  record({ variant, section: 'build route table (static/ISR/dynamic/PPR symbols)', subject: 'next build output', caseId: 'shell', manual: tableManual, generated: tableGenerated })
  for (const line of new Set([...tableManual, ...tableGenerated])) {
    const route = /(\/\S*)/.exec(line)?.[1] ?? line
    record({ variant, section: 'build route table (static/ISR/dynamic/PPR symbols)', subject: route, manual: tableManual.includes(line) ? line : null, generated: tableGenerated.includes(line) ? line : null })
  }

  for (const route of new Set([...Object.keys(manual.rendering), ...Object.keys(generated.rendering)])) {
    record({ variant, section: 'rendering mode (prerender-manifest)', subject: route, manual: manual.rendering[route] ?? null, generated: generated.rendering[route] ?? null })
  }

  record({ variant, section: "Server Action / 'use cache' references", subject: 'server-reference-manifest', caseId: '2', manual: manual.serverRefs, generated: generated.serverRefs })

  for (const entry of new Set([...Object.keys(manual.clientJs), ...Object.keys(generated.clientJs)])) {
    const a = manual.clientJs[entry] ?? null
    const b = generated.clientJs[entry] ?? null
    record({ variant, section: 'client JS per entry: client boundaries', subject: entry, manual: a?.boundaries ?? a, generated: b?.boundaries ?? b })
    record({ variant, section: 'client JS per entry: chunks / CSS files', subject: entry, manual: a && { chunks: a.chunks, css: a.css }, generated: b && { chunks: b.chunks, css: b.css } })
    record({ variant, section: 'client JS per entry: bytes', subject: entry, manual: byteSummary(a?.bytes), generated: byteSummary(b?.bytes), equal: bytesExplained(a?.bytes, b?.bytes) })
    record({ variant, section: 'client JS per entry: set of chunks (canonical digests)', subject: entry, manual: a?.digests ?? null, generated: b?.digests ?? null })
    record({ variant, section: 'client JS per entry: client references by module label', subject: entry, manual: a?.boundaryLabels ?? null, generated: b?.boundaryLabels ?? null })
    record({ variant, section: 'CSS per entry: content digests', subject: entry, manual: a?.cssDigests ?? null, generated: b?.cssDigests ?? null })
  }
  // Every client chunk the build emitted, referenced by a route or not.
  record({ variant, section: 'client JS: set of all emitted chunks (canonical digests)', subject: 'static/chunks', caseId: 'shell', manual: manual.allChunkDigests, generated: generated.allChunkDigests })
  record({ variant, section: 'CSS: all emitted stylesheets (content digests)', subject: 'static/**/*.css', caseId: 'shell', manual: manual.allCssDigests, generated: generated.allCssDigests })
  // Every module reference must resolve inside the host's own module table.
  record({
    variant,
    section: 'client JS: module references resolved in the host',
    subject: 'labelModules',
    caseId: 'shell',
    manual: { externals: manual.labeling.externals },
    generated: { externals: generated.labeling.externals },
    equal: manual.labeling.externals.length === 0 && generated.labeling.externals.length === 0,
  })

  for (const label of Object.keys(http.manual)) {
    const a = http.manual[label]
    const b = http.generated[label]
    const pick = (result, keys) => (result ? Object.fromEntries(keys.filter(key => key in result).map(key => [key, result[key]])) : null)
    const path = label.split(' ')[0]
    const subject = label.startsWith('Server Action') ? `/notes ${label}` : label
    const caseId = label.startsWith('Server Action') ? '2' : caseOf(path)
    record({ variant, section: 'HTTP: status, redirect, cache headers', subject, caseId, manual: pick(a, ['status', 'headers', 'error']), generated: pick(b, ['status', 'headers', 'error']) })
    // The <title> of /posts/* comes from generateMetadata (case 8).
    record({ variant, section: 'HTTP: rendered content', subject, caseId: path.startsWith('/posts/') ? '8' : caseId, manual: pick(a, ['title', 'markers', 'body']), generated: pick(b, ['title', 'markers', 'body']) })
    if (a && 'scripts' in a) {
      record({
        variant,
        section: 'HTTP: scripts loaded by the HTML',
        subject,
        caseId,
        manual: { scripts: a.scripts, bytes: byteSummary(a.scriptBytes), digests: a.scriptDigests },
        generated: { scripts: b?.scripts, bytes: byteSummary(b?.scriptBytes), digests: b?.scriptDigests },
        equal: a.scripts === b?.scripts && bytesExplained(a.scriptBytes, b?.scriptBytes) && JSON.stringify(a.scriptDigests) === JSON.stringify(b?.scriptDigests),
      })
      record({ variant, section: 'HTTP: stylesheets loaded by the HTML (content digests)', subject, caseId, manual: a.stylesheetDigests, generated: b?.stylesheetDigests ?? null })
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const short = value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text === undefined ? 'undefined' : text.length > 400 ? `${text.slice(0, 400)}…` : text
}
const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ')

function renderReport({ variants, buildInfo, lookup, startedAt }) {
  const differing = checks.filter(check => !check.equal)
  const lines = [
    '# Generated host conformance report',
    '',
    `- Date: ${startedAt.toISOString()}`,
    `- Next.js: ${createRequire(join(REPO_ROOT, 'packages/core/package.json'))('next/package.json').version}; Node ${process.version}`,
    `- Variants: ${variants.map(v => v.name).join(', ')}`,
    '- Client JS: facade artifacts must match an exact expected list derived from the route plan; bytes must be equal after removing only those artifacts and normalizing module ids in module-system positions (unexplained remainder exactly 0; no tolerance)',
    `- Checks: ${checks.length}, differences: **${differing.length}**, build failures: **${buildInfo.filter(b => !b.ok).length}**`,
    `- Result: **${differing.length === 0 && buildInfo.every(b => b.ok) ? 'EQUAL' : 'DIFFERENT'}**`,
    '',
    '## Conformance by case (manual vs generated)',
    '',
    `| Case | ${variants.map(v => v.name).join(' | ')} |`,
    `| --- | ${variants.map(() => '---').join(' | ')} |`,
  ]
  for (const [caseId, title] of Object.entries(CASES)) {
    const row = variants.map(({ name }) => {
      const scoped = checks.filter(check => check.variant === name && check.caseId === caseId)
      if (buildInfo.some(b => b.variant === name && !b.ok)) return 'build failed'
      if (scoped.length === 0) return 'n/a'
      const bad = scoped.filter(check => !check.equal)
      return bad.length === 0 ? `equal (${scoped.length} checks)` : `**different** (${bad.map(check => `${check.section}: ${check.subject}`).join('; ')})`
    })
    lines.push(`| ${caseId}. ${title} | ${row.map(cell).join(' | ')} |`)
  }
  const fixtureChecks = checks.filter(check => check.variant === 'fixture')
  lines.push(
    '',
    '## Fixture integrity',
    '',
    `- Manual host is a byte-identical placement of the source + registries match: ${fixtureChecks.filter(c => c.section !== 'generated files inside the allowed grammar').every(c => c.equal) ? 'yes' : '**no**'}`,
    `- Violations of the generated-module grammar (facade/registry) in ${lookup.files} generated files: ${lookup.findings.length === 0 ? 'none' : `**${lookup.findings.length}**`}`,
    ...lookup.findings.map(finding => `  - \`${finding}\``),
    '',
    '## Builds',
    '',
    '| Variant | Host | Result | Seconds |',
    '| --- | --- | --- | --- |',
    ...buildInfo.map(b => `| ${b.variant} | ${b.host} | ${b.ok ? 'ok' : '**failed**'} | ${b.seconds} |`)
  )
  for (const { name, artifacts, table } of variants) {
    if (!artifacts) continue
    lines.push('', `## ${name}`, '', '### Route table (manual host build output)', '', '```', ...table, '```', '')
    lines.push('### Client JS facade artifacts (found vs expected)', '', '| Artifact @ module | Manual | Generated | Expected |', '| --- | --- | --- | --- |')
    for (const check of checks.filter(c => c.variant === name && c.section === 'client JS: facade artifacts vs expected list')) {
      lines.push(`| ${cell(check.subject)} | ${check.manual.count} ${cell(check.manual.shapes.join(' '))} | ${check.generated.count} ${cell(check.generated.shapes.join(' '))} | ${cell(check.manual.note)}${check.equal ? '' : ' — **MISMATCH**'} |`)
    }
    lines.push('')
    lines.push(
      '### Client JS per page entry (manual → generated)',
      '',
      'Raw bytes, then the generated−manual delta split into: expected facade artifacts (the exact list above), module ids replaced by canonical graph labels (module-system positions only), and the unexplained remainder (must be 0).',
      '',
      '| Entry | Chunks | Raw bytes | Δ raw | Δ expected artifacts | Δ id → label | Unexplained | Client boundaries |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |'
    )
    for (const entry of Object.keys(artifacts.manual.clientJs)) {
      const a = artifacts.manual.clientJs[entry]
      const b = artifacts.generated.clientJs[entry] ?? {}
      const arrow = (x, y) => (JSON.stringify(x) === JSON.stringify(y) ? String(x) : `${x} → **${y}**`)
      const d = key => (b.bytes?.[key] ?? 0) - (a.bytes?.[key] ?? 0)
      lines.push(
        `| ${entry} | ${arrow(a.chunks, b.chunks)} | ${arrow(a.bytes?.bytes, b.bytes?.bytes)} | ${d('bytes')} | ${d('removedArtifacts')} | ${d('idLabels')} | ${d('normalized') === 0 ? '0' : `**${d('normalized')}**`} | ${cell(arrow((a.boundaries ?? []).join(', '), (b.boundaries ?? []).join(', ')))} |`
      )
    }
  }
  lines.push('', '## Differences', '')
  if (differing.length === 0) lines.push('None.')
  else {
    lines.push('| Variant | Case | Check | Subject | Manual | Generated |', '| --- | --- | --- | --- | --- | --- |')
    for (const check of differing) lines.push(`| ${check.variant} | ${check.caseId} | ${check.section} | ${cell(check.subject)} | ${cell(short(check.manual))} | ${cell(short(check.generated))} |`)
  }
  for (const b of buildInfo.filter(b => !b.ok)) lines.push('', `### Build failure: ${b.variant} ${b.host}`, '', '```', b.log.split('\n').slice(-60).join('\n'), '```')
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------

async function main() {
  const startedAt = new Date()
  await generate()
  const plan = await resolveRoutePlan()
  checkManualHost(plan)
  const lookup = await checkNoLookups(plan)
  const routeDirectives = new Map()
  for (const route of plan) {
    // A route made of imports and one composition has no module of its own to read a directive from.
    if (!route.file || isComposed(route)) {
      routeDirectives.set(route.target, [])
      continue
    }
    const analysis = await analyzeRouteSource({ source: readFileSync(route.file, 'utf8'), file: route.file, projectRoot: join(REPO_ROOT, 'packages/core') })
    routeDirectives.set(route.target, analysis.directives)
  }

  const variants = []
  const buildInfo = []
  const raw = {}
  for (const mode of SELECTED_MODES) {
    for (const bundler of SELECTED_BUNDLERS) {
      const name = `${bundler}/${mode}`
      process.stderr.write(`\n== ${name}\n`)
      const builds = {}
      for (const host of HOSTS) {
        process.stderr.write(`  build ${host} ... `)
        builds[host] = await build(host, mode, bundler)
        buildInfo.push({ variant: name, host, ok: builds[host].ok, seconds: builds[host].seconds, log: builds[host].log })
        process.stderr.write(`${builds[host].ok ? 'ok' : 'FAILED'} (${builds[host].seconds}s)\n`)
      }
      if (!HOSTS.every(host => builds[host].ok)) {
        variants.push({ name })
        continue
      }
      const artifacts = {}
      const http = {}
      const expected = expectedArtifacts(name, bundler, plan, routeDirectives)
      for (const host of HOSTS) artifacts[host] = await collectArtifacts(host, mode, bundler, plan, expected)
      for (const host of HOSTS) {
        process.stderr.write(`  next start ${host} + probes ... `)
        http[host] = await probeHost(host, mode, bundler, artifacts[host])
        process.stderr.write('done\n')
      }
      compareVariant(name, builds, artifacts, http, expected)
      variants.push({ name, artifacts, table: routeTable(builds.manual.log) })
      raw[name] = { artifacts, http }
    }
  }

  const report = renderReport({ variants, buildInfo, lookup, startedAt })
  await mkdir(dirname(REPORT), { recursive: true })
  await writeFile(REPORT, report)
  await writeFile(REPORT.replace(/\.md$/, '.json'), JSON.stringify({ checks, raw }, null, 2))
  const differing = checks.filter(check => !check.equal).length
  const failedBuilds = buildInfo.filter(b => !b.ok).length
  process.stderr.write(`\n${checks.length} checks, ${differing} differences, ${failedBuilds} failed builds. Report: ${REPORT}\n`)
  process.exitCode = differing === 0 && failedBuilds === 0 ? 0 : 1
}

await main()
