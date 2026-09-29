/**
 * Host route plan (#203)
 *
 * Which module implements each `src/app` route file of the generated host. Three layers, in
 * precedence order core < plugin < project:
 *
 * - core: the routes of the core route manifest (`core-routes.mjs`);
 * - plugin: `plugins/<name>/templates/**` (same target as the file's path) and
 *   `plugins/<name>/api/**` (target `api/plugins/<name>/**`);
 * - project: `templates/**` (same path) and `api/**` (target `api/**`).
 *
 * A higher layer replaces a lower one at the same route file (same directory, file stem and
 * cache-mode suffix). Everything else that would put two modules at one route is a collision,
 * reported with both sources: two files of one layer, two plugins, a plugin or project file
 * over a protected core route, and a page and a Route Handler left in one directory.
 *
 * Pure apart from reading the source directories; the result is sorted by target (code unit
 * order, independent of locale) so generation is deterministic.
 *
 * @module core/scripts/build/registry/host/plan
 */

import { readdirSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

import { kindForFileStem } from './facade-emitter.mjs'

export const PLAN_DIAGNOSTICS = Object.freeze({
  COLLISION: 'NS_HOST_ROUTE_COLLISION',
  PROTECTED: 'NS_HOST_PROTECTED_ROUTE',
  PAGE_ROUTE_CONFLICT: 'NS_HOST_PAGE_ROUTE_CONFLICT',
  SOURCE_SYMLINK: 'NS_HOST_SOURCE_SYMLINK',
})

export const DEFAULT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

const LAYER_RANK = { core: 0, plugin: 1, project: 2 }

/** Thrown with every diagnostic of a plan that cannot be generated. */
export class HostPlanError extends Error {
  constructor(diagnostics) {
    super(`Cannot plan the generated src/app:\n${diagnostics.map(d => `  - [${d.code}] ${d.message}`).join('\n')}`)
    this.name = 'HostPlanError'
    this.diagnostics = diagnostics
  }
}

const toPosix = path => path.split(sep).join('/')
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Code-unit order: the same on every machine and locale. */
export const compareTargets = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function sourceFilePattern(modes, extensions) {
  const mode = modes.length > 0 ? `(?:\\.(?<mode>${modes.map(escape).join('|')}))?` : ''
  return new RegExp(`^(?<name>[a-z-]+\\d?)${mode}\\.(?<ext>${extensions.map(escape).join('|')})$`)
}

/** Every file under `dir` (relative, posix), and the symlinks found, without following them. */
function walk(dir, base = dir, found = { files: [], symlinks: [] }) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return found
    throw error
  }
  for (const entry of entries.sort((a, b) => compareTargets(a.name, b.name))) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) found.symlinks.push(toPosix(relative(base, path)))
    else if (entry.isDirectory()) walk(path, base, found)
    else if (entry.isFile()) found.files.push(toPosix(relative(base, path)))
  }
  return found
}

/** The route files of one source surface (a `templates/` or `api/` directory). */
function surfaceRoutes({ dir, importBase, surface, toTarget, layer, label, pattern, diagnostics }) {
  const { files, symlinks } = walk(dir)
  for (const link of symlinks) {
    const match = pattern.exec(link.split('/').at(-1))
    if (match && kindForFileStem(match.groups.name)) {
      diagnostics.push({
        code: PLAN_DIAGNOSTICS.SOURCE_SYMLINK,
        message: `${label}/${surface}/${link} is a symlink; route sources must be regular files inside the project`,
      })
    }
  }
  const routes = []
  for (const path of files) {
    const match = pattern.exec(path.split('/').at(-1))
    const kind = match && kindForFileStem(match.groups.name)
    if (!kind) continue
    const target = toTarget(path)
    const withoutExtension = path.slice(0, -(match.groups.ext.length + 1))
    routes.push({
      kind,
      target,
      mode: match.groups.mode ?? null,
      specifier: `${importBase}/${surface}/${withoutExtension}`,
      file: join(dir, path),
      layer,
      source: `${label}/${surface}/${path}`,
    })
  }
  return routes
}

/** The key two files compete for: directory, stem and cache mode (the extension is Next's to pick). */
function slotOf(route) {
  const directory = posix.dirname(route.target)
  const name = posix.basename(route.target)
  const stem = name.slice(0, name.indexOf('.'))
  return `${directory}/${stem}${route.mode ? `.${route.mode}` : ''}`
}

function describe(route) {
  return route.layer === 'core' ? `core route ${route.specifier}` : route.source
}

/**
 * Resolve the route plan.
 *
 * @param {object} input
 * @param {object[]} input.coreRoutes - `loadCoreRouteManifest(...).routes`
 * @param {{ name: string, root: string, importBase: string }[]} [input.plugins] - enabled plugins
 * @param {{ root: string, importBase?: string, label?: string }} input.project - project source root
 * @param {string[]} [input.modes] - cache-mode file suffixes the host understands (`page.isr.tsx`)
 * @param {string[]} [input.extensions] - source extensions
 * @returns {{ routes: object[], diagnostics: object[] }}
 */
