/**
 * Core route manifest loader (#203)
 *
 * `@nextsparkjs/core` declares the routes it provides by default in its route manifest, exported
 * as `@nextsparkjs/core/routes/manifest.json` (`dist/routes/manifest.json` in the npm package,
 * `src/routes/manifest.json` in a source checkout): an array of
 * `{ kind, target, specifier }` - the facade emitter's route kind, the path under `src/app`, and
 * the core subpath that implements it. A layout may also carry `compose: { wrapper, specifier }`:
 * a project layout that overrides it is composed with that wrapper (see plan.mjs, render.mjs). The layout of
 * a role-gated area may carry `access: { wrapper, metadata?, handler?, specifier }`: every other page and layout
 * under its URL is composed with `wrapper` (its `generateMetadata` with `metadata`), and every Route Handler's
 * methods with `handler`, whoever provides them (plan.mjs).
 * Every consumer (prepare, --check, the dev watcher, the conformance fixture) reads it through
 * `loadCoreRouteManifest`, so its location and validation live in one place.
 *
 * @module core/scripts/build/registry/host/core-routes
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ROUTE_KINDS } from './facade-emitter.mjs'

/**
 * The package subpaths of the manifest and its variants, as the core's `exports` map publishes
 * them (`./routes/manifest.json` -> `./dist/routes/manifest.json` in the npm package).
 */
export const CORE_ROUTE_MANIFEST_EXPORT = './routes/manifest.json'
/**
 * Per-setting replacements of manifest entries: `{ "cacheComponents": [{ kind, target, specifier }] }`.
 * With the host's `cacheComponents` on, each entry replaces the manifest entry of the same target
 * (today the root layout -> `@nextsparkjs/core/routes/layout.ppr`).
 */
export const CORE_ROUTE_VARIANTS_EXPORT = './routes/variants.json'

/**
 * A source checkout of core (the monorepo) also has the manifest and route modules under
 * `src/routes`, of which `dist/routes` is the build output; there the source wins, so a stale or
 * missing build never decides the host. The published package does not ship `src/routes`.
 */
const SOURCE_ROUTES = 'src/routes'

/** The package subpath prefix of core route modules. */
export const CORE_ROUTES_SPECIFIER = '@nextsparkjs/core/routes/'

const MODULE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js', 'mjs']

