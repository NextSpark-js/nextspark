/**
 * Plugin capabilities (#203, "Plugin model")
 *
 * A runtime plugin declares the surfaces it contributes to:
 *
 *   export const examplePluginConfig = definePlugin({ name: 'example', capabilities: ['server', 'web'] })
 *
 * The compiler reads the declaration from the source (it never runs the config) and takes only what
 * is declared:
 *
 *   server   api/, entities/, settings/, plugin.pages.server.ts   -> API routes, entity registry, server registries
 *   web      templates/, components/, hooks/, providers/,         -> web host routes, client registry
 *            messages/, assets/, styles/, any 'use client' file
 *   mobile   mobile/                                              -> the mobile entry (no host yet)
 *   build    build/                                               -> build-time code
 *
 * A file in a surface the plugin did not declare fails generation (NS_PLUGIN_CAPABILITY_UNDECLARED),
 * and two transitive rules are checked on the import graph:
 *   - a web or mobile entry must not reach server-only code (NS_PLUGIN_SERVER_IN_CLIENT);
 *   - no runtime entry may reach build-only code (NS_PLUGIN_BUILD_IN_RUNTIME).
 *
 * A plugin whose config declares no `capabilities` is legacy and is treated as server + web + build
 * (everything but mobile), so plugins not migrated to `definePlugin` keep working.
 *
 * Collisions between plugins (same plugin name, same entity) are diagnostics naming both plugins;
 * every diagnostic list is sorted, so it does not depend on the order the plugins were found in.
 *
 * @module core/scripts/build/registry/discovery/plugin-capabilities
 */

import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

export const PLUGIN_CAPABILITIES = Object.freeze(['server', 'web', 'build', 'mobile'])
/** What a plugin that declares nothing is taken to contribute. */
export const LEGACY_CAPABILITIES = Object.freeze(['server', 'web', 'build'])

export const PLUGIN_DIAGNOSTICS = Object.freeze({
  INVALID: 'NS_PLUGIN_CAPABILITY_INVALID',
  UNDECLARED: 'NS_PLUGIN_CAPABILITY_UNDECLARED',
  SERVER_IN_CLIENT: 'NS_PLUGIN_SERVER_IN_CLIENT',
  BUILD_IN_RUNTIME: 'NS_PLUGIN_BUILD_IN_RUNTIME',
  UNRESOLVED_REPLACEMENT: 'NS_PLUGIN_BROWSER_MAP_UNRESOLVED',
  NAME_COLLISION: 'NS_PLUGIN_NAME_COLLISION',
  ENTITY_COLLISION: 'NS_PLUGIN_ENTITY_COLLISION',
})

/** Thrown with every diagnostic found; generation cannot continue. */
export class PluginCapabilityError extends Error {
  constructor(diagnostics) {
    super(`Plugin capability check failed:\n${diagnostics.map(d => `  - [${d.code}] ${d.message}`).join('\n')}`)
    this.name = 'PluginCapabilityError'
    this.diagnostics = diagnostics
  }
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sortDiagnostics = diagnostics =>
  [...diagnostics].sort((a, b) => compare(a.code, b.code) || compare(a.plugin ?? '', b.plugin ?? '') || compare(a.file ?? '', b.file ?? '') || compare(a.message, b.message))

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

/** The capabilities of a discovered plugin (`plugin.capabilities`, or the legacy default). */
export function capabilitiesOf(plugin) {
  return plugin?.capabilities ?? LEGACY_CAPABILITIES
}

export function hasCapability(plugin, capability) {
  return capabilitiesOf(plugin).includes(capability)
}

function unwrap(ts, node) {
  let current = node
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current) || ts.isTypeAssertionExpression?.(current))) current = current.expression
  return current
}

function findExportedInitializer(ts, sourceFile, exportName) {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) return declaration.initializer
      }
    }
    if (ts.isExportAssignment(statement) && !exportName) return statement.expression
  }
  return null
}

/**
 * Read the `capabilities` a plugin config declares, statically.
 *
 * @returns {{ declared: boolean, capabilities: string[]|null, diagnostics: object[] }}
 *   `declared: false` is a legacy plugin (no `capabilities` property at all).
 */
export function readPluginDeclaration(ts, { plugin, configFile, exportName }) {
  const diagnostics = []
  const invalid = message => {
    diagnostics.push({ code: PLUGIN_DIAGNOSTICS.INVALID, plugin, file: 'plugin.config.ts', message: `plugins/${plugin}/plugin.config.ts: ${message}` })
    return { declared: true, capabilities: null, diagnostics }
  }
  let text
  try {
    text = readFileSync(configFile, 'utf8')
  } catch {
    return { declared: false, capabilities: null, diagnostics }
  }
  const sourceFile = ts.createSourceFile(configFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let initializer = unwrap(ts, findExportedInitializer(ts, sourceFile, exportName))
  if (!initializer) return { declared: false, capabilities: null, diagnostics }
  if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression) && initializer.expression.text === 'definePlugin') {
    initializer = unwrap(ts, initializer.arguments[0])
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) return invalid('definePlugin() must be called with an object literal')
    const property = initializer.properties.find(p => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'capabilities')
    if (!property) return invalid('definePlugin() requires a literal `capabilities` array')
    return readList(ts, property.initializer, invalid, diagnostics)
  }
  if (!ts.isObjectLiteralExpression(initializer)) return { declared: false, capabilities: null, diagnostics }
  const property = initializer.properties.find(p => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'capabilities')
  if (!property) return { declared: false, capabilities: null, diagnostics }
  return readList(ts, property.initializer, invalid, diagnostics)
}

