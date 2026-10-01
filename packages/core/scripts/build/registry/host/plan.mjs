/**
 * Host route plan (#203)
 *
 * Which module implements each `src/app` route file of the generated host. Three layers, in
 * precedence order core < plugin < project:
 *
 * - core: the routes of the core route manifest (`core-routes.mjs`);
 * - plugin: `plugins/<name>/templates/**` (same target as the file's path) and
 *   `plugins/<name>/api/**` (target `api/plugins/<name>/**`), only for the capabilities the plugin declares
 *   (`definePlugin({ capabilities })`, see discovery/plugin-capabilities.mjs): pages and layouts need
 *   'web', Route Handlers need 'server'; a file in a surface the plugin did not declare is a diagnostic
 *   naming the plugin, the capability and the file;
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
 *   with a composed route (`route.webhook`);
 * - every page, layout, template and default served under the URL of a core layout that declares `access` (the
 *   /superadmin and /devtools areas), core's, a plugin's or the project's, in any route group, is composed with
 *   that wrapper (`route.access`): it checks the session's role on the server before the segment renders (and before
 *   its `generateMetadata` resolves), an intercepting route (`@modal/(.)superadmin/...`) by the URL it intercepts, and
 *   a Route Handler's methods answer 401 / 403 JSON instead. A metadata file there (icon, opengraph-image, sitemap,
 *   ...) cannot be guarded and is a warning notice (`NS_HOST_AREA_FILE_UNGUARDED`). Only
 *   that layout itself is left out (its message wrapper checks). A layout cannot protect its pages: Next renders
 *   every segment of a route separately, so each one checks.
 *
 * "The template replaces": a project template in another route group that collides with an entity's
 * generated dashboard routes (same URL, or another name for their dynamic segment) takes that URL over;
 * the entity's generated dashboard subtree is dropped and its permission layout moves over the
 * project's tree (`replaceEntityDashboards`, returned as `notices`). A template that only adds a URL
 * coexists with the generated routes.
 *
 * API namespaces: core owns /api/v1/**, the project's `api/` is served at /api/<path> and a plugin's
 * at /api/plugins/<plugin>/**. A project `api/` route in /api/v1/** or /api/plugins/**, and a plugin
 * route outside /api/plugins/<its-name>/**, are diagnostics. The project's `templates/api/v1/...` and
 * `templates/api/plugins/<plugin>/...` may only REPLACE a route core or that plugin already serves
 * (a route added there is a diagnostic): a project never creates routes under /api/v1 or /api/plugins.
 * One exception: `templates/api/v1/<entity>/<rest>`, for an entity of the project, is allowed when `<rest>` mirrors a route
 * core serves under its dynamic `[entity]` (`route.ts`, `[id]/route.ts`, `[id]/child/[childType]/route.ts`, ...): the
 * generated route is the static `/api/v1/<entity>/...`, which Next resolves before `[entity]` (notice ENTITY_API_OVERRIDDEN).
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
import { PLUGIN_DIAGNOSTICS, capabilitiesOf } from '../discovery/plugin-capabilities.mjs'

export const PLAN_DIAGNOSTICS = Object.freeze({
  COLLISION: 'NS_HOST_ROUTE_COLLISION',
  PROTECTED: 'NS_HOST_PROTECTED_ROUTE',
  PAGE_ROUTE_CONFLICT: 'NS_HOST_PAGE_ROUTE_CONFLICT',
  SOURCE_SYMLINK: 'NS_HOST_SOURCE_SYMLINK',
  API_NAMESPACE: 'NS_HOST_API_NAMESPACE',
  URL_CONFLICT: 'NS_HOST_URL_CONFLICT',
  DYNAMIC_SEGMENT_CONFLICT: 'NS_HOST_DYNAMIC_SEGMENT_CONFLICT',
})

/** Information about the plan that is not a problem (printed by prepare, returned by `planHost` as `notices`). */
export const PLAN_NOTICES = Object.freeze({
  ENTITY_ROUTES_REPLACED: 'NS_HOST_ENTITY_ROUTES_REPLACED',
  ENTITY_API_OVERRIDDEN: 'NS_HOST_ENTITY_API_OVERRIDDEN',
  CORE_API_REPLACED: 'NS_HOST_CORE_API_REPLACED',
  AREA_FILE_UNGUARDED: 'NS_HOST_AREA_FILE_UNGUARDED',
})