/** Thrown when the manifest exists but cannot be used; carries every problem found. */
export class CoreRouteManifestError extends Error {
  constructor(path, problems) {
    super(`The core route manifest ${path} is invalid:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'CoreRouteManifestError'
    this.problems = problems
  }
}

/**
 * Resolve a subpath through a package's `exports` map, as Node does for the `import` condition:
 * an exact key first, then `*` patterns (longest prefix wins); a target may be a string or a
 * conditions object (`import`, `default`, `node`, `require`; `types` is never code). Returns an
 * absolute path, or null when the package does not export the subpath.
 */
export function resolvePackageExport(packageRoot, subpath) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  const exportsMap = manifest.exports
  if (!exportsMap || typeof exportsMap !== 'object') return null
  const pick = target => {
    if (typeof target === 'string') return target
    if (!target || typeof target !== 'object' || Array.isArray(target)) return null
    for (const condition of ['import', 'node', 'default', 'require']) {
      const picked = pick(target[condition])
      if (picked) return picked
    }
    return null
  }
  let target = pick(exportsMap[subpath])
  if (!target) {
    const patterns = Object.keys(exportsMap)
      .filter(key => key.includes('*'))
      .map(key => ({ key, prefix: key.slice(0, key.indexOf('*')), suffix: key.slice(key.indexOf('*') + 1) }))
      .filter(({ prefix, suffix }) => subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length)
      .sort((a, b) => b.prefix.length - a.prefix.length)
    for (const { key, prefix, suffix } of patterns) {
      const picked = pick(exportsMap[key])
      if (picked) {
        target = picked.replaceAll('*', subpath.slice(prefix.length, subpath.length - suffix.length))
        break
      }
    }
  }
  if (!target || !target.startsWith('./') || target.split('/').includes('..')) return null
  return join(packageRoot, target)
}

function sourceOrExport(coreRoot, sourceName, subpath) {
  const source = join(coreRoot, SOURCE_ROUTES, sourceName)
  if (isFile(source)) return source
  const exported = resolvePackageExport(coreRoot, subpath)
  return exported && isFile(exported) ? exported : null
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

/** The core route manifest's file (source checkout first, else the package export), or null. */
export function coreRouteManifestPath(coreRoot) {
  return sourceOrExport(coreRoot, 'manifest.json', CORE_ROUTE_MANIFEST_EXPORT)
}

/** The core route variants' file, or null when the core ships none. */
export function coreRouteVariantsPath(coreRoot) {
  return sourceOrExport(coreRoot, 'variants.json', CORE_ROUTE_VARIANTS_EXPORT)
}

/** Whether the installed core ships a route manifest, i.e. can generate the host. */
export function hasCoreRouteManifest(coreRoot) {
  return coreRouteManifestPath(coreRoot) !== null
}

/**
 * The file of a core route module: its source in a source checkout, else what the package exports
 * for the specifier's subpath (`./routes/*` -> `./dist/routes/*.js`).
 */
export function resolveCoreRouteFile(coreRoot, specifier) {
  if (!specifier.startsWith(CORE_ROUTES_SPECIFIER)) return null
  const subpath = specifier.slice(CORE_ROUTES_SPECIFIER.length)
  for (const extension of MODULE_EXTENSIONS) {
    const candidate = join(coreRoot, SOURCE_ROUTES, `${subpath}.${extension}`)
    if (isFile(candidate)) return candidate
  }
  const exported = resolvePackageExport(coreRoot, `./routes/${subpath}`)
  return exported && isFile(exported) ? exported : null
}

/**
 * The targets core protects from being replaced by a plugin or project file: `PROTECTED_PATHS`
 * of `@nextsparkjs/core/config/protected-paths` (`app/<target>`; a key ending in `/` protects
 * everything under it). Any protection level counts: a generated file replaces a route module
 * whole, so it cannot keep "render" or "metadata" protection of a part of it.
 * Returns a predicate; a core without the module protects nothing beyond the manifest's flags.
 */
export async function loadProtectedTargets(coreRoot) {
  const module = join(coreRoot, 'dist/config/protected-paths.js')
  const none = () => false
  none.level = () => null
  if (!existsSync(module)) return none
  const { PROTECTED_PATHS = {}, ProtectionLevel = {} } = await import(pathToFileURL(module).href)
  const noneLevel = ProtectionLevel.NONE ?? 'none'
  const entries = Object.entries(PROTECTED_PATHS)
    .filter(([, level]) => level !== noneLevel)
    .map(([path, level]) => [path.replace(/^app\//, ''), level])
  const levelOf = target => entries.find(([path]) => (path.endsWith('/') ? target.startsWith(path) : target === path))?.[1] ?? null
  const isProtected = target => levelOf(target) !== null
  /** The protection level of a target (`protected_all`, `protected_render`, `protected_metadata`), or null. */
  isProtected.level = levelOf
  return isProtected
}

function validateEntries(entries) {
  const problems = []
  if (!Array.isArray(entries)) return ['expected an array of { kind, target, specifier }']
  const targets = new Set()
  entries.forEach((entry, index) => {
    const at = `entry ${index}${entry?.target ? ` (${entry.target})` : ''}`
    if (!entry || typeof entry !== 'object') {
      problems.push(`${at}: not an object`)
      return
    }
    if (!ROUTE_KINDS.includes(entry.kind)) problems.push(`${at}: kind ${JSON.stringify(entry.kind)} is not one of ${ROUTE_KINDS.join(', ')}`)
    if (typeof entry.target !== 'string' || entry.target === '' || isAbsolute(entry.target) || entry.target.includes('\\') || entry.target.split('/').some(part => part === '..' || part === '.' || part === '')) {
      problems.push(`${at}: target must be a relative path under src/app with forward slashes`)
    } else if (targets.has(entry.target)) {
      problems.push(`${at}: target listed twice`)
    } else {
      targets.add(entry.target)
    }
    if (typeof entry.specifier !== 'string' || entry.specifier === '') problems.push(`${at}: specifier must be a non-empty string`)
    if ('protected' in entry && typeof entry.protected !== 'boolean') problems.push(`${at}: protected must be a boolean`)
    for (const key of ['compose', 'access']) {
      if (!(key in entry)) continue
      const wrapping = entry[key]
      if (entry.kind !== 'layout') problems.push(key === 'compose' ? `${at}: only a layout can be composed` : `${at}: only a layout can declare access`)
      if (!wrapping || typeof wrapping !== 'object' || Array.isArray(wrapping)) {
        problems.push(`${at}: ${key} must be { wrapper, specifier }`)
      } else {
        if (typeof wrapping.wrapper !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(wrapping.wrapper)) problems.push(`${at}: ${key}.wrapper must be an identifier`)
        // A package subpath (core's `@nextsparkjs/core/routes/...`, or a fixture core's own alias), never a path
        if (typeof wrapping.specifier !== 'string' || !/^@?[A-Za-z0-9][^\s'"`\\]*$/.test(wrapping.specifier) || wrapping.specifier.split('/').includes('..')) {
          problems.push(`${at}: ${key}.specifier must be a package subpath (such as ${CORE_ROUTES_SPECIFIER}_internal/root-layout)`)
        }
        for (const optional of key === 'access' ? ['metadata', 'handler'] : []) {
          if (optional in wrapping && (typeof wrapping[optional] !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(wrapping[optional]))) problems.push(`${at}: access.${optional} must be an identifier`)
        }
        const known = key === 'access' ? ['wrapper', 'specifier', 'metadata', 'handler'] : ['wrapper', 'specifier']
        const unknown = Object.keys(wrapping).filter(name => !known.includes(name))
        if (unknown.length > 0) problems.push(`${at}: ${key} has unknown keys ${unknown.join(', ')}`)
      }
    }
  })
  return problems
}

/**
 * Load and validate the core route manifest.
 *
 * @param {object} input
 * @param {string} input.coreRoot - the core package directory
 * @param {object[]} [input.entries] - the manifest entries, instead of reading the file (fixtures)
 * @param {string} [input.manifestPath] - where the entries come from (diagnostics, input hash)
 * @param {(specifier: string) => string|null} [input.resolveFile] - specifier -> source file
 * @param {(target: string) => boolean} [input.isProtected] - core's protected targets
 * @param {boolean} [input.cacheComponents] - the host's setting: true applies the `cacheComponents` variants;
 *   false or unknown (undefined) keeps the manifest entries
 * @param {object} [input.variants] - the variants, instead of reading variants.json (fixtures)
 * @returns {Promise<null | { path: string, hash: string, routes: object[], variantsApplied: string[] }>} null when the core ships no manifest
 */
export async function loadCoreRouteManifest({ coreRoot, entries, manifestPath, resolveFile, isProtected, cacheComponents, variants } = {}) {
  const path = manifestPath ?? coreRouteManifestPath(coreRoot) ?? 'routes/manifest.json'
  let raw
  if (entries === undefined) {
    if (!isFile(path)) return null
    raw = readFileSync(path, 'utf8')
    try {
      entries = JSON.parse(raw)
    } catch (error) {
      throw new CoreRouteManifestError(path, [`not valid JSON (${error.message})`])
    }
  } else {
    raw = JSON.stringify(entries)
  }
  const problems = validateEntries(entries)
  if (problems.length > 0) throw new CoreRouteManifestError(path, problems)

  // Variants: validated whatever the setting, applied only with cacheComponents on.
  let variantsRaw = ''
  const variantsFile = variants === undefined && coreRoot ? coreRouteVariantsPath(coreRoot) : null
  if (variantsFile) {
    variantsRaw = readFileSync(variantsFile, 'utf8')
    try {
      variants = JSON.parse(variantsRaw)
    } catch (error) {
      throw new CoreRouteManifestError(variantsFile, [`not valid JSON (${error.message})`])
    }
  } else if (variants !== undefined) {
    variantsRaw = JSON.stringify(variants)
  }
  const variantsPath = variantsFile ?? 'routes/variants.json'
  if (variants !== undefined) {
    if (!variants || typeof variants !== 'object' || Array.isArray(variants)) throw new CoreRouteManifestError(variantsPath, ['expected { "cacheComponents": [ ... ] }'])
    const unknown = Object.keys(variants).filter(key => key !== 'cacheComponents')
    const variantProblems = [...unknown.map(key => `unknown setting "${key}"`), ...validateEntries(variants.cacheComponents ?? [])]
    const targets = new Set(entries.map(entry => entry.target))
    for (const variant of variants.cacheComponents ?? []) {
      const base = entries.find(entry => entry.target === variant?.target)
      if (!targets.has(variant?.target)) variantProblems.push(`${variant?.target}: replaces no manifest entry`)
      else if (base.kind !== variant.kind) variantProblems.push(`${variant.target}: kind ${variant.kind} differs from the manifest's ${base.kind}`)
    }
    if (variantProblems.length > 0) throw new CoreRouteManifestError(variantsPath, variantProblems)
  }
  const variantsApplied = []
  if (cacheComponents === true && variants?.cacheComponents?.length) {
    const byTarget = new Map(variants.cacheComponents.map(variant => [variant.target, variant]))
    entries = entries.map(entry => {
      const variant = byTarget.get(entry.target)
      if (!variant) return entry
      variantsApplied.push(entry.target)
      // A variant never drops the area's access check of the entry it replaces.
      const access = variant.access ?? entry.access
      return { ...variant, protected: entry.protected === true || variant.protected === true, ...(access ? { access } : {}) }
    })
  }

  const resolve = resolveFile ?? (specifier => resolveCoreRouteFile(coreRoot, specifier))
  const protectedTarget = isProtected ?? (await loadProtectedTargets(coreRoot))
  const routes = []
  for (const entry of entries) {
    const file = resolve(entry.specifier)
    if (!file) problems.push(`${entry.target}: no module found for ${entry.specifier}`)
    const composeFile = entry.compose ? resolve(entry.compose.specifier) : null
    if (entry.compose && !composeFile) problems.push(`${entry.target}: no module found for ${entry.compose.specifier}`)
    const accessFile = entry.access ? resolve(entry.access.specifier) : null
    if (entry.access && !accessFile) problems.push(`${entry.target}: no module found for ${entry.access.specifier}`)
    routes.push({
      kind: entry.kind,
      target: entry.target,
      specifier: entry.specifier,
      file,
      protected: entry.protected === true || protectedTarget(entry.target),
      ...(entry.protected === true || protectedTarget(entry.target)
        ? { protectionLevel: entry.protected === true ? 'protected_all' : protectedTarget.level?.(entry.target) ?? 'protected_all' }
        : {}),
      ...(entry.compose ? { compose: { ...entry.compose, file: composeFile } } : {}),
      ...(entry.access ? { access: { ...entry.access, file: accessFile } } : {}),
    })
  }
  if (problems.length > 0) throw new CoreRouteManifestError(path, problems)
  const hash = createHash('sha256').update(raw).update('\0').update(variantsRaw).update('\0').update(String(cacheComponents)).digest('hex')
  return { path, hash, routes, variantsApplied }
}
