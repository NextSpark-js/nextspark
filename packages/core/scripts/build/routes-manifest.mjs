#!/usr/bin/env node
/**
 * Core route manifest (#203)
 *
 * Lists every route core implements under `src/routes/`, for `nextspark prepare`
 * to emit one `src/app` facade per entry with the facade emitter
 * (registry/host/facade-emitter.mjs):
 *
 * - `src/routes/manifest.json`: `[{ kind, target, specifier }]`, where `kind` is a
 *   route kind of the emitter's export table, `target` the file's path under
 *   `src/app`, and `specifier` the `@nextsparkjs/core/routes/...` subpath that
 *   implements it. Sorted by target.
 * - `src/routes/variants.json`: routes that replace a manifest entry when the host
 *   enables a Next.js mode. Today only `cacheComponents`: the root layout
 *   `layout.ppr.tsx`, the `layout.cc.tsx` files of the five layouts that load messages (their
 *   `getMessages()` cannot be awaited outside Suspense while prerendering) and the `page.cc.tsx`
 *   files of the routes whose segment config Next.js rejects under Cache Components (login,
 *   signup, both docs pages).
 * - A layout that wraps whatever layout the host resolves (the root layout and the four group
 *   layouts) carries `compose: { wrapper, specifier }` (`COMPOSED_ROUTES`): a project override
 *   of it is composed with that wrapper by the generated host instead of replacing it.
 *
 * A file is a route when its name is `<kind stem>.{tsx,ts}` (`page.tsx`,
 * `route.ts`, `icon2.tsx`, ...). Directories starting with `_` hold route
 * helpers (`_internal/`) and are skipped, as Next.js skips private folders.
 * A file whose name has another dot (`layout.ppr.tsx`) is a variant, never a
 * manifest entry.
 *
 * Usage:
 *   node scripts/build/routes-manifest.mjs           write both files
 *   node scripts/build/routes-manifest.mjs --check   exit 1 when either is stale
 *
 * @module core/scripts/build/routes-manifest
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { kindForFileStem } from './registry/host/facade-emitter.mjs'
import { projectFiles } from './safe-fs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Where core's route modules live. */
export const ROUTES_DIR = join(HERE, '../../src/routes')

/** The package subpath every route module is exported under. */
export const ROUTES_SUBPATH = '@nextsparkjs/core/routes'

const ROUTE_EXTENSIONS = ['tsx', 'ts']

/**
 * Variant files by Next.js mode: `{ mode: { variant file: target it replaces } }`.
 * The variant must exist and the target must be a manifest entry.
 */
export const VARIANT_FILES = Object.freeze({
  cacheComponents: Object.freeze({
    'layout.ppr.tsx': 'layout.tsx',
    '(auth)/layout.cc.tsx': '(auth)/layout.tsx',
    '(public)/layout.cc.tsx': '(public)/layout.tsx',
    'superadmin/layout.cc.tsx': 'superadmin/layout.tsx',
    'devtools/layout.cc.tsx': 'devtools/layout.tsx',
    'dashboard/layout.cc.tsx': 'dashboard/layout.tsx',
    '(auth)/login/page.cc.tsx': '(auth)/login/page.tsx',
    '(auth)/signup/page.cc.tsx': '(auth)/signup/page.tsx',
    '(public)/docs/[section]/[page]/page.cc.tsx': '(public)/docs/[section]/[page]/page.tsx',
    'superadmin/docs/[section]/[page]/page.cc.tsx': 'superadmin/docs/[section]/[page]/page.tsx',
  }),
})

/**
 * Layouts that a project override is composed with (target -> wrapper): the generated host writes
 * `export default wrapper(Template)` for a project layout at that target, so the override renders
 * inside what core's layout provides (providers, message scopes) instead of replacing it.
 */
export const COMPOSED_ROUTES = Object.freeze({
  'layout.tsx': { wrapper: 'withRootLayout', specifier: `${ROUTES_SUBPATH}/_internal/root-layout` },
  '(auth)/layout.tsx': { wrapper: 'withAuthMessages', specifier: `${ROUTES_SUBPATH}/_internal/auth-layout` },
  '(public)/layout.tsx': { wrapper: 'withPublicMessages', specifier: `${ROUTES_SUBPATH}/_internal/public-layout` },
  'superadmin/layout.tsx': { wrapper: 'withSuperadminGuard', specifier: `${ROUTES_SUBPATH}/_internal/superadmin-layout` },
  'devtools/layout.tsx': { wrapper: 'withDevtoolsGuard', specifier: `${ROUTES_SUBPATH}/_internal/devtools-layout` },
})

