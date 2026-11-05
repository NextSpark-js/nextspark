/**
 * Pages that use React Query where nothing provides it (#362)
 *
 * With `providers.scope: 'groups'` the root layout no longer mounts the React Query provider: only the dashboard,
 * superadmin and devtools areas (DashboardProviders) and a layout that wraps its children in GroupProviders do. A project
 * page, layout or block outside them that reaches `@tanstack/react-query`, or a core hook built on it, throws "No
 * QueryClient set" when it renders.
 *
 * `findQueryHooksWithoutProvider` follows the imports of each such file inside the project (relative and `@/`, plugins
 * included), stops at `node_modules`, and reports the first import in the closure that loads React Query. Read-only; it
 * runs in every `dev` and `build` (only with 'groups': with 'root' it reads nothing), and in `nextspark doctor`.
 *
 * What it does not see (no false alarm, a missed one): a name imported from a barrel of core (`@nextsparkjs/core/hooks`,
 * `/contexts`, `/providers`, `/hooks/teams`, `/components/permissions`, the package root), because the installed core ships
 * no source to resolve the name against and importing `useAuth` from the barrel is harmless; dynamic imports with a
 * variable specifier; providers or components mounted by plugin config instead of an import; third-party code that
 * uses React Query. Toasts are not looked at: `toast()` without a Toaster loses the message but does not throw. And
 * TeamContext and SubscriptionContext fail outside the dashboard with any scope, so they are not reported here.
 *
 * @module core/scripts/maintenance/query-providers
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { readProvidersScope } from '../build/registry/generators/root-providers.mjs'
import { QUERY_MODULES } from './query-modules.mjs'

export const QUERY_HOOK_WARNING = 'NS_QUERY_HOOK_WITHOUT_PROVIDER'
export const QUERY_HOOK_FIX = "wrap the layout of the route group in GroupProviders (import { GroupProviders } from '@nextsparkjs/core/providers/group-providers')"

/** Route areas that mount DashboardProviders themselves */
const PROVIDED_AREAS = ['dashboard', 'superadmin', 'devtools']
/** An import of any of these (by name) in a file means its subtree has a QueryClient */
const PROVIDER_NAME = /\b(?:GroupProviders|DashboardProviders|QueryProvider|QueryClientProvider)\b/
/** The code files a project imports from, as code-migrations.mjs counts them (not imported: that module also writes files) */
const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const SKIPPED_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'public', 'storybook-static', 'ios', 'android', '__tests__', 'tests', 'cypress'])
const REACT_QUERY = '@tanstack/react-query'
const CORE = '@nextsparkjs/core/'
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']
/** Route files that render something (a Route Handler is not one) */
const ROUTE_FILE = /^(?:page|layout|template|default|loading|error|not-found)(?:\.[a-z]+)?\.[cm]?[jt]sx?$/

const readText = file => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** The code of `source` with comments blanked and line breaks kept (strings and template literals stay whole) */
function blankComments(source) {
  let out = ''
  let quote = null
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (quote) {
      out += c
      if (c === '\\') out += source[++i] ?? ''
      else if (c === quote) quote = null
    } else if (c === '/' && source[i + 1] === '/') {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end < 0 ? source.length : end + 2
      out += source.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop - 1
    } else {
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
    }
  }
  return out
}

/**
 * The value imports of a file: `{ specifier, line, clause }`. `import type` and `export type` are not (they leave no
 * code), nor is an import whose names all have `type` in front. Re-exports and `import()` with a string are.
 */
