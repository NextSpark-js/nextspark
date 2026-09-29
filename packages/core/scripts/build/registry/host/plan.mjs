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
 * Composition instead of replacement (stage 4):
 * - a project or plugin layout over a core layout that declares `compose` (the root layout and the
 *   group layouts) keeps core's wrapper around it (`route.compose`), even over a route protected at
 *   the render or metadata level: core's wrapper still runs;
 * - a project or plugin page over a per-entity route that accepts a template
 *   (`entityRoute.acceptsTemplate`) becomes that route's template (`route.template`), and the
 *   template of a public item page named after its old catch-all path (`entityRoute.absorbs`) is
 *   absorbed the same way instead of being a route of its own;
 * - `webhooks` (nextspark.config.ts `billing.webhookExtensions`) replace the core webhook routes
 *   with a composed route (`route.webhook`).
 *
 * API namespaces: core owns /api/v1/**, the project's `api/` is served at /api/<path> and a plugin's
 * at /api/plugins/<plugin>/**. A project `api/` route in /api/v1/** or /api/plugins/**, and a plugin
 * route outside /api/plugins/<its-name>/**, are diagnostics. The project's `templates/api/v1/...` and
 * `templates/api/plugins/<plugin>/...` may only REPLACE a route core or that plugin already serves
 * (a route added there is a diagnostic): a project never creates routes under /api/v1 or /api/plugins.
 *
 * Next.js refuses two pages for one URL and two dynamic segments of the same kind with different
 * names at one level; both are diagnostics here, with the routes named, instead of a build failure.
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
  API_NAMESPACE: 'NS_HOST_API_NAMESPACE',
  URL_CONFLICT: 'NS_HOST_URL_CONFLICT',
  DYNAMIC_SEGMENT_CONFLICT: 'NS_HOST_DYNAMIC_SEGMENT_CONFLICT',
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
function surfaceRoutes({ dir, importBase, surface, toTarget, layer, label, pattern, diagnostics, namespace }) {
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
    const forbidden = namespace?.(target, path, match.groups.mode ?? null)
    if (forbidden) {
      diagnostics.push({ code: PLAN_DIAGNOSTICS.API_NAMESPACE, target, sources: [`${label}/${surface}/${path}`], message: `src/app/${target}: ${label}/${surface}/${path} ${forbidden}` })
      continue
    }
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
  return route.layer === 'core' && route.specifier ? `core route ${route.specifier}` : route.source
}

const API_V1 = /^api\/v1(\/|$)/
const API_PLUGINS = /^api\/plugins(\/|$)/
const PROJECT_API_HINT =
  'would be served in a namespace it does not own: core owns /api/v1/**, the project\'s api/ is served at /api/<path> and plugins at /api/plugins/<plugin>/**. ' +
  'Move it outside them, or to templates/api/v1/... to replace an existing core route on purpose'
const PROJECT_TEMPLATE_V1_HINT =
  'replaces no core route: templates/api/v1/... may only override a route core has at that path (core owns /api/v1/**, so it cannot add routes there); put a new route in api/ (served at /api/<path>)'
const PROJECT_PLUGINS_HINT = 'would be served under /api/plugins/**, which belongs to the plugins (each serves only /api/plugins/<its-name>/**); a project cannot create routes there (templates/api/plugins/<plugin>/... may only replace a route that plugin already serves)'
const pluginApiHint = name =>
  `would be served outside /api/plugins/${name}/**, the only namespace plugin "${name}" may serve; a plugin serves its API from api/ (at /api/plugins/${name}/**) or from templates/api/plugins/${name}/**`
const protectionOf = route => (route.protected ? route.protectionLevel ?? 'protected_all' : null)

/** The URL path segments of a route file's directory: route groups and parallel slots are not part of it. */
function urlSegments(target) {
  return posix.dirname(target).split('/').filter(part => part !== '.' && !/^\(.*\)$/.test(part) && !part.startsWith('@'))
}

function dynamicKind(segment) {
  if (/^\[\[\.\.\.[^\]]+\]\]$/.test(segment)) return 'optional catch-all'
  if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return 'catch-all'
  if (/^\[[^\].]+\]$/.test(segment)) return 'dynamic'
  return null
}

/**
 * Resolve the route plan.
 *
 * @param {object} input
 * @param {object[]} input.coreRoutes - `loadCoreRouteManifest(...).routes`
 * @param {object[]} [input.entityRoutes] - `planEntityRoutes(...).routes`: per-entity route candidates
 * @param {{ name: string, root: string, importBase: string }[]} [input.plugins] - enabled plugins
 * @param {{ root: string, importBase?: string, label?: string }} input.project - project source root
 * @param {string[]} [input.modes] - cache-mode file suffixes the host understands (`page.isr.tsx`)
 * @param {string[]} [input.extensions] - source extensions
 * @param {Record<string, object>} [input.webhooks] - composed webhook routes by target (`webhookRoutes`)
 * @returns {{ routes: object[], diagnostics: object[] }}
 */