export const DEFAULT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

const LAYER_RANK = { core: 0, plugin: 1, project: 2 }

/** The route kinds that render a segment's content, and so check an area's access (see the module comment). */
const ACCESS_KINDS = new Set(['page', 'layout', 'template', 'default'])
/** Metadata files: Next serves them as Route Handlers whose output is an image or a fixed document, so no refusal fits them. */
const METADATA_FILE_KINDS = new Set(['sitemap', 'robots', 'manifest', 'icon', 'apple-icon', 'opengraph-image', 'twitter-image'])

/**
 * The URL a route file serves, as segments: route groups and slots dropped, and an intercepting segment
 * (`(.)x`, `(..)x`, `(..)(..)x`, `(...)x`) resolved to the path it intercepts.
 */
function servedUrlSegments(target) {
  const served = []
  for (const segment of urlSegments(target)) {
    const markers = /^((?:\(\.{1,3}\))+)(.*)$/.exec(segment)
    if (!markers) {
      served.push(segment)
      continue
    }
    for (const marker of markers[1].match(/\(\.{1,3}\)/g)) {
      if (marker === '(...)') served.length = 0
      else if (marker === '(..)') served.pop()
    }
    served.push(markers[2])
  }
  return served
}

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
  'replaces no core route: templates/api/v1/... may only override a route core has at that path (core owns /api/v1/**, so it cannot add routes there) or, at templates/api/v1/<entity>/..., a route core serves for every entity (route.ts, [id]/route.ts, [id]/child/[childType]/route.ts, [id]/child/[childType]/[childId]/route.ts) of an entity of this project; put a new route in api/ (served at /api/<path>)'
