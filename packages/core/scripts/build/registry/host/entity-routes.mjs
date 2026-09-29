/**
 * Per-entity routes of the generated host (#203)
 *
 * The host serves no entity through a runtime lookup by key: for every entity it writes concrete
 * routes, each a composed facade that statically imports the entity's config (and the project's
 * template for that route when it has one) and applies one of core's route factories to them
 * (core `routes/_internal/entity-routes` and `public-entity-page`).
 *
 * - dashboard: `dashboard/(main)/<entity>/{layout,error,loading,page,create/page,[id]/page,[id]/edit/page}`
 *   for every entity the dashboard serves. URLs are the ones core's `[entity]` routes had.
 * - public: a builder entity with `access.basePath` gets `(public)<basePath>/[...slug]` (item pages,
 *   nested slugs included, as the catch-all served them; `[slug]` / `[...slug]` at the root for basePath
 *   `/`) and, with an archive page, `(public)<basePath>`. A public entity with an archive page and no
 *   builder basePath gets `(public)/<entity>/[[...rest]]` (the catch-all's archive fallback answered any
 *   depth under the entity's slug).
 *
 * What decides the routes (`enabled`, `ui.dashboard.showInMenu`, `access.basePath`, `builder.enabled`,
 * `ui.public.hasArchivePage`, ...) is read from the entity config's source, as literals: a value the
 * host cannot read as a literal is a diagnostic where it decides a public route (no route can be
 * guessed), and keeps the dashboard route where the runtime checks in core's factories can still
 * answer notFound().
 *
 * Nothing here writes a file: `planEntityRoutes` returns route candidates for `planHost`, which
 * resolves them against core's, the plugins' and the project's routes.
 *
 * @module core/scripts/build/registry/host/entity-routes
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { CORE_ROUTES_SPECIFIER } from './core-routes.mjs'

export const ENTITY_DIAGNOSTICS = Object.freeze({
  CONFIG_UNREADABLE: 'NS_HOST_ENTITY_CONFIG_UNREADABLE',
  NOT_STATIC: 'NS_HOST_ENTITY_CONFIG_NOT_STATIC',
  SLUG_MISMATCH: 'NS_HOST_ENTITY_SLUG_MISMATCH',
  BASE_PATH: 'NS_HOST_ENTITY_BASE_PATH',
})

/**
 * The core modules the entity routes are made of, one per kind of route: a route imports only the factory of
 * its own kind, so its module graph holds only the client components that route renders. `listMetadata`,
 * `detailMetadata`, `error` and `loading` are core's `[entity]` route modules the per-entity routes forward
 * `metadata` from / re-export. A host with another core (the conformance fixture) passes its own as `modules`.
 */
export const ENTITY_MODULES = Object.freeze({
  layout: `${CORE_ROUTES_SPECIFIER}_internal/entity-layout-route`,
  list: `${CORE_ROUTES_SPECIFIER}_internal/entity-list-route`,
  detail: `${CORE_ROUTES_SPECIFIER}_internal/entity-detail-route`,
  create: `${CORE_ROUTES_SPECIFIER}_internal/entity-create-route`,
  edit: `${CORE_ROUTES_SPECIFIER}_internal/entity-edit-route`,
  publicItem: `${CORE_ROUTES_SPECIFIER}_internal/public-item-route`,
  publicArchive: `${CORE_ROUTES_SPECIFIER}_internal/public-archive-route`,
  listMetadata: `${CORE_ROUTES_SPECIFIER}dashboard/(main)/[entity]/page`,
  detailMetadata: `${CORE_ROUTES_SPECIFIER}dashboard/(main)/[entity]/[id]/page`,
  error: `${CORE_ROUTES_SPECIFIER}dashboard/(main)/[entity]/error`,
  loading: `${CORE_ROUTES_SPECIFIER}dashboard/(main)/[entity]/loading`,
})

/** The revalidation the catch-all served public pages with (seconds). */
export const PUBLIC_REVALIDATE = 3600

// ---------------------------------------------------------------------------
// Facts: what an entity config says, as literals
// ---------------------------------------------------------------------------

const unwrap = (node, ts) => {
  let current = node
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression?.(current))) current = current.expression
  return current
}

/**
 * `{ state: 'value', value } | { state: 'absent' } | { state: 'unknown' }` for the property `name` of an
 * object literal: unknown when it is spread in, computed, shorthand or not a literal we can read.
 */