/**
 * The descriptive fields of a plugin config that are literals (`displayName`, `version`, `description`, and
 * `enabled`: true, false, or null when computed), read statically, for the capability-neutral catalog. A string
 * field computed at run time is simply absent.
 */
export function readPluginMetadata(ts, { configFile, exportName }) {
  let text
  try {
    text = readFileSync(configFile, 'utf8')
  } catch {
    return {}
  }
  const sourceFile = ts.createSourceFile(configFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let node = unwrap(ts, findExportedInitializer(ts, sourceFile, exportName))
  const viaDefinePlugin = Boolean(node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'definePlugin')
  if (viaDefinePlugin) node = unwrap(ts, node.arguments[0])
  if (!node || !ts.isObjectLiteralExpression(node)) return {}
  const metadata = {}
  let enabledSeen = false
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue
    const value = unwrap(ts, property.initializer)
    if (['displayName', 'version', 'description'].includes(property.name.text) && value && ts.isStringLiteralLike(value)) metadata[property.name.text] = value.text
    if (property.name.text === 'enabled') {
      enabledSeen = true
      // A literal boolean is known; anything computed (an env flag) is unknown (null), never assumed true.
      metadata.enabled = value?.kind === ts.SyntaxKind.TrueKeyword ? true : value?.kind === ts.SyntaxKind.FalseKeyword ? false : null
    }
  }
  // definePlugin defaults `enabled` to true.
  if (!enabledSeen && viaDefinePlugin) metadata.enabled = true
  return metadata
}

/** How a plugin config exports its config object (`export const fooPlugin = ...`, `export default fooPluginConfig`). */
export const PLUGIN_EXPORT_PATTERNS = [
  /export\s+const\s+([a-zA-Z]+(?:PluginConfig|Plugin))\s*[:=]/,
  /export\s+default\s+([a-zA-Z]+(?:PluginConfig|Plugin))/,
]

/**
 * Give every plugin (`{ name, root }`) its declared `capabilities`, reading `plugin.config.ts`.
 * A plugin that already has `capabilities` keeps them (the caller resolved them); one that declares none
 * gets none (legacy: `capabilitiesOf` supplies the default). Invalid declarations come back as diagnostics.
 */
export async function withDeclaredCapabilities(plugins, { projectRoot }) {
  const pending = plugins.filter(plugin => !('capabilities' in plugin))
  if (pending.length === 0) return { plugins, diagnostics: [] }
  const ts = await loadTypeScriptFor(projectRoot)
  const diagnostics = []
  const resolved = plugins.map(plugin => {
    if ('capabilities' in plugin) return plugin
    const configFile = join(plugin.root ?? plugin.sourceDir, 'plugin.config.ts')
    let exportName = null
    try {
      const text = readFileSync(configFile, 'utf8')
      exportName = PLUGIN_EXPORT_PATTERNS.map(pattern => text.match(pattern)?.[1]).find(Boolean) ?? null
    } catch {
      // no config: not a declared plugin
    }
    if (!exportName) return plugin
    const declaration = readPluginDeclaration(ts, { plugin: plugin.name, configFile, exportName })
    diagnostics.push(...declaration.diagnostics)
    return declaration.capabilities ? { ...plugin, capabilities: declaration.capabilities } : plugin
  })
  return { plugins: resolved, diagnostics }
}

function readList(ts, node, invalid, diagnostics) {
  const list = unwrap(ts, node)
  if (!list || !ts.isArrayLiteralExpression(list)) return invalid('`capabilities` must be a literal array of strings (the compiler reads it without running the config)')
  const capabilities = []
  for (const element of list.elements) {
    if (!ts.isStringLiteralLike(element)) return invalid('`capabilities` must contain only string literals')
    if (!PLUGIN_CAPABILITIES.includes(element.text)) return invalid(`unknown capability "${element.text}"; expected ${PLUGIN_CAPABILITIES.join(', ')}`)
    if (!capabilities.includes(element.text)) capabilities.push(element.text)
  }
  if (capabilities.length === 0) return invalid('`capabilities` must list at least one capability')
  return { declared: true, capabilities, diagnostics }
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
const IGNORED_DIRS = new Set(['node_modules', '__tests__', '__mocks__', 'tests', 'test', 'docs', 'examples', 'migrations', 'public', '.git', 'dist'])
const TEST_FILE = /\.(test|spec|d)\.[cm]?[jt]sx?$|^jest\.(setup|config)\./

/** A Route Handler under templates/ (the host planner serves it as a route: it runs on the server). */
export function isTemplateRoute(path) {
  const parts = path.split('/')
  return parts[0] === 'templates' && parts.length > 1 && /^route(\.[^.]+)?\.[cm]?[jt]sx?$/.test(parts.at(-1))
}

/** Which capability a path inside a plugin needs, or null when it is not a contribution surface. */
export function surfaceOf(path) {
  const parts = path.split('/')
  const [first] = parts
  if (isTemplateRoute(path)) return 'server'
  if (path === 'plugin.pages.server.ts' || path === 'plugin.pages.server.tsx') return 'server'
  if (['api', 'entities', 'settings'].includes(first) && parts.length > 1) return 'server'
  if (['templates', 'components', 'hooks', 'providers', 'messages', 'assets', 'styles'].includes(first) && parts.length > 1) return 'web'
  if (first === 'mobile' && parts.length > 1) return 'mobile'
  if (first === 'build' && parts.length > 1) return 'build'
  return null
}

function walk(root) {
  const files = []
  const visit = (dir, prefix) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!prefix && IGNORED_DIRS.has(entry.name) && !['assets', 'public'].includes(entry.name)) continue
        if (prefix && (entry.name === 'node_modules' || entry.name === '__tests__')) continue
        visit(join(dir, entry.name), rel)
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(rel)
      }
    }
  }
  visit(root, '')
  return files
}