export function importsOf(text) {
  const code = blankComments(text)
  const found = []
  const add = (index, specifier, clause) => found.push({ specifier, line: code.slice(0, index).split('\n').length, clause })
  for (const match of code.matchAll(/(?:^|[\n;])[ \t]*(import|export)(\s+type\b)?([^'"`;]*?)\bfrom\s*(['"])([^'"\n]+)\4/g)) {
    if (match[2]) continue
    const clause = match[3]
    const braces = /^\s*\{([^}]*)\}\s*$/.exec(clause)
    if (braces && braces[1].split(',').map(part => part.trim()).filter(Boolean).every(part => /^type\s/.test(part))) continue
    add(match.index + match[0].search(/(?:import|export)/), match[5], clause)
  }
  for (const match of code.matchAll(/(?:^|[\n;])[ \t]*(import)\s*(['"])([^'"\n]+)\2/g)) add(match.index + match[0].indexOf('import'), match[3], '')
  for (const match of code.matchAll(/\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g)) add(match.index, match[2], '')
  return found
}

/** The id of a core module a specifier names (`hooks/useEntityQuery`), or null */
export function coreModuleId(specifier) {
  if (!specifier.startsWith(CORE)) return null
  return specifier.slice(CORE.length).replace(/\.(?:[cm]?js|[cm]?ts|tsx)$/, '').replace(/\/index$/, '')
}

/** Whether a file of the project (or a plugin) can be followed: under a root, with no node_modules between */
function insideRoots(file, roots) {
  return roots.some(root => {
    const relative = path.relative(root, file)
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !relative.split(path.sep).includes('node_modules')
  })
}

/** A graph of the project's code: parses each file once, resolves relative and `@/` specifiers inside the roots */
function codeGraph({ projectRoot, plugins }) {
  const roots = [projectRoot, ...plugins.map(plugin => plugin.root)]
  const aliases = [...plugins.filter(plugin => plugin.importBase).map(plugin => [plugin.importBase + '/', plugin.root + path.sep]), ['@/', projectRoot + path.sep]]
  const nodes = new Map()

  const resolve = (from, specifier) => {
    let base = null
    if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier)
    else {
      const alias = aliases.find(([prefix]) => specifier.startsWith(prefix))
      if (alias) base = alias[1] + specifier.slice(alias[0].length).split('/').join(path.sep)
    }
    if (!base) return null
    const stem = base.replace(/\.[cm]?jsx?$/, '')
    const candidates = [base, ...EXTENSIONS.map(ext => base + ext), ...EXTENSIONS.map(ext => stem + ext), ...EXTENSIONS.map(ext => path.join(base, 'index' + ext))]
    const file = candidates.find(candidate => {
      try {
        return statSync(candidate).isFile()
      } catch {
        return false
      }
    })
    return file && insideRoots(file, roots) ? file : null
  }

  const node = file => {
    let known = nodes.get(file)
    if (known) return known
    const text = readText(file)
    known = { file, provides: false, query: null, deps: [] }
    nodes.set(file, known)
    if (text === null) return known
    for (const entry of importsOf(text)) {
      if (PROVIDER_NAME.test(entry.clause)) known.provides = true
      const id = coreModuleId(entry.specifier)
      if (!known.query && (entry.specifier === REACT_QUERY || (id !== null && QUERY_MODULES.has(id)))) known.query = { line: entry.line, specifier: entry.specifier }
      const dep = resolve(file, entry.specifier)
      if (dep) known.deps.push(dep)
    }
    return known
  }

  /**
   * The first import, in the closure of `start`, that loads React Query: `{ file, line, specifier }`. A file that imports
   * a provider has its own QueryClient for what it renders: it is neither reported nor followed.
   */
  // ponytail: one breadth-first search per route over files parsed once (~0.35 s for 500 routes and 2000 components); a per-file memo of the closure if a watcher regenerating on every save makes that felt
  const firstQueryImport = start => {
    const seen = new Set([start])
    const queue = [start]
    while (queue.length > 0) {
      const current = node(queue.shift())
      if (current.provides) continue
      if (current.query) return { file: current.file, ...current.query }
      for (const dep of current.deps) if (!seen.has(dep)) (seen.add(dep), queue.push(dep))
    }
    return null
  }

  /** Whether the file or anything it imports inside the project imports a provider */
  const providesQuery = start => {
    const seen = new Set([start])
    const queue = [start]
    while (queue.length > 0) {
      const current = node(queue.shift())
      if (current.provides) return true
      for (const dep of current.deps) if (!seen.has(dep)) (seen.add(dep), queue.push(dep))
    }
    return false
  }

  return { firstQueryImport, providesQuery }
}

const posix = value => value.split(path.sep).join('/')
const directoryOf = target => (target.includes('/') ? target.slice(0, target.lastIndexOf('/')) : '')

/** The route files of `<root>/templates` as a plan would list them (`kind`, `target`, `file`), for a caller with no plan */
function templateRoutes(root, layer) {
  const found = []
  const walk = (dir, prefix) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      else if (entry.isFile() && ROUTE_FILE.test(entry.name)) found.push({ kind: entry.name.startsWith('layout') ? 'layout' : 'page', target: prefix + entry.name, file: path.join(dir, entry.name), layer })
    }
  }
  walk(path.join(root, 'templates'), '')
  return found
}

/** The source files under `<root>/blocks` */
function blockFiles(root) {
  const found = []
  const walk = dir => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full)
      } else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !SKIPPED_FILE.test(entry.name)) found.push(full)
    }
  }
  walk(path.join(root, 'blocks'))
  return found
}

/**
 * The route files a project (or plugin) provides: a planned route's template file when the project overrides a core
 * route, its own file otherwise; none for core's own routes.
 */
const sourceOf = route => {
  const layer = route.origin ?? route.layer
  return route.template?.file ?? (layer && layer !== 'core' ? route.file : null)
}

/**
 * Pages, layouts and blocks of the project that use React Query where no provider is above them.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {{ name: string, root: string, importBase?: string }[]} [input.plugins] - enabled plugins
 * @param {object[]} [input.routes] - the host plan's routes (prepare has them); without them, the files under `templates/`
 *   of the project and of the plugins are the routes
 * @param {'root' | 'groups'} [input.scope] - providers.scope; read from config/app.config.ts when not given
 * @returns {{ route: string, source: string, import: string, specifier: string, fix: string }[]} nothing at all with
 *   scope 'root', where no file is read
 */