function property(object, name, ts) {
  let found = null
  let opaque = false
  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member)) {
      opaque = true
    } else if (ts.isPropertyAssignment(member) || ts.isShorthandPropertyAssignment(member)) {
      const key = member.name
      if (ts.isComputedPropertyName(key)) {
        opaque = true
      } else if ((ts.isIdentifier(key) || ts.isStringLiteral(key)) && key.text === name) {
        found = ts.isShorthandPropertyAssignment(member) ? { unknown: true } : { node: member.initializer }
      }
    } else if (member.name && !ts.isComputedPropertyName(member.name) && member.name.text === name) {
      found = { unknown: true } // a method or accessor of that name
    } else if (member.name && ts.isComputedPropertyName(member.name)) {
      opaque = true
    }
  }
  if (found?.unknown) return { state: 'unknown' }
  if (found) return { node: found.node }
  return opaque ? { state: 'unknown' } : { state: 'absent' }
}

function literalOf(node, ts) {
  const inner = unwrap(node, ts)
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return { state: 'value', value: inner.text }
  if (inner.kind === ts.SyntaxKind.TrueKeyword) return { state: 'value', value: true }
  if (inner.kind === ts.SyntaxKind.FalseKeyword) return { state: 'value', value: false }
  return { state: 'unknown' }
}

function read(root, path, ts) {
  let object = root
  for (const [index, key] of path.entries()) {
    const found = property(object, key, ts)
    if (found.state) return found
    if (index === path.length - 1) return literalOf(found.node, ts)
    const next = unwrap(found.node, ts)
    if (!ts.isObjectLiteralExpression(next)) return { state: 'unknown' }
    object = next
  }
  return { state: 'unknown' }
}

const FACT_PATHS = Object.freeze({
  slug: ['slug'],
  enabled: ['enabled'],
  showInMenu: ['ui', 'dashboard', 'showInMenu'],
  basePath: ['access', 'basePath'],
  legacyBasePath: ['builder', 'public', 'basePath'],
  allowNestedSlugs: ['access', 'allowNestedSlugs'],
  isPublic: ['access', 'public'],
  builderEnabled: ['builder', 'enabled'],
  hasArchivePage: ['ui', 'public', 'hasArchivePage'],
})

/**
 * Read the facts of one entity config.
 *
 * @param {{ source: string, file: string, exportName: string, projectRoot: string }} input
 * @returns {Promise<{ facts: Record<string, {state: string, value?: unknown}> } | { error: string }>}
 */
export async function readEntityFacts({ source, file, exportName, projectRoot }) {
  const ts = await loadTypeScriptFor(projectRoot)
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  const [parseError] = sourceFile.parseDiagnostics ?? []
  if (parseError) return { error: `does not parse (${ts.flattenDiagnosticMessageText(parseError.messageText, ' ')})` }

  let initializer = null
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) initializer = declaration.initializer
    }
  }
  if (!initializer) return { error: `has no \`const ${exportName} = { ... }\`` }
  const object = unwrap(initializer, ts)
  if (!ts.isObjectLiteralExpression(object)) return { error: `\`${exportName}\` is not an object literal, so its route settings cannot be read` }
  return { facts: Object.fromEntries(Object.entries(FACT_PATHS).map(([name, path]) => [name, read(object, path, ts)])) }
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

const hasValue = (fact, value) => fact?.state === 'value' && fact.value === value

/** A base path a route directory can be named after: `/blog`, `/docs/guides`. */
const BASE_PATH = /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/

/**
 * Entities the host serves: top-level entity configs of the project and of enabled plugins. Core's own
 * entities are served by core's own routes (a `dashboard/(main)/<entity>/` directory in its manifest).
 */
export function routableEntities(entities) {
  return entities.filter(entity => !entity.parent && !entity.isCore && entity.source !== 'core' && /EntityConfig$/.test(entity.exportName ?? ''))
}

const arg = {
  config: entity => ({ import: { name: entity.exportName, specifier: entity.configPath.replace(/\.tsx?$/, '') } }),
  template: () => ({ template: true }),
  literal: value => ({ literal: value }),
}

/**
 * Route candidates for the entities.
 *
 * @param {object} input
 * @param {object[]} input.entities - discovered entities (registry build's `allEntities`)
 * @param {Map<string, object>} input.facts - `readEntityFacts` result per entity name (`{ facts }`, or `{ error }`)
 * @param {object[]} input.coreRoutes - the core route manifest's routes (an entity with a dedicated core
 *   `dashboard/(main)/<entity>/` directory is served by it)
 * @param {(specifier: string) => string|null} input.resolveFile - core module specifier -> file
 * @param {boolean} [input.cacheComponents] - the host's setting (public item pages revalidate only without it)
 * @param {string[]} [input.modes] - cache modes the host serves (a host that builds both omits `revalidate`)
 * @param {Record<string, string>} [input.modules] - the specifiers of the modules the routes import (`ENTITY_MODULES`)
 * @returns {{ routes: object[], diagnostics: object[] }}
 */