const isCode = path => CODE_EXTENSIONS.has(extname(path)) && !TEST_FILE.test(path.split('/').at(-1))

// ---------------------------------------------------------------------------
// Import graph
// ---------------------------------------------------------------------------

const parseCache = new Map()

/** True when every specifier of a named import/export clause is `type X` (the statement is erased). */
function allTypeSpecifiers(clause) {
  return clause.elements.length > 0 && clause.elements.every(element => element.isTypeOnly)
}

/**
 * `{ imports: string[], edges: { specifier, kind }[], useClient: boolean }` of a source file; type-only imports and
 * re-exports are dropped. An edge is an ESM import / export-from / import() ('import') or a CommonJS require() /
 * TypeScript `import x = require()` ('require'): package `exports` select a different branch for each.
 */
function analyzeFile(ts, file) {
  let stats
  try {
    stats = statSync(file)
  } catch {
    return null
  }
  const key = `${file}|${stats.mtimeMs}|${stats.size}`
  const cached = parseCache.get(key)
  if (cached) return cached
  const text = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, extname(file) === '.tsx' || extname(file) === '.jsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edges = []
  const add = (specifier, kind) => edges.push({ specifier, kind })
  let useClient = false
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      if (statement.expression.text === 'use client') useClient = true
      continue
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      const named = clause?.namedBindings
      if (clause && !clause.name && named && ts.isNamedImports(named) && allTypeSpecifiers(named)) continue
      add(statement.moduleSpecifier.text, 'import')
    } else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly && ts.isExternalModuleReference(statement.moduleReference) && ts.isStringLiteralLike(statement.moduleReference.expression)) {
      add(statement.moduleReference.expression.text, 'require')
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly) continue
      if (statement.exportClause && ts.isNamedExports(statement.exportClause) && allTypeSpecifiers(statement.exportClause)) continue
      add(statement.moduleSpecifier.text, 'import')
    }
  }
  const visit = node => {
    if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
      const callee = node.expression
      if (callee.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0].text, 'import')
      else if (ts.isIdentifier(callee) && callee.text === 'require') add(node.arguments[0].text, 'require')
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  const result = { imports: [...new Set(edges.map(edge => edge.specifier))], edges, useClient }
  parseCache.set(key, result)
  return result
}

const BUILTINS = new Set(builtinModules.filter(name => !name.startsWith('_')))

/** Bare specifiers that only run on a server (`next/server` is Next's request/response and `after`/`connection` APIs). */
const SERVER_ONLY_PACKAGES = new Set(['server-only', 'next/headers', 'next/server', 'pg', 'postgres', 'ioredis', 'nodemailer'])
/** Core modules known to be server-only; the ones that import a marker above are also found by following the import. */
const SERVER_ONLY_CORE = [
  /^@nextsparkjs\/core\/lib\/db(\/|$)/,
  /^@nextsparkjs\/core\/lib\/api(\/|$)/,
  /^@nextsparkjs\/core\/lib\/rate-limit/,
  /^@nextsparkjs\/core\/lib\/entities\/registry$/,
  /^@nextsparkjs\/core\/lib\/auth\/runtime-readiness$/,
  /^@nextsparkjs\/core\/lib\/scheduled-actions\/initializer$/,
]

/** Why a specifier is server-only by its name, or null. */
export function serverOnlySpecifier(specifier) {
  if (specifier.startsWith('node:')) return `Node built-in "${specifier}"`
  if (BUILTINS.has(specifier)) return `Node built-in "${specifier}"`
  if (SERVER_ONLY_PACKAGES.has(specifier)) return `server-only module "${specifier}"`
  if (SERVER_ONLY_CORE.some(pattern => pattern.test(specifier))) return `server-only core module "${specifier}"`
  return null
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

function resolveFile(base) {
  const candidates = [base, ...RESOLVE_EXTENSIONS.map(ext => base + ext), ...RESOLVE_EXTENSIONS.map(ext => join(base, `index${ext}`))]
  // `./x.js` written for a `.ts` source
  if (/\.[cm]?js$/.test(base)) candidates.push(base.replace(/\.([cm]?)js$/, '.$1ts'), base.replace(/\.js$/, '.tsx'))
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // next candidate
    }
  }
  return null
}

const compilerOptionsCache = new Map()

/**
 * The compiler options the plugin's imports resolve with: the plugin's own tsconfig, else the project's
 * (paths, baseUrl, extends), on top of bundler resolution (package `exports` conditions).
 */