export function planHost({ coreRoutes, plugins = [], project, modes = [], extensions = DEFAULT_EXTENSIONS }) {
  const diagnostics = []
  const pattern = sourceFilePattern(modes, extensions)
  const candidates = coreRoutes.map(route => ({ ...route, mode: route.mode ?? null, layer: 'core', source: `core route ${route.specifier}` }))

  for (const plugin of [...plugins].sort((a, b) => compareTargets(a.name, b.name))) {
    const label = `plugins/${plugin.name}`
    candidates.push(
      ...surfaceRoutes({ dir: join(plugin.root, 'templates'), importBase: plugin.importBase, surface: 'templates', toTarget: path => path, layer: 'plugin', label, pattern, diagnostics }),
      ...surfaceRoutes({ dir: join(plugin.root, 'api'), importBase: plugin.importBase, surface: 'api', toTarget: path => `api/plugins/${plugin.name}/${path}`, layer: 'plugin', label, pattern, diagnostics })
    )
  }
  const projectBase = project.importBase ?? '@'
  const projectLabel = project.label ?? '.'
  const projectRoutes = [
    ...surfaceRoutes({ dir: join(project.root, 'templates'), importBase: projectBase, surface: 'templates', toTarget: path => path, layer: 'project', label: projectLabel, pattern, diagnostics }),
    ...surfaceRoutes({ dir: join(project.root, 'api'), importBase: projectBase, surface: 'api', toTarget: path => `api/${path}`, layer: 'project', label: projectLabel, pattern, diagnostics }),
  ]
  for (const route of projectRoutes) route.source = route.source.replace(/^\.\//, '')
  candidates.push(...projectRoutes)

  // Group by slot; within a slot the highest layer wins, and a tie is a collision.
  const bySlot = new Map()
  for (const route of candidates) {
    const slot = slotOf(route)
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    bySlot.get(slot).push(route)
  }

  const routes = []
  for (const [, contenders] of [...bySlot.entries()].sort(([a], [b]) => compareTargets(a, b))) {
    const ranked = [...contenders].sort((a, b) => LAYER_RANK[b.layer] - LAYER_RANK[a.layer] || compareTargets(a.source, b.source))
    const [winner, ...rest] = ranked
    const tied = rest.filter(route => route.layer === winner.layer)
    for (const other of tied) {
      diagnostics.push({
        code: PLAN_DIAGNOSTICS.COLLISION,
        target: winner.target,
        sources: [winner.source, other.source],
        message:
          winner.layer === 'plugin' && other.layer === 'plugin'
            ? `src/app/${winner.target}: two plugins provide this route: ${describe(winner)} and ${describe(other)}`
            : `src/app/${winner.target}: two ${winner.layer} files provide this route: ${describe(winner)} and ${describe(other)}`,
      })
    }
    const core = ranked.find(route => route.layer === 'core')
    if (core?.protected && winner !== core) {
      for (const route of ranked.filter(route => route.layer !== 'core')) {
        diagnostics.push({
          code: PLAN_DIAGNOSTICS.PROTECTED,
          target: core.target,
          sources: [core.source, route.source],
          message: `src/app/${core.target}: ${describe(route)} would replace the protected ${describe(core)}; protected core routes cannot be overridden`,
        })
      }
      routes.push(core)
      continue
    }
    const lower = ranked.find(route => LAYER_RANK[route.layer] < LAYER_RANK[winner.layer])
    routes.push(lower ? { ...winner, overrides: lower.source } : winner)
  }

  // Next.js refuses a page and a Route Handler for the same path.
  const byDirectory = new Map()
  for (const route of routes) {
    if (route.kind !== 'page' && route.kind !== 'route') continue
    const key = `${posix.dirname(route.target)}|${route.mode ?? ''}`
    if (!byDirectory.has(key)) byDirectory.set(key, [])
    byDirectory.get(key).push(route)
  }
  for (const group of byDirectory.values()) {
    const page = group.find(route => route.kind === 'page')
    const handler = group.find(route => route.kind === 'route')
    if (page && handler) {
      diagnostics.push({
        code: PLAN_DIAGNOSTICS.PAGE_ROUTE_CONFLICT,
        target: handler.target,
        sources: [page.source, handler.source],
        message: `src/app/${posix.dirname(handler.target)}: a page (${describe(page)}) and a Route Handler (${describe(handler)}) resolve to the same path`,
      })
    }
  }

  const clean = routes.map(({ layer, ...route }) => ({ ...route, origin: layer }))
  return { routes: clean.sort((a, b) => compareTargets(a.target, b.target)), diagnostics }
}

/** `planHost`, throwing a `HostPlanError` when there is any diagnostic. */
export function resolveHostPlan(input) {
  const { routes, diagnostics } = planHost(input)
  if (diagnostics.length > 0) throw new HostPlanError(diagnostics)
  return routes
}

// Exposed for tests of the file-name grammar.
export { sourceFilePattern }