export function planEntityRoutes({ entities, facts, coreRoutes, resolveFile, cacheComponents, modes = [], modules = ENTITY_MODULES }) {
  const routes = []
  const diagnostics = []
  const dedicated = name => coreRoutes.some(route => route.target.startsWith(`dashboard/(main)/${name}/`))
  const revalidates = cacheComponents !== true && !modes.includes('cc')

  const coreFacade = (kind, target, specifier) => ({
    kind,
    target,
    mode: null,
    specifier,
    file: resolveFile(specifier),
    layer: 'core',
    source: `core route ${specifier}`,
    generated: true,
  })

  for (const entity of routableEntities(entities)) {
    const result = facts.get(entity.name)
    const where = entity.source === 'plugin' ? `plugins/${entity.pluginContext?.pluginName}/entities/${entity.relativePath}` : `entities/${entity.relativePath}`
    if (!result || result.error) {
      diagnostics.push({
        code: ENTITY_DIAGNOSTICS.CONFIG_UNREADABLE,
        message: `${where}: the entity config ${result?.error ?? 'was not read'}; the host cannot write its routes`,
      })
      continue
    }
    const { facts: f } = result
    if (f.slug.state === 'value' && f.slug.value !== entity.name) {
      diagnostics.push({
        code: ENTITY_DIAGNOSTICS.SLUG_MISMATCH,
        message: `${where}: slug "${f.slug.value}" differs from the entity's directory name "${entity.name}"; the host writes the entity's routes under its name, so make them equal`,
      })
      continue
    }

    const source = `${where} (${entity.exportName})`
    const config = arg.config(entity)
    const configSource = { entity: { name: entity.name, exportName: entity.exportName, source } }
    const factory = (name, specifier) => ({ name, specifier, file: resolveFile(specifier) })

    // ---- dashboard -------------------------------------------------------
    const dashboard = !hasValue(f.enabled, false) && !hasValue(f.showInMenu, false) && !dedicated(entity.name)
    if (dashboard) {
      const base = `dashboard/(main)/${entity.name}`
      const children = (entity.children ?? []).map(String)
      const composed = (kind, target, fn, module, args, extra = {}) => ({
        kind,
        target,
        mode: null,
        specifier: null,
        file: null,
        layer: 'core',
        source: `${source} dashboard route`,
        generated: true,
        entityRoute: { ...configSource.entity, default: { factory: factory(fn, module), args }, named: [], literals: [], reexport: [], ...extra },
      })
      routes.push(
        { ...composed('layout', `${base}/layout.tsx`, 'createEntityLayoutRoute', modules.layout, [config]), protected: true },
        coreFacade('error', `${base}/error.tsx`, modules.error),
        coreFacade('loading', `${base}/loading.tsx`, modules.loading),
        composed('page', `${base}/page.tsx`, 'createEntityListRoute', modules.list, [config, arg.template()], { acceptsTemplate: true, reexport: [{ names: ['metadata'], specifier: modules.listMetadata }] }),
        composed('page', `${base}/create/page.tsx`, 'createEntityCreateRoute', modules.create, [config, arg.template()], { acceptsTemplate: true }),
        composed('page', `${base}/[id]/page.tsx`, 'createEntityDetailRoute', modules.detail, [config, arg.literal(children), arg.template()], { acceptsTemplate: true, reexport: [{ names: ['metadata'], specifier: modules.detailMetadata }] }),
        composed('page', `${base}/[id]/edit/page.tsx`, 'createEntityEditRoute', modules.edit, [config, arg.template()], { acceptsTemplate: true })
      )
    }

    // ---- public ----------------------------------------------------------
    const builder = hasValue(f.builderEnabled, true)
    const basePath = f.basePath.state === 'value' ? f.basePath : f.basePath.state === 'absent' ? f.legacyBasePath : f.basePath
    for (const [label, fact] of [
      ['access.basePath', f.basePath],
      ['builder.enabled', f.builderEnabled],
    ]) {
      if (fact.state === 'unknown') {
        diagnostics.push({
          code: ENTITY_DIAGNOSTICS.NOT_STATIC,
          message: `${source}: \`${label}\` is not a literal, and it decides which public routes the host writes; write it as a literal (a string or a boolean)`,
        })
      }
    }
    if (basePath.state === 'unknown' || f.builderEnabled.state === 'unknown') continue

    const publicComposed = (kind, target, exportsSpec, extra = {}) => ({
      kind,
      target,
      mode: null,
      specifier: null,
      file: null,
      layer: 'core',
      source: `${source} public route`,
      generated: true,
      entityRoute: { ...configSource.entity, reexport: [], ...extra, ...exportsSpec },
    })
    const hasArchive = hasValue(f.hasArchivePage, true)
    if (builder && basePath.state === 'value') {
      const path = String(basePath.value)
      if (!BASE_PATH.test(path)) {
        diagnostics.push({
          code: ENTITY_DIAGNOSTICS.BASE_PATH,
          message: `${source}: access.basePath ${JSON.stringify(path)} must be "/" or a static path such as "/blog" (letters, digits, - and _, no dynamic segments or trailing slash)`,
        })
        continue
      }
      const item = {
        default: { factory: factory('createPublicItemRoute', modules.publicItem), args: [config, arg.template()] },
        named: [{ name: 'generateMetadata', factory: factory('createPublicItemMetadata', modules.publicItem), args: [config] }],
        literals: revalidates ? [{ name: 'revalidate', value: PUBLIC_REVALIDATE }] : [],
      }
      if (path === '/') {
        const nested = hasValue(f.allowNestedSlugs, true)
        routes.push(publicComposed('page', `(public)/${nested ? '[...slug]' : '[slug]'}/page.tsx`, item, { acceptsTemplate: true, absorbs: '(public)/[entity]/page.tsx' }))
      } else {
        routes.push(publicComposed('page', `(public)${path}/[...slug]/page.tsx`, item, { acceptsTemplate: true, absorbs: `(public)${path}/[slug]/page.tsx` }))
        if (hasArchive) {
          routes.push(
            publicComposed('page', `(public)${path}/page.tsx`, {
              default: { factory: factory('createPublicArchiveRoute', modules.publicArchive), args: [config] },
              named: [{ name: 'generateMetadata', factory: factory('createPublicArchiveMetadata', modules.publicArchive), args: [config] }],
              literals: [],
            })
          )
        }
      }
    } else if (hasArchive && hasValue(f.isPublic, true) && !hasValue(f.enabled, false)) {
      routes.push(
        publicComposed('page', `(public)/${entity.name}/[[...rest]]/page.tsx`, {
          default: { factory: factory('createPublicArchiveRoute', modules.publicArchive), args: [config] },
          named: [{ name: 'generateMetadata', factory: factory('createPublicArchiveMetadata', modules.publicArchive), args: [config] }],
          literals: [],
        })
      )
    }
  }
  for (const route of routes) {
    if (route.entityRoute?.reexport) route.entityRoute.reexport = route.entityRoute.reexport.map(entry => ({ ...entry, file: resolveFile(entry.specifier) }))
  }
  return { routes, diagnostics }
}