function compilerOptionsFor(ts, { projectRoot, pluginDir }) {
  const key = `${projectRoot}|${pluginDir}`
  if (compilerOptionsCache.has(key)) return compilerOptionsCache.get(key)
  const options = {}
  for (const dir of [pluginDir, projectRoot]) {
    const file = dir && join(dir, 'tsconfig.json')
    if (!file || !ts.sys.fileExists(file)) continue
    const read = ts.readConfigFile(file, ts.sys.readFile)
    if (read.error) continue
    Object.assign(options, ts.parseJsonConfigFileContent(read.config, ts.sys, dir, undefined, file).options)
    break
  }
  Object.assign(options, { allowJs: true, resolveJsonModule: true, noEmit: true })
  options.module = ts.ModuleKind.ESNext
  options.moduleResolution = ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.Node10
  delete options.customConditions
  compilerOptionsCache.set(key, options)
  return options
}

// The runtime target of a package: its `exports` (import / node / default conditions, never `types`), else its
// main. Read for the workspace's packages and every @nextsparkjs/* package; third-party packages are not opened
// (the bundlers already fail a web or mobile build that imports a Node built-in or `server-only`).
// Which package `exports` conditions (and legacy fields) a bundler selects depends on the target the import is
// bundled for: Next's client build (browser, never node), Metro (react-native first), Node for the server.
export const CONDITION_SETS = {
  // Next: webpack and Turbopack differ on `require`, so a web require is checked against both branches.
  web: { import: [new Set(['browser', 'import', 'module', 'default'])], require: [new Set(['browser', 'require', 'default']), new Set(['browser', 'import', 'module', 'default'])] },
  // Metro: react-native + import for ESM, react-native + require for CommonJS, then default.
  mobile: { import: [new Set(['react-native', 'import', 'default'])], require: [new Set(['react-native', 'require', 'default'])] },
  server: { import: [new Set(['node', 'import', 'default'])], require: [new Set(['node', 'require', 'default'])] },
}
const TARGET_FIELDS = {
  web: ['browser', 'module', 'main'],
  mobile: ['react-native', 'browser', 'module', 'main'],
  server: ['module', 'main'],
}
const packageDirCache = new Map()
const manifestCache = new Map()

export function packageSpecifier(specifier) {
  const parts = specifier.split('/')
  const length = specifier.startsWith('@') ? 2 : 1
  if (parts.length < length) return null
  return { name: parts.slice(0, length).join('/'), subpath: parts.length > length ? `./${parts.slice(length).join('/')}` : '.' }
}

/** The real directory of package `name` as seen from `fromDir`, or null. */
function findPackageDir(name, fromDir) {
  const key = `${fromDir}|${name}`
  if (packageDirCache.has(key)) return packageDirCache.get(key)
  let found = null
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (statExists(join(candidate, 'package.json'))) {
      found = realpathSync(candidate)
      break
    }
    if (dirname(dir) === dir) break
  }
  packageDirCache.set(key, found)
  return found
}

function statExists(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function readManifest(dir) {
  if (!manifestCache.has(dir)) {
    try {
      manifestCache.set(dir, JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')))
    } catch {
      manifestCache.set(dir, {})
    }
  }
  return manifestCache.get(dir)
}

/** Node's exports resolution for a runtime import: the target path (relative to the package) or null. */
export function exportsTarget(exportsField, subpath, conditions) {
  const target = (value, star) => {
    if (typeof value === 'string') return star === undefined ? value : value.split('*').join(star)
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = target(item, star)
        if (hit) return hit
      }
      return null
    }
    if (value && typeof value === 'object') {
      for (const [condition, inner] of Object.entries(value)) {
        if (!conditions.has(condition)) continue
        const hit = target(inner, star)
        if (hit) return hit
      }
    }
    return null
  }
  const isSubpaths = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some(key => key.startsWith('.'))
  if (!isSubpaths(exportsField)) return subpath === '.' ? target(exportsField) : null
  // Node's PACKAGE_IMPORTS_EXPORTS_RESOLVE: an exact key (no `*`) first, then the patterns with exactly one `*` in the order of
  // PATTERN_KEY_COMPARE (a longer base before the `*`, then a longer key), never declaration order. The first pattern in that
  // order that matches decides, even if its conditions select nothing: Node does not go on to a less specific one.
  // A trailing-slash key (`"./lib/"`, the folder mapping) is not a mapping in Node 17 and later, so it never matches.
  if (subpath in exportsField && !subpath.includes('*')) return target(exportsField[subpath])
  const patternKeyCompare = (a, b) => {
    const baseA = a.indexOf('*') + 1
    const baseB = b.indexOf('*') + 1
    if (baseA !== baseB) return baseB - baseA
    return b.length - a.length
  }
  const patterns = Object.keys(exportsField).filter(key => key.indexOf('*') !== -1 && key.indexOf('*') === key.lastIndexOf('*')).sort(patternKeyCompare)
  for (const key of patterns) {
    const star = key.indexOf('*')
    const base = key.slice(0, star)
    const trailer = key.slice(star + 1)
    if (subpath !== base && subpath.startsWith(base) && (trailer.length === 0 || (subpath.endsWith(trailer) && subpath.length >= key.length))) {
      return target(exportsField[key], subpath.slice(base.length, subpath.length - trailer.length))
    }
  }
  return null
}