/** The composition of a variant, when it differs from its base route's. */
export const VARIANT_COMPOSE = Object.freeze({
  'layout.ppr.tsx': { wrapper: 'withRootLayout', specifier: `${ROUTES_SUBPATH}/_internal/root-layout.ppr` },
  '(auth)/layout.cc.tsx': { wrapper: 'withAuthMessages', specifier: `${ROUTES_SUBPATH}/_internal/auth-layout.cc` },
  '(public)/layout.cc.tsx': { wrapper: 'withPublicMessages', specifier: `${ROUTES_SUBPATH}/_internal/public-layout.cc` },
  'superadmin/layout.cc.tsx': { wrapper: 'withSuperadminGuard', specifier: `${ROUTES_SUBPATH}/_internal/superadmin-layout.cc` },
  'devtools/layout.cc.tsx': { wrapper: 'withDevtoolsGuard', specifier: `${ROUTES_SUBPATH}/_internal/devtools-layout.cc` },
})

/**
 * Files that live next to a route without being one: the API explorer's presets, read as text by the
 * registry build (registry/discovery/api-presets.mjs), and its docs.md.
 */
const ROUTE_DATA_FILES = Object.freeze(['presets.ts'])

function listFiles(dir, base = dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue
      files.push(...listFiles(join(dir, entry.name), base))
    } else if (entry.isFile()) {
      files.push(relative(base, join(dir, entry.name)).split(sep).join('/'))
    }
  }
  return files
}

function splitRouteFile(file) {
  const name = posix.basename(file)
  const dot = name.lastIndexOf('.')
  if (dot === -1 || !ROUTE_EXTENSIONS.includes(name.slice(dot + 1))) return null
  return { stem: name.slice(0, dot), extension: name.slice(dot + 1) }
}

/** The core subpath of a route file (`api/v1/users/route.ts` -> `@nextsparkjs/core/routes/api/v1/users/route`). */
export function specifierForRouteFile(file) {
  return `${ROUTES_SUBPATH}/${file.replace(/\.(tsx|ts)$/, '')}`
}

/**
 * Build the manifest and the variants from the files under `routesDir`.
 *
 * @returns {{ manifest: Array<{kind: string, target: string, specifier: string}>, variants: Record<string, Array<{kind: string, target: string, specifier: string}>> }}
 */
export function buildRoutesManifest(routesDir = ROUTES_DIR) {
  const files = listFiles(routesDir)
  const manifest = []
  const seenTargets = new Map()
  for (const file of files) {
    const parts = splitRouteFile(file)
    if (!parts) continue
    const kind = kindForFileStem(parts.stem)
    if (!kind) continue
    const routeKey = file.replace(/\.(tsx|ts)$/, '')
    if (seenTargets.has(routeKey)) {
      throw new Error(`Two route files for one route: ${seenTargets.get(routeKey)} and ${file}; keep one extension`)
    }
    seenTargets.set(routeKey, file)
    const compose = COMPOSED_ROUTES[file]
    manifest.push({ kind, target: file, specifier: specifierForRouteFile(file), ...(compose ? { compose } : {}) })
  }
  manifest.sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0))

  const variants = {}
  for (const [mode, byFile] of Object.entries(VARIANT_FILES)) {
    variants[mode] = Object.entries(byFile).map(([file, target]) => {
      if (!files.includes(file)) throw new Error(`Variant ${file} (${mode}) is missing from ${routesDir}`)
      const replaced = manifest.find(entry => entry.target === target)
      if (!replaced) throw new Error(`Variant ${file} (${mode}) replaces ${target}, which is not a core route`)
      const compose = VARIANT_COMPOSE[file] ?? replaced.compose
      return { kind: replaced.kind, target, specifier: specifierForRouteFile(file), ...(compose ? { compose } : {}) }
    })
  }
  return { manifest, variants }
}

/** Every file under `routesDir` that looks like a route file but is not one the manifest or variants list. */
export function unlistedRouteLikeFiles(routesDir = ROUTES_DIR) {
  const { manifest } = buildRoutesManifest(routesDir)
  const listed = new Set(manifest.map(entry => entry.target))
  for (const byFile of Object.values(VARIANT_FILES)) for (const file of Object.keys(byFile)) listed.add(file)
  return listFiles(routesDir).filter(file => splitRouteFile(file) && !listed.has(file) && !ROUTE_DATA_FILES.includes(posix.basename(file)))
}

export function renderJson(value) {
  return JSON.stringify(value, null, 2) + '\n'
}

function main() {
  const check = process.argv.includes('--check')
  const { manifest, variants } = buildRoutesManifest()
  const outputs = [
    [join(ROUTES_DIR, 'manifest.json'), renderJson(manifest)],
    [join(ROUTES_DIR, 'variants.json'), renderJson(variants)],
  ]
  let stale = 0
  for (const [path, content] of outputs) {
    let current = null
    try {
      current = readFileSync(path, 'utf8')
    } catch {}
    if (current === content) continue
    if (check) {
      console.error(`${relative(process.cwd(), path)} is stale; run node packages/core/scripts/build/routes-manifest.mjs`)
      stale++
    } else {
      projectFiles(ROUTES_DIR).writeFile(path, content, 'utf8')
      console.log(`Wrote ${relative(process.cwd(), path)} (${path.endsWith('manifest.json') ? manifest.length : Object.values(variants).flat().length} entries)`)
    }
  }
  process.exitCode = stale > 0 ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