/**
 * The source file of an entity config, from the specifier the registry imports it by: `@/entities/tasks/tasks.config`
 * is the project's, a plugin's is under the plugin's own import base.
 */
export function entityConfigFile(entity, { projectRoot, sourceRoot = projectRoot, plugins = [] }) {
  const specifier = entity.configPath
  const root = specifier.startsWith('@/')
    ? [sourceRoot, specifier.slice(2)]
    : (() => {
        const plugin = plugins.find(candidate => specifier.startsWith(`${candidate.importBase}/`))
        return plugin ? [plugin.root, specifier.slice(plugin.importBase.length + 1)] : null
      })()
  if (!root) return null
  const base = join(...root)
  return ['.ts', '.tsx', '.mts', '.js', '.jsx'].map(extension => `${base}${extension}`).find(candidate => existsSync(candidate)) ?? `${base}.ts`
}

/**
 * Read every entity's facts (`Map` by entity name), from the config file of each. `projectRoot` is where
 * TypeScript resolves from; `sourceRoot` (default: the same) is where the project's `@/` sources are.
 */
export async function readAllEntityFacts({ entities, projectRoot, sourceRoot = projectRoot, plugins = [] }) {
  const facts = new Map()
  for (const entity of routableEntities(entities)) {
    const file = entityConfigFile(entity, { projectRoot, sourceRoot, plugins })
    let source
    try {
      if (!file) throw Object.assign(new Error('no source'), { code: 'no source for ' + entity.configPath })
      source = await readFile(file, 'utf8')
    } catch (error) {
      facts.set(entity.name, { error: `cannot be read (${error.code ?? error.message})` })
      continue
    }
    facts.set(entity.name, await readEntityFacts({ source, file, exportName: entity.exportName, projectRoot }))
  }
  return facts
}