/** A package file that may be built output: `dist/x.js` falls back to the source `src/x.ts` when it was not built. */
export function resolveBuilt(path) {
  const direct = resolveFile(path)
  if (direct && !/\.d\.[cm]?ts$/.test(direct)) return direct
  const marker = `${sep}dist${sep}`
  const at = path.lastIndexOf(marker)
  if (at === -1) return null
  const source = `${path.slice(0, at)}${sep}src${sep}${path.slice(at + marker.length)}`.replace(/\.d\.([cm]?)ts$/, '.$1js')
  const fromSource = resolveFile(source)
  return fromSource && !/\.d\.[cm]?ts$/.test(fromSource) ? fromSource : null
}

/**
 * The runtime files of a package import for `specifier` as bundled for `target` ('web' | 'mobile' | 'server') by an
 * edge of `kind` ('import' | 'require'): one per condition set that kind can select (a web `require` has two).
 * `thirdParty` also reads packages installed in node_modules (only the mobile check does, see below).
 */
export function resolvePackageRuntimes(specifier, from, target, kind, thirdParty = false, packageDir = null) {
  const parsed = packageSpecifier(specifier)
  if (!parsed) return []
  // `packageDir`: a package the caller already located (a workspace package that is not linked into node_modules)
  const dir = packageDir ?? findPackageDir(parsed.name, dirname(from))
  if (!dir) return []
  // A package outside node_modules is a workspace package; inside, only @nextsparkjs/* are read.
  if (!thirdParty && dir.includes(`${sep}node_modules${sep}`) && !parsed.name.startsWith('@nextsparkjs/')) return []
  const manifest = readManifest(dir)
  const files = []
  if (manifest.exports !== undefined) {
    for (const conditions of CONDITION_SETS[target][kind]) {
      const entry = exportsTarget(manifest.exports, parsed.subpath, conditions)
      const file = entry ? resolveBuilt(resolve(dir, entry)) : null
      if (file) files.push(file)
    }
  } else if (parsed.subpath !== '.') {
    const file = resolveBuilt(join(dir, parsed.subpath))
    if (file) files.push(file)
  } else {
    const field = TARGET_FIELDS[target].map(name => manifest[name]).find(value => typeof value === 'string')
    const file = resolveBuilt(join(dir, field ?? 'index'))
    if (file) files.push(file)
  }
  return [...new Set(files)]
}

// The object form of the legacy `browser` field (`{ "./server.js": "./browser.js", "fs": false }`): a client bundler
// replaces those modules inside the package, and `false` is an empty module. Next (webpack, Turbopack) and Metro apply it.
const packageOfCache = new Map()

function packageOf(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (packageOfCache.has(dir)) return packageOfCache.get(dir)
    if (statExists(join(dir, 'package.json'))) {
      const manifest = readManifest(dir)
      const entry = manifest.browser && typeof manifest.browser === 'object' ? { dir, map: manifest.browser } : null
      packageOfCache.set(dir, entry)
      return entry
    }
    if (dirname(dir) === dir) return null
  }
}