/** The first segments core serves under `api/v1/` (`users`, `billing`, ...): its API namespaces, never an entity's. */
export const coreApiNamespaces = coreRoutes => new Set(coreRoutes.map(route => /^api\/v1\/([^/[][^/]*)\//.exec(route.target)?.[1]).filter(Boolean))
export const coreApiCollisionHint = name =>
  `replaces no core route: "${name}" is an entity of this project, but core serves its own API under /api/v1/${name}/** (a project entity cannot take that namespace, so templates/api/v1/${name}/... can neither add routes there nor override the entity's API); rename the entity, or override a core route at its exact path`
const ENTITY_API = /^api\/v1\/(?<name>[^/[]+)\/(?<rest>.+)$/
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
 * @param {string[]} [input.entityNames] - `planEntityRoutes(...).entities`: the entities whose `/api/v1/<entity>/...` a project template may override
 * @param {{ name: string, root: string, importBase: string, capabilities?: string[] }[]} [input.plugins] - enabled plugins; a plugin
 *   that declares no `capabilities` is legacy (server + web + build)
 * @param {{ root: string, importBase?: string, label?: string }} input.project - project source root
 * @param {string[]} [input.modes] - cache-mode file suffixes the host understands (`page.isr.tsx`)
 * @param {string[]} [input.extensions] - source extensions
 * @param {Record<string, object>} [input.webhooks] - composed webhook routes by target (`webhookRoutes`)
 * @returns {{ routes: object[], diagnostics: object[], notices: object[] }}
 */
export function planHost({ coreRoutes, entityRoutes = [], entityNames = [], plugins = [], project, modes = [], extensions = DEFAULT_EXTENSIONS, webhooks = {} }) {
  const diagnostics = []
  const pattern = sourceFilePattern(modes, extensions)
  const candidates = [
    ...coreRoutes.map(route => ({ ...route, mode: route.mode ?? null, layer: 'core', source: `core route ${route.specifier}` })),
    ...entityRoutes.map(route => ({ ...route, mode: route.mode ?? null, layer: 'core' })),
  ]

  const slotKey = (target, mode) => slotOf({ target, mode })

  for (const plugin of [...plugins].sort((a, b) => compareTargets(a.name, b.name))) {
    const label = `plugins/${plugin.name}`
    const capabilities = capabilitiesOf(plugin)
    const contributed = [
      ...surfaceRoutes({ dir: join(plugin.root, 'templates'), importBase: plugin.importBase, surface: 'templates', toTarget: path => path, layer: 'plugin', label, pattern, diagnostics, namespace: target => (target.startsWith('api/') && !target.startsWith(`api/plugins/${plugin.name}/`) ? pluginApiHint(plugin.name) : null) }),
      ...surfaceRoutes({ dir: join(plugin.root, 'api'), importBase: plugin.importBase, surface: 'api', toTarget: path => `api/plugins/${plugin.name}/${path}`, layer: 'plugin', label, pattern, diagnostics }),
    ]
    // The host takes only what the plugin declares: pages and layouts need 'web', Route Handlers need 'server'.
    for (const route of contributed) {
      const capability = route.source.startsWith(`${label}/api/`) || route.kind === 'route' ? 'server' : 'web'
      if (capabilities.includes(capability)) {
        candidates.push(route)
        continue
      }
      diagnostics.push({
        code: PLUGIN_DIAGNOSTICS.UNDECLARED,
        target: route.target,
        plugin: plugin.name,
        capability,
        file: route.source,
        sources: [route.source],
        message: `${route.source}: contributes src/app/${route.target}, so plugin "${plugin.name}" needs the "${capability}" capability, but it declares [${capabilities.join(', ')}]`,
      })
    }
  }
  // The routes core and the plugins already serve: what a project's templates/api/... may replace, never add to
  const servedSlots = new Set(candidates.map(route => slotOf(route)))
  const projectBase = project?.importBase ?? '@'
  const projectLabel = project?.label ?? '.'
  // The names core serves its own API under (`api/v1/<name>/...`, `[entity]` is the generic handler): an entity cannot take them
  const coreApiNames = coreApiNamespaces(coreRoutes)
  // `api/v1/<entity>/<rest>` where `<rest>` is a route core serves under `[entity]`: the project's per-entity override
  const entityApiOf = (target, mode) => {
    const match = ENTITY_API.exec(target)
    return match && entityNames.includes(match.groups.name) && !coreApiNames.has(match.groups.name) && servedSlots.has(slotKey(`api/v1/[entity]/${match.groups.rest}`, mode)) ? match.groups.name : null
  }
  const entityApiRefusal = target => {
    const name = ENTITY_API.exec(target)?.groups.name
    return name && entityNames.includes(name) && coreApiNames.has(name) ? coreApiCollisionHint(name) : null
  }
  const projectRoutes = !project?.root ? [] : [
    ...surfaceRoutes({ dir: join(project.root, 'templates'), importBase: projectBase, surface: 'templates', toTarget: path => path, layer: 'project', label: projectLabel, pattern, diagnostics,
      namespace: (target, path, mode) => (API_PLUGINS.test(target) && !servedSlots.has(slotKey(target, mode)) ? PROJECT_PLUGINS_HINT : API_V1.test(target) && !servedSlots.has(slotKey(target, mode)) && !entityApiOf(target, mode) ? entityApiRefusal(target) ?? PROJECT_TEMPLATE_V1_HINT : null) }),
    ...surfaceRoutes({ dir: join(project.root, 'api'), importBase: projectBase, surface: 'api', toTarget: path => `api/${path}`, layer: 'project', label: projectLabel, pattern, diagnostics, namespace: target => (API_V1.test(target) || API_PLUGINS.test(target) ? PROJECT_API_HINT : null) }),
  ]
  for (const route of projectRoutes) route.source = route.source.replace(/^\.\//, '')
  const notices = replaceEntityDashboards(candidates, projectRoutes.filter(route => route.specifier.startsWith(`${projectBase}/templates/`)))
  notices.push(...coreApiNotices(projectRoutes.filter(route => route.specifier.startsWith(`${projectBase}/templates/`) && API_V1.test(route.target) && servedSlots.has(slotOf(route))), candidates))
  notices.push(...entityApiNotices(projectRoutes.filter(route => route.specifier.startsWith(`${projectBase}/templates/`) && !servedSlots.has(slotOf(route)) && entityApiOf(route.target, route.mode))))
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

  const areas = coreRoutes.filter(route => route.access).map(route => ({ target: route.target, url: urlSegments(route.target).join('/'), access: route.access }))
  for (const [index, { access: declared, ...route }] of routes.entries()) {
    // `access` on a core layout declares the area; on a planned route it means "compose with this wrapper".
    const url = servedUrlSegments(route.target).join('/')
    const area = areas.find(candidate => route.target !== candidate.target && (url === candidate.url || url.startsWith(`${candidate.url}/`)))
    routes[index] = area && (ACCESS_KINDS.has(route.kind) || (route.kind === 'route' && area.access.handler)) ? { ...route, access: area.access } : route
    if (area && METADATA_FILE_KINDS.has(route.kind)) {
      notices.push({
        code: PLAN_NOTICES.AREA_FILE_UNGUARDED,
        target: route.target,
        by: [route.source],
        message:
          `src/app/${route.target}: ${route.source} is a metadata file under /${area.url}, which Next serves without the area's role check; ` +
          `it is public whatever the role. Keep area data out of it, or move it outside /${area.url}`,
      })
    }
  }

  const clean = routes.map(({ layer, ...route }) => ({ ...route, origin: layer }))
  return { routes: clean.sort((a, b) => compareTargets(a.target, b.target)), diagnostics, notices }
}

/**
 * "The template replaces" (#203): a project template (`templates/**`, a page or a Route Handler) in a directory other than
 * the generated one (`dashboard/(main)/<entity>/`, typically another route group) that COLLIDES with the entity's
 * generated dashboard routes takes their URL over, as its static segment took over core's dynamic `[entity]` route in
 * 0.x. It collides when it serves a URL a generated page serves (`/dashboard/<entity>`, `/create`, `/[id]`,
 * `/[id]/edit`, any dynamic segment name matching), or puts a dynamic segment with another name where a generated one
 * is (`[cohortId]` next to `[id]`): Next.js refuses both. A template that only adds a URL (`(staff)/<entity>/export`)
 * does not collide: the generated routes stay and both are served (a static segment wins over `[id]`).
 *
 * On a collision the rule is the whole subtree, not the colliding files: every generated dashboard route of that entity
 * (layout, error, loading, list, create, `[id]`, `[id]/edit`, with the metadata they forward) is dropped. Keeping some
 * of them would serve the entity from two route groups at once, under two different layouts and loading states; the
 * project's own pages, metadata, loading and error states (and its groups' error boundaries) serve the URL instead.
 *
 * The entity's permission layout is a security boundary, not presentation: it is kept, moved to the top directory of
 * each project tree that serves the URL (`dashboard/(staff)/<entity>/layout.tsx`), so every replaced route stays
 * behind the same check. A project layout at that exact file is reported as over a protected route.
 *
 * Templates inside the generated directory keep the existing behaviour (a page at a generated slot becomes that
 * route's template, others add pages under the entity's layout). Mutates `candidates`; returns the notices.
 */
function replaceEntityDashboards(candidates, templates) {
  const notices = []
  const generated = new Map() // entity -> its generated dashboard routes (error and loading are plain core facades)
  const names = new Set(candidates.filter(route => route.generated && route.entityRoute?.name && route.target.startsWith(`dashboard/(main)/${route.entityRoute.name}/`)).map(route => route.entityRoute.name))
  for (const route of candidates) {
    const name = route.generated && route.target.startsWith('dashboard/(main)/') ? route.target.split('/')[2] : null
    if (!names.has(name)) continue
    if (!generated.has(name)) generated.set(name, [])
    generated.get(name).push(route)
  }
  for (const [name, routes] of [...generated].sort(([a], [b]) => compareTargets(a, b))) {
    const base = `dashboard/(main)/${name}/`
    const under = templates.filter(route => {
      const segments = urlSegments(route.target)
      return segments[0] === 'dashboard' && segments[1] === name
    })
    const served = routes.filter(route => route.kind === 'page').map(route => urlSegments(route.target).slice(2))
    const claims = under.filter(route => (route.kind === 'page' || route.kind === 'route') && !route.target.startsWith(base) && served.some(generated => collides(urlSegments(route.target).slice(2), generated)))
    if (claims.length === 0) continue
    const layout = routes.find(route => route.kind === 'layout')
    for (const route of routes) candidates.splice(candidates.indexOf(route), 1)
    // Every directory at the entity's URL that the project serves from, in or out of the generated directory
    const roots = [...new Set(under.filter(route => route.kind === 'page' || route.kind === 'route').map(route => entityRoot(route.target, name)))].sort(compareTargets)
    const guards = layout ? roots.map(root => ({ ...layout, target: `${root}/layout.tsx`, source: `${layout.source} (permission layout, kept over the project's templates)` })) : []
    candidates.push(...guards)
    notices.push({
      code: PLAN_NOTICES.ENTITY_ROUTES_REPLACED,
      entity: name,
      url: `/dashboard/${name}`,
      by: [...new Set(claims.map(route => route.source))].sort(compareTargets),
      dropped: routes.map(route => route.target).sort(compareTargets),
      guards: guards.map(route => route.target),
      message:
        `/dashboard/${name}: the project's templates (${[...new Set(claims.map(route => route.source))].sort(compareTargets).join(', ')}) collide with the entity's generated dashboard routes and replace all of them ` +
        `(${routes.length} files under src/app/${base}); its permission layout is kept at ${guards.map(route => `src/app/${route.target}`).join(', ') || '(none)'}`,
    })
  }
  return notices
}

/**
 * "The project replaces a core API route" (#203): `templates/api/v1/<path>/route.ts` at a path core serves (`users/route.ts`,
 * `[entity]/[id]/route.ts`, ...). Core's handler, with its authentication, permissions and hooks, no longer answers that URL.
 */
function coreApiNotices(routes, candidates) {
  return routes.map(route => {
    const core = candidates.find(candidate => candidate.layer === 'core' && slotOf(candidate) === slotOf(route))
    const url = `/${urlSegments(route.target).join('/')}`
    return {
      code: PLAN_NOTICES.CORE_API_REPLACED,
      url,
      by: [route.source],
      replaces: core ? describe(core) : null,
      message:
        `${url}: the project's ${route.source} replaces ${core ? describe(core) : 'a core route'}; ` +
        `authentication, permissions, rate limits and hooks of the core handler no longer run there and are the project's responsibility`,
    }
  }).sort((a, b) => compareTargets(a.url, b.url))
}

/**
 * "The project overrides an entity's API" (#203): `templates/api/v1/<entity>/...` routes (already checked to mirror a core
 * `[entity]` route) are served at the static `/api/v1/<entity>/...`, which Next matches before core's `[entity]`. For those
 * URLs the project's handler replaces the generic one: its auth, permissions and entity hooks do not run unless the project
 * calls them. One notice per entity.
 */
function entityApiNotices(routes) {
  const byEntity = new Map()
  for (const route of routes) {
    const name = ENTITY_API.exec(route.target).groups.name
    if (!byEntity.has(name)) byEntity.set(name, [])
    byEntity.get(name).push(route)
  }
  return [...byEntity].sort(([a], [b]) => compareTargets(a, b)).map(([entity, list]) => {
    const urls = [...new Set(list.map(route => `/${urlSegments(route.target).join('/')}`))].sort(compareTargets)
    const by = list.map(route => route.source).sort(compareTargets)
    return {
      code: PLAN_NOTICES.ENTITY_API_OVERRIDDEN,
      entity,
      urls,
      by,
      message:
        `/api/v1/${entity}: the project's ${by.join(', ')} replace${by.length === 1 ? 's' : ''} the generic entity handler at ${urls.join(', ')}; ` +
        `authentication, permissions, rate limits and the entity's hooks are the project's responsibility there (put business rules in entity hooks, so every path keeps them)`,
    }
  })
}

/** Same kind of dynamic segment (a plain `[x]`, or a catch-all of either form), whatever its name. */
const sameDynamicKind = (a, b) => (dynamicKind(a) === 'dynamic') === (dynamicKind(b) === 'dynamic')

/**
 * Whether a project URL (segments below `/dashboard/<entity>`) collides with a generated one: the same URL (a dynamic
 * segment matches a dynamic segment of the same kind, whatever the names; an optional catch-all also serves its
 * parent's URL), or two names for one dynamic segment (`[cohortId]` where the generated routes have `[id]`) under the
 * same prefix. Next.js refuses both.
 */
function collides(project, generated) {
  // An optional catch-all also serves the URL of its parent (`/x/[[...rest]]` answers `/x`)
  if (dynamicKind(project.at(-1) ?? '') === 'optional catch-all' && collides(project.slice(0, -1), generated)) return true
  for (let index = 0; index < Math.min(project.length, generated.length); index += 1) {
    const [a, b] = [project[index], generated[index]]
    const dynamic = dynamicKind(a) && dynamicKind(b) && sameDynamicKind(a, b)
    if (dynamic && a !== b) return true
    if (!dynamic && a !== b) return false
  }
  return project.length === generated.length
}

/** The directory of `target` whose URL is `/dashboard/<entity>` (route groups and slots included in the path). */
function entityRoot(target, entity) {
  const parts = posix.dirname(target).split('/')
  let url = 0
  for (let index = 0; index < parts.length; index += 1) {
    if (/^\(.*\)$/.test(parts[index]) || parts[index].startsWith('@')) continue
    url += 1
    if (url === 2 && parts[index] === entity) return parts.slice(0, index + 1).join('/')
  }
  return posix.dirname(target)
}

/**
 * Two routes for one URL (in different route groups) and dynamic segments Next.js cannot tell apart.
 * Only routes without a cache-mode suffix are compared: a `.cc` file is an alternative, not a sibling.
 */
export function urlConflicts(routes) {
  const diagnostics = []
  const urls = new Map()
  // Next sorts routes with the slots removed: an optional catch-all's parent URL is compared with every page at that URL, in any slot or none
  const plainUrls = new Map()
  const parents = new Map()
  const tree = { children: new Map(), dynamic: new Map() }
  for (const route of routes) {
    if ((route.kind !== 'page' && route.kind !== 'route') || route.mode) continue
    const segments = urlSegments(route.target)
    // A parallel-route slot (`@slot/page`) renders beside the main page of the same URL: Next compares routes within one slot
    const slot = posix.dirname(route.target).split('/').filter(part => part.startsWith('@')).join('/')
    const url = `${slot ? `${slot}:` : ''}/${segments.join('/')}`
    if (!urls.has(url)) urls.set(url, [])
    urls.get(url).push(route)
    const plain = `/${segments.join('/')}`
    if (!plainUrls.has(plain)) plainUrls.set(plain, [])
    plainUrls.get(plain).push(route)
    // An optional catch-all also serves its parent's URL: a page there is the same URL twice for Next.js
    if (dynamicKind(segments.at(-1) ?? '') === 'optional catch-all') {
      const parent = `/${segments.slice(0, -1).join('/')}`
      if (!parents.has(parent)) parents.set(parent, [])
      parents.get(parent).push(route)
    }

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
        message: `${url.replace(/^.*?:\//, '/')}: ${sameUrl.map(route => `${describe(route)} (src/app/${route.target})`).join(' and ')} resolve to the same URL`,
      })
    }
  }
  for (const [parent, catchAlls] of parents) {
    // Only a page at the parent URL collides (next build measured): optional catch-alls of different slots share one path and are fine
    const pages = plainUrls.get(parent) ?? []
    const sameUrl = [...pages, ...catchAlls]
    if (pages.length > 0) {
      diagnostics.push({
        code: PLAN_DIAGNOSTICS.URL_CONFLICT,
        target: sameUrl[0].target,
        sources: sameUrl.map(route => route.source),
        message: `${parent}: ${sameUrl.map(route => `${describe(route)} (src/app/${route.target})`).join(' and ')} resolve to the same URL`,
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