export function planHost({ coreRoutes, entityRoutes = [], plugins = [], project, modes = [], extensions = DEFAULT_EXTENSIONS, webhooks = {} }) {
  const diagnostics = []
  const pattern = sourceFilePattern(modes, extensions)
  const candidates = [
    ...coreRoutes.map(route => ({ ...route, mode: route.mode ?? null, layer: 'core', source: `core route ${route.specifier}` })),
    ...entityRoutes.map(route => ({ ...route, mode: route.mode ?? null, layer: 'core' })),
  ]

  const slotKey = (target, mode) => slotOf({ target, mode })

  for (const plugin of [...plugins].sort((a, b) => compareTargets(a.name, b.name))) {
    const label = `plugins/${plugin.name}`
    candidates.push(
      ...surfaceRoutes({ dir: join(plugin.root, 'templates'), importBase: plugin.importBase, surface: 'templates', toTarget: path => path, layer: 'plugin', label, pattern, diagnostics, namespace: target => (target.startsWith('api/') && !target.startsWith(`api/plugins/${plugin.name}/`) ? pluginApiHint(plugin.name) : null) }),
      ...surfaceRoutes({ dir: join(plugin.root, 'api'), importBase: plugin.importBase, surface: 'api', toTarget: path => `api/plugins/${plugin.name}/${path}`, layer: 'plugin', label, pattern, diagnostics })
    )
  }
  // The routes core and the plugins already serve: what a project's templates/api/... may replace, never add to
  const servedSlots = new Set(candidates.map(route => slotOf(route)))
  const projectBase = project?.importBase ?? '@'
  const projectLabel = project?.label ?? '.'
  const projectRoutes = !project?.root ? [] : [
    ...surfaceRoutes({ dir: join(project.root, 'templates'), importBase: projectBase, surface: 'templates', toTarget: path => path, layer: 'project', label: projectLabel, pattern, diagnostics,
      namespace: (target, path, mode) => (API_PLUGINS.test(target) && !servedSlots.has(slotKey(target, mode)) ? PROJECT_PLUGINS_HINT : API_V1.test(target) && !servedSlots.has(slotKey(target, mode)) ? PROJECT_TEMPLATE_V1_HINT : null) }),
    ...surfaceRoutes({ dir: join(project.root, 'api'), importBase: projectBase, surface: 'api', toTarget: path => `api/${path}`, layer: 'project', label: projectLabel, pattern, diagnostics, namespace: target => (API_V1.test(target) || API_PLUGINS.test(target) ? PROJECT_API_HINT : null) }),
  ]
  for (const route of projectRoutes) route.source = route.source.replace(/^\.\//, '')
  candidates.push(...projectRoutes)
  for (const [target, webhook] of Object.entries(webhooks)) {
    candidates.push({ kind: 'route', target, mode: null, specifier: webhook.specifier, file: webhook.file, layer: 'project', source: webhook.source, webhook, configured: true })
  }

  // The templates of public item pages are named after the catch-all path they replaced; the entity route
  // that serves the item takes them as its template instead of emitting them as routes of their own.
  const absorbing = new Map()
  for (const route of candidates) {
    if (route.entityRoute?.absorbs) absorbing.set(slotOf({ target: route.entityRoute.absorbs, mode: null }), route)
  }

  // Group by slot; within a slot the highest layer wins, and a tie is a collision.
  const bySlot = new Map()
  for (const route of candidates) {
    const slot = slotOf(route)
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    bySlot.get(slot).push(route)
  }

  const rank = contenders => [...contenders].sort((a, b) => LAYER_RANK[b.layer] - LAYER_RANK[a.layer] || compareTargets(a.source, b.source))
  const reportTies = (winner, rest) => {
    for (const other of rest.filter(route => route.layer === winner.layer)) {
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
  }

  const absorbed = new Map() // entity route target -> the template that replaced its default
  for (const [slot, entityRoute] of absorbing) {
    const inSlot = bySlot.get(slot) ?? []
    // A core route of its own at that path is not a template: leave it alone.
    if (inSlot.length === 0 || inSlot.some(route => route.layer === 'core')) continue
    const contenders = inSlot
    const [winner, ...rest] = rank(contenders)
    reportTies(winner, rest)
    absorbed.set(entityRoute.target, winner)
    bySlot.delete(slot)
  }

  const routes = []
  for (const [, contenders] of [...bySlot.entries()].sort(([a], [b]) => compareTargets(a, b))) {
    const ranked = rank(contenders)
    const [winner, ...rest] = ranked
    reportTies(winner, rest)
    const core = ranked.find(route => route.layer === 'core')
    const composable = Boolean(core?.compose) && protectionOf(core) !== 'protected_all' && winner.kind === 'layout'
    if (core?.protected && winner !== core && !winner.configured && !composable) {
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
    let chosen = lower ? { ...winner, overrides: lower.source } : winner
    if (winner === core && core.entityRoute && absorbed.has(core.target)) {
      const template = absorbed.get(core.target)
      chosen = { ...core, template: { specifier: template.specifier, file: template.file, source: template.source } }
    } else if (winner !== core && core?.compose) {
      chosen = { ...chosen, compose: core.compose, composeOf: core.specifier, composeOfFile: core.file, composeProtection: protectionOf(core) }
    } else if (winner !== core && core?.entityRoute?.acceptsTemplate) {
      chosen = { ...core, template: { specifier: winner.specifier, file: winner.file, source: winner.source }, overrides: core.source }
    }
    routes.push(chosen)
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
  diagnostics.push(...urlConflicts(routes))

  const clean = routes.map(({ layer, ...route }) => ({ ...route, origin: layer }))
  return { routes: clean.sort((a, b) => compareTargets(a.target, b.target)), diagnostics }
}

/**
 * Two routes for one URL (in different route groups) and dynamic segments Next.js cannot tell apart.
 * Only routes without a cache-mode suffix are compared: a `.cc` file is an alternative, not a sibling.
 */
export function urlConflicts(routes) {
  const diagnostics = []
  const urls = new Map()
  const tree = { children: new Map(), dynamic: new Map() }
  for (const route of routes) {
    if ((route.kind !== 'page' && route.kind !== 'route') || route.mode) continue
    const segments = urlSegments(route.target)
    const url = `/${segments.join('/')}`
    if (!urls.has(url)) urls.set(url, [])
    urls.get(url).push(route)

    let node = tree
    for (const segment of segments) {
      const kind = dynamicKind(segment)
      if (kind) {
        const key = kind === 'optional catch-all' || kind === 'catch-all' ? 'catch-all' : 'dynamic'
        const forms = node.dynamic.get(key) ?? new Map()
        node.dynamic.set(key, forms)
        if (!forms.has(segment)) forms.set(segment, [])
        forms.get(segment).push(route)
      }
      if (!node.children.has(segment)) node.children.set(segment, { children: new Map(), dynamic: new Map() })
      node = node.children.get(segment)
    }
  }
  for (const [url, sameUrl] of urls) {
    const files = new Set(sameUrl.map(route => `${posix.dirname(route.target)}|${route.kind}`))
    if (sameUrl.length > 1 && files.size > 1 && new Set(sameUrl.map(route => posix.dirname(route.target))).size > 1) {
      diagnostics.push({
        code: PLAN_DIAGNOSTICS.URL_CONFLICT,
        target: sameUrl[0].target,
        sources: sameUrl.map(route => route.source),
        message: `${url}: ${sameUrl.map(route => `${describe(route)} (src/app/${route.target})`).join(' and ')} resolve to the same URL`,
      })
    }
  }
  const visit = (node, path) => {
    for (const [key, forms] of node.dynamic) {
      const catchAllKinds = new Set([...forms.keys()].map(dynamicKind))
      const bad = key === 'dynamic' ? forms.size > 1 : forms.size > 1 && (new Set([...forms.keys()].map(form => form.replace(/^\[+\.\.\./, '').replace(/\]+$/, ''))).size > 1 || catchAllKinds.size > 1)
      if (bad) {
        const all = [...forms.values()].flat()
        diagnostics.push({
          code: PLAN_DIAGNOSTICS.DYNAMIC_SEGMENT_CONFLICT,
          target: all[0].target,
          sources: all.map(route => route.source),
          message: `${path || '/'}: Next.js cannot tell the dynamic segments ${[...forms.keys()].join(' and ')} apart at one level (${[...new Set(all.map(route => describe(route)))].join(', ')})`,
        })
      }
    }
    for (const [segment, child] of node.children) visit(child, `${path}/${segment}`)
  }
  visit(tree, '')
  return diagnostics
}

/** `planHost`, throwing a `HostPlanError` when there is any diagnostic. */
export function resolveHostPlan(input) {
  const { routes, diagnostics } = planHost(input)
  if (diagnostics.length > 0) throw new HostPlanError(diagnostics)
  return routes
}

// Exposed for tests of the file-name grammar.
export { sourceFilePattern }