/** The replacement a browser map gives for `key`: undefined (none), false (empty module) or a string. */
function browserMapping(map, key) {
  const bare = key.replace(/^\.\//, '')
  const candidates = new Set([key, `./${bare}`, bare, `./${bare}`.replace(/\.[cm]?[jt]sx?$/, ''), bare.replace(/\.[cm]?[jt]sx?$/, '')])
  for (const [from, to] of Object.entries(map)) {
    if (candidates.has(from) || candidates.has(from.replace(/^\.\//, ''))) return to
  }
  return undefined
}

/** True when the package of `file` replaces (or empties) the bare `specifier` in its `browser` map. */
function browserMapReplaces(file, specifier) {
  const own = packageOf(file)
  return Boolean(own) && !specifier.startsWith('.') && browserMapping(own.map, specifier) !== undefined
}

/**
 * Apply a client target's browser maps to a resolved edge (the specifier from the importer's own package, then each
 * resolved file from its own package). An edge is dropped only for an explicit `false`, or because a replacement took
 * its place: a relative replacement is a file inside the package (`files`), a bare one is a package import that the
 * caller resolves like any other edge (`redirects`, from the file that owns the map). A replacement that names no file
 * is a `problem`, never a silent drop.
 */
function applyBrowserMaps(files, { specifier, from }) {
  const out = { files: [], redirects: [], problems: [] }
  const replace = (pkg, value, owner, original) => {
    if (value.startsWith('.') || value.startsWith('/')) {
      const file = resolveFile(join(pkg.dir, value))
      if (file) out.files.push(file)
      else out.problems.push({ file: owner, message: `the browser map of ${relative(dirname(pkg.dir), pkg.dir).split(sep).join('/') || pkg.dir} replaces "${original}" with "${value}", which names no file in the package` })
    } else {
      out.redirects.push({ specifier: value, from: owner, original })
    }
  }
  const own = packageOf(from)
  const bySpecifier = own && !specifier.startsWith('.') ? browserMapping(own.map, specifier) : undefined
  if (bySpecifier === false) return out
  if (typeof bySpecifier === 'string') {
    replace(own, bySpecifier, from, specifier)
    return out
  }
  for (const file of files) {
    const pkg = packageOf(file)
    const key = pkg ? `./${relative(pkg.dir, file).split(sep).join('/')}` : null
    const mapped = pkg ? browserMapping(pkg.map, key) : undefined
    if (mapped === false) continue
    if (typeof mapped === 'string') replace(pkg, mapped, file, key)
    else out.files.push(file)
  }
  return out
}

/**
 * `resolve(specifier, from, target, kind) -> { files }`: the modules to follow (none for a third-party package
 * unless `thirdParty`, a type file, an asset). Workspace files resolve with TypeScript and the project's compiler
 * options (paths, baseUrl); workspace and @nextsparkjs/* packages resolve to the runtime `exports` target that the
 * bundler of `target` selects for an edge of `kind` (never `types`), then the client `browser` maps are applied.
 */
function createResolver(ts, { projectRoot, plugin, plugins }) {
  const options = compilerOptionsFor(ts, { projectRoot, pluginDir: plugin.sourceDir })
  const cache = ts.createModuleResolutionCache(projectRoot ?? plugin.sourceDir, name => name, options)
  const roots = new Map(plugins.map(other => [other.importBase, other]))
  const one = file => ({ files: file && isCode(file) ? [file] : [] })
  const resolveOnce = (specifier, from, target, kind, thirdParty) => {
    const resolved = ts.resolveModuleName(specifier, from, options, ts.sys, cache).resolvedModule
    if (resolved && !resolved.isExternalLibraryImport) {
      return one(/\.d\.[cm]?ts$/.test(resolved.resolvedFileName) ? resolveBuilt(resolved.resolvedFileName.replace(/\.d\.([cm]?)ts$/, '.$1js')) : resolved.resolvedFileName)
    }
    if (!specifier.startsWith('.')) {
      const files = resolvePackageRuntimes(specifier, from, target, kind, thirdParty).filter(isCode)
      if (files.length > 0) return { files }
      if (resolved) return { files: [] }
    }
    // Where no tsconfig maps a plugin's own alias, its importBase still reaches the plugin.
    if (specifier.startsWith('.')) return one(resolveFile(resolve(dirname(from), specifier)))
    for (const [base, owner] of roots) {
      if (specifier === base) return one(resolveFile(join(owner.sourceDir, 'plugin.config')) ?? resolveFile(join(owner.sourceDir, 'index')))
      if (specifier.startsWith(`${base}/`)) return one(resolveFile(join(owner.sourceDir, specifier.slice(base.length + 1))))
    }
    return { files: [] }
  }
  return (specifier, from, target = 'server', kind = 'import', thirdParty = false) => {
    const { files } = resolveOnce(specifier, from, target, kind, thirdParty)
    return target === 'server' ? { files, redirects: [], problems: [] } : applyBrowserMaps(files, { specifier, from })
  }
}

// ---------------------------------------------------------------------------
// Contribution check
// ---------------------------------------------------------------------------

/**
 * Check what a plugin contributes against what it declares.
 *
 * @param {object} ts - the TypeScript compiler API
 * @param {object} input
 * @param {{ name: string, sourceDir: string, importBase: string, capabilities?: string[] }} input.plugin
 * @param {{ name: string, sourceDir: string, importBase: string }[]} [input.plugins] - every enabled plugin (imports of another plugin resolve into it)
 * @param {string} [input.projectRoot] - the project whose tsconfig resolves imports (paths, baseUrl); defaults to the plugin's directory
 * @returns {object[]} diagnostics, sorted
 */
export function checkPluginContributions(ts, { plugin, plugins = [plugin], projectRoot }) {
  const diagnostics = []
  const capabilities = capabilitiesOf(plugin)
  const root = plugin.sourceDir
  const files = walk(root)
  const codeFiles = files.filter(isCode)
  const label = `plugins/${plugin.name}`

  // 1. Declaration: every file in a surface belongs to a declared capability.
  const undeclared = new Map()
  const flag = (capability, file, why) => {
    if (!undeclared.has(capability)) undeclared.set(capability, [])
    undeclared.get(capability).push({ file, why })
  }
  const analysis = new Map()
  for (const file of codeFiles) analysis.set(file, analyzeFile(ts, join(root, file)))
  for (const file of files) {
    const surface = surfaceOf(file)
    if (surface && !capabilities.includes(surface)) flag(surface, file, `is in ${file.split('/')[0]}/`)
  }
  for (const file of codeFiles) {
    if (analysis.get(file)?.useClient && !capabilities.includes('web') && !undeclared.get('web')?.some(entry => entry.file === file)) flag('web', file, "has a 'use client' directive")
  }
  for (const [capability, entries] of undeclared) {
    const shown = entries.slice(0, 5).map(entry => entry.file)
    const more = entries.length > shown.length ? ` (+${entries.length - shown.length} more)` : ''
    diagnostics.push({
      code: PLUGIN_DIAGNOSTICS.UNDECLARED,
      plugin: plugin.name,
      capability,
      file: entries[0].file,
      files: entries.map(entry => entry.file),
      message: `${label}/${entries[0].file}: ${entries[0].why}, so the plugin needs the "${capability}" capability, but it declares [${capabilities.join(', ')}]. Add "${capability}" to definePlugin({ capabilities }) or remove the files${more ? `; also ${shown.slice(1).join(', ')}${more}` : shown.length > 1 ? `; also ${shown.slice(1).join(', ')}` : ''}`,
    })
  }

  // 2. Transitive rules on the import graph, for the surfaces the plugin declares.
  const resolveImport = createResolver(ts, { projectRoot, plugin, plugins })
  const ownerOf = file => plugins.find(other => file === other.sourceDir || file.startsWith(other.sourceDir + sep))
  const displayOf = file => {
    const owner = ownerOf(file)
    if (owner) return `plugins/${owner.name}/${relative(owner.sourceDir, file).split(sep).join('/')}`
    const modules = file.lastIndexOf(`${sep}node_modules${sep}`)
    if (modules !== -1) return file.slice(modules + '/node_modules/'.length).split(sep).join('/')
    const workspacePackage = file.split(sep).join('/').match(/\/packages\/([^/]+)\/(.*)$/)
    if (workspacePackage) return `@nextsparkjs/${workspacePackage[1]}/${workspacePackage[2]}`
    return projectRoot && file.startsWith(projectRoot + sep) ? relative(projectRoot, file).split(sep).join('/') : file
  }
  const isServerFile = file => {
    const owner = ownerOf(file)
    const base = file.split(sep).at(-1)
    if (/\.server\.[cm]?[jt]sx?$/.test(base)) return 'a *.server module'
    if (/^route\.([^.]+\.)?[cm]?[jt]sx?$/.test(base)) return 'a Route Handler (route file)'
    if (!owner && projectRoot && file.startsWith(projectRoot + sep) && !file.includes(`${sep}node_modules${sep}`) && relative(projectRoot, file).split(sep)[0] === 'api') return 'server code (the project api/)'
    if (owner) {
      const rel = relative(owner.sourceDir, file).split(sep).join('/')
      if (rel.startsWith('api/') || rel.startsWith('plugin.pages.server') || isTemplateRoute(rel)) return `server code (${rel.split('/')[0]}/)`
    }
    return null
  }
  const isBuildFile = file => {
    const owner = ownerOf(file)
    return Boolean(owner) && surfaceOf(relative(owner.sourceDir, file).split(sep).join('/')) === 'build'
  }

  const entriesFor = capability => {
    const entries = []
    for (const file of codeFiles) {
      const surface = surfaceOf(file)
      if (capability === 'web' && (surface === 'web' || analysis.get(file)?.useClient)) entries.push(join(root, file))
      if (capability === 'mobile' && surface === 'mobile') entries.push(join(root, file))
      if (capability === 'server' && surface === 'server') entries.push(join(root, file))
    }
    const config = resolveFile(join(root, 'plugin.config'))
    if (config && (capability === 'web' || capability === 'mobile' ? capabilities.includes(capability) : capabilities.includes('server'))) entries.push(config)
    return [...new Set(entries)].sort()
  }

  const reported = new Set()
  const isThirdParty = file => file.includes(`${sep}node_modules${sep}`) && !/[\\/]@nextsparkjs[\\/]/.test(file)
  const traverse = (capability, entries, offending, target = 'server') => {
    const seen = new Map()
    const queue = []
    for (const entry of entries) {
      seen.set(entry, [entry])
      queue.push(entry)
    }
    while (queue.length > 0) {
      const file = queue.shift()
      const info = analyzeFile(ts, file)
      if (!info) continue
      const chain = seen.get(file)
      const hit = offending(file, info)
      if (hit) {
        // One diagnostic per offending file; what it imports is its own business.
        if (!reported.has(`${capability}|${file}`)) {
          reported.add(`${capability}|${file}`)
          const via = chain.length > 1 ? ` via ${chain.map(displayOf).join(' -> ')}` : ''
          diagnostics.push(hit(chain, via))
        }
        continue
      }
      const redirectsSeen = new Set()
      const visitEdge = (from, specifier, kind, depth, redirected) => {
        let reason = capability === 'build' ? null : serverOnlySpecifier(specifier)
        // Third-party code (traversed for mobile only): Metro already fails a Node built-in, but not `server-only`.
        if (reason && isThirdParty(from) && specifier !== 'server-only') reason = null
        // A client bundler replaces (or empties) a module the package's own `browser` map names, e.g. { "fs": false }.
        if (reason && !redirected && target !== 'server' && browserMapReplaces(from, specifier)) reason = null
        if (reason) {
          const key = `${capability}|${from}|${specifier}`
          if (!reported.has(key)) {
            reported.add(key)
            const via = chain.length > 1 ? ` (entry ${chain.map(displayOf).join(' -> ')})` : ''
            diagnostics.push({
              code: PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT,
              plugin: plugin.name,
              capability,
              file: displayOf(from),
              message: `${displayOf(from)}: ${capability === 'mobile' ? 'mobile' : 'web'} code reaches ${reason}${redirected ? ' (through a browser map replacement)' : ''}${via}; a "${capability}" entry cannot reach server code. Move the server part behind an API route or drop the "${capability}" capability`,
            })
          }
          return
        }
        const resolved = resolveImport(specifier, from, target, kind, target === 'mobile' && capability === 'mobile')
        for (const next of resolved.files) {
          if (seen.has(next)) continue
          seen.set(next, [...chain, next])
          queue.push(next)
        }
        const problem = (owner, message) => {
          const key = `${capability}|unresolved|${owner}|${message}`
          // the build-only traversal walks the same graph again: the web/mobile one has already said it
          if (capability === 'build' || reported.has(key)) return
          reported.add(key)
          diagnostics.push({ code: PLUGIN_DIAGNOSTICS.UNRESOLVED_REPLACEMENT, plugin: plugin.name, capability, file: displayOf(owner), message: `${displayOf(owner)}: ${message}; the replacement cannot be followed, so what a ${capability} entry reaches through it is unknown. Point the map at an existing file or package` })
        }
        for (const issue of resolved.problems) problem(issue.file, issue.message)
        // A bare replacement in a browser map is a package import like any other: same target, same edge kind.
        for (const redirect of resolved.redirects) {
          const key = `${redirect.from}|${redirect.specifier}|${kind}`
          if (redirectsSeen.has(key) || depth >= 8) continue // a cycle in the map, or a chain too long to be real
          redirectsSeen.add(key)
          const replaced = resolveImport(redirect.specifier, redirect.from, target, kind, target === 'mobile' && capability === 'mobile')
          const named = packageSpecifier(redirect.specifier)
          const exists = named && findPackageDir(named.name, dirname(redirect.from))
          if (replaced.files.length === 0 && replaced.redirects.length === 0 && !serverOnlySpecifier(redirect.specifier) && !exists && !browserMapReplaces(redirect.from, redirect.specifier)) {
            problem(redirect.from, `the browser map replaces "${redirect.original}" with "${redirect.specifier}", which resolves to no file or package`)
            continue
          }
          visitEdge(redirect.from, redirect.specifier, kind, depth + 1, true)
        }
      }
      for (const { specifier, kind } of [...info.edges].sort((a, b) => (a.specifier < b.specifier ? -1 : a.specifier > b.specifier ? 1 : a.kind < b.kind ? -1 : 1))) visitEdge(file, specifier, kind, 0, false)
    }
  }

  for (const capability of ['web', 'mobile']) {
    if (!capabilities.includes(capability)) continue
    traverse(capability, entriesFor(capability), file => {
      const why = isServerFile(file)
      if (!why) return null
      return (chain, via) => ({
        code: PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT,
        plugin: plugin.name,
        capability,
        file: displayOf(file),
        message: `${displayOf(file)}: ${capability} code imports ${why}${via}; a "${capability}" entry cannot reach server code. Move the server part behind an API route or drop the "${capability}" capability`,
      })
    }, capability)
  }
  // Build-only code is checked per runtime target, with the export conditions that target selects.
  for (const target of ['server', 'web', 'mobile']) {
    if (!capabilities.includes(target)) continue
    traverse('build', entriesFor(target), file => {
      if (!isBuildFile(file)) return null
      return (chain, via) => ({
        code: PLUGIN_DIAGNOSTICS.BUILD_IN_RUNTIME,
        plugin: plugin.name,
        capability: 'build',
        file: displayOf(file),
        message: `${displayOf(file)}: build-only code is reachable from runtime code${via}; the "build" capability never enters a runtime bundle. Keep the runtime side out of build/ or import it only from build scripts`,
      })
    }, target)
  }

  return sortDiagnostics(diagnostics)
}

// ---------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------

/**
 * Collisions between plugins that no priority rule resolves: the same plugin name, the same entity.
 * Both plugins are named; the result is sorted, so it does not depend on the order of `plugins`.
 * (Two plugins serving the same web-host route are reported by `planHost`, with the same properties.)
 */
export function pluginCollisions(plugins) {
  const diagnostics = []
  const byName = new Map()
  for (const plugin of plugins) {
    if (!byName.has(plugin.name)) byName.set(plugin.name, [])
    byName.get(plugin.name).push(plugin)
  }
  for (const [name, same] of byName) {
    if (same.length < 2) continue
    const where = same.map(plugin => plugin.sourceDir ?? plugin.importBase).sort()
    diagnostics.push({
      code: PLUGIN_DIAGNOSTICS.NAME_COLLISION,
      plugin: name,
      sources: where,
      message: `plugin "${name}" is provided twice: ${where.join(' and ')}; plugin names are registry keys and must be unique`,
    })
  }
  const byEntity = new Map()
  for (const plugin of plugins) {
    for (const entity of plugin.entities ?? []) {
      if (!byEntity.has(entity.name)) byEntity.set(entity.name, [])
      byEntity.get(entity.name).push({ plugin: plugin.name, entity })
    }
  }
  for (const [entity, owners] of byEntity) {
    const distinct = [...new Map(owners.map(owner => [owner.plugin, owner])).values()].sort((a, b) => compare(a.plugin, b.plugin))
    if (distinct.length < 2) continue
    diagnostics.push({
      code: PLUGIN_DIAGNOSTICS.ENTITY_COLLISION,
      plugin: distinct[0].plugin,
      entity,
      sources: distinct.map(owner => owner.entity.configPath),
      message: `entity "${entity}" is provided by plugins ${distinct.map(owner => `"${owner.plugin}" (${owner.entity.configPath})`).join(' and ')}; entity names are registry keys, so only the project or core may replace a plugin's entity`,
    })
  }
  return sortDiagnostics(diagnostics)
}

export function assertNoPluginCollisions(plugins) {
  const diagnostics = pluginCollisions(plugins)
  if (diagnostics.length > 0) throw new PluginCapabilityError(diagnostics)
}

/** Plugins that contribute to `capability` (the compiler takes only these for that surface). */
export function pluginsFor(plugins, capability) {
  return plugins.filter(plugin => hasCapability(plugin, capability))
}