export function findQueryHooksWithoutProvider({ projectRoot, plugins = [], routes, scope }) {
  let current = scope
  if (!current) {
    try {
      current = readProvidersScope(projectRoot)
    } catch {
      current = 'root' // a setting that cannot be read stops the registry build with its own error
    }
  }
  if (current !== 'groups') return []

  const planned = routes ?? [...templateRoutes(projectRoot, 'project'), ...plugins.flatMap(plugin => templateRoutes(plugin.root, 'plugin'))]
  const files = planned.filter(route => route.kind !== 'route' && sourceOf(route))
  const graph = codeGraph({ projectRoot, plugins })
  const display = file => {
    const relative = path.relative(projectRoot, file)
    if (!relative.startsWith('..')) return posix(relative)
    const plugin = plugins.find(candidate => !path.relative(candidate.root, file).startsWith('..'))
    return plugin ? `plugins/${plugin.name}/${posix(path.relative(plugin.root, file))}` : posix(file)
  }

  // A layout provides for the routes in its directory and below: the ones of the plan with a provider in their closure
  const providingLayouts = new Set(
    files
      .filter(route => route.kind === 'layout' && graph.providesQuery(sourceOf(route)))
      .map(route => directoryOf(route.target)),
  )
  const covered = target => {
    let directory = directoryOf(target)
    for (;;) {
      if (providingLayouts.has(directory)) return true
      if (directory === '') return false
      directory = directoryOf(directory)
    }
  }
  const findings = []
  const reported = new Set()
  const report = (route, file) => {
    const hit = graph.firstQueryImport(file)
    if (!hit) return
    const key = `${route}|${file}`
    if (reported.has(key)) return
    reported.add(key)
    findings.push({ route, source: display(file), import: `${display(hit.file)}:${hit.line}`, specifier: hit.specifier, fix: QUERY_HOOK_FIX })
  }

  for (const route of files) {
    const first = route.target.split('/')[0]
    if (PROVIDED_AREAS.includes(first) || covered(route.target)) continue
    report(route.target, sourceOf(route))
  }
  // Blocks render in the public pages from the database, under the layouts of the root and of (public)
  const blocksCovered = providingLayouts.has('') || providingLayouts.has('(public)')
  if (!blocksCovered) {
    const seenBlocks = new Set()
    for (const root of [projectRoot, ...plugins.map(plugin => plugin.root)]) {
      for (const file of blockFiles(root)) {
        const block = path.dirname(file)
        if (seenBlocks.has(block)) continue
        const before = findings.length
        report(`block ${posix(path.relative(root, block))}`, file)
        if (findings.length > before) seenBlocks.add(block)
      }
    }
  }
  return findings.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : a.source < b.source ? -1 : 1))
}

/**
 * The findings for the project at `projectRoot` as `nextspark doctor` asks: the enabled plugins from nextspark.config.ts
 * (the plugin directories of the project when it cannot be read), the files under `templates/` as the routes. Prepare,
 * which has the plan, passes the planned routes to findQueryHooksWithoutProvider instead.
 */
export async function findQueryHooksInProject(projectRoot) {
  let scope = 'root'
  try {
    scope = readProvidersScope(projectRoot)
  } catch {
    return { scope, findings: [] }
  }
  if (scope !== 'groups') return { scope, findings: [] }
  let plugins
  try {
    const { projectHostConfig } = await import('../build/registry/host/prepare.mjs')
    plugins = projectHostConfig({ projectRoot }).plugins
  } catch {
    plugins = localPlugins(projectRoot)
  }
  return { scope, findings: findQueryHooksWithoutProvider({ projectRoot, plugins, scope }) }
}

function localPlugins(projectRoot) {
  try {
    return readdirSync(path.join(projectRoot, 'plugins'), { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => ({ name: entry.name, root: path.join(projectRoot, 'plugins', entry.name), importBase: `@/plugins/${entry.name}` }))
  } catch {
    return []
  }
}

/** `route → file:line` of a finding, for the notice and the doctor message */
export const describeQueryFinding = finding => `${finding.route} (${finding.source}) -> ${finding.import}`

/** The plan notice: one for all the findings, or null */
export function queryHookNotice(findings) {
  if (findings.length === 0) return null
  const shown = findings.slice(0, 10).map(describeQueryFinding)
  return {
    code: QUERY_HOOK_WARNING,
    target: findings[0].route,
    findings,
    message:
      `providers.scope is 'groups', so the root layout mounts no React Query provider, and ${findings.length} route file${findings.length === 1 ? '' : 's'} of the project ` +
      `import${findings.length === 1 ? 's' : ''} it outside the dashboard, superadmin and devtools areas: ${shown.join('; ')}${findings.length > 10 ? `; +${findings.length - 10} more` : ''}. ` +
      `A page that renders them throws "No QueryClient set". Fix: ${QUERY_HOOK_FIX}, or set providers.scope to 'root'.`,
  }
}
