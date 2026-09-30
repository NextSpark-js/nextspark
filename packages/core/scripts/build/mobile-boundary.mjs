/**
 * mobile-boundary.mjs - the mobile app imports portable code only (#203 stage 7b)
 *
 * The check itself, shipped in @nextsparkjs/core so that a generated web+mobile project runs it (`nextspark check:mobile`)
 * and this repository's `pnpm mobile:boundary` (scripts/packages/mobile-boundary.mjs) is the same code with the
 * repository's own layout.
 *
 * "Mobile imports only portable contracts/design primitives, never server implementation."
 * apps/mobile, the @nextsparkjs/mobile package and the template it ships may reach their own files, the
 * workspace packages they depend on that are themselves portable (@nextsparkjs/ui's native entry,
 * @nextsparkjs/mobile, @project/contracts: the DTO types and zod schemas nextspark prepare generates),
 * and third-party packages that run in React Native.
 *
 * They may not reach server code, the database, the registries, migrations or Node-only modules,
 * directly or through anything they import. The check walks the import graph of every mobile source file
 * (imports, re-exports, dynamic import(), require()) and resolves each specifier the way the app's own
 * toolchain does:
 *
 *   - TypeScript's module resolution with the tsconfig of the tree the file is in (`paths`, `baseUrl`,
 *     `extends`), so an alias such as `@server/* -> packages/core/*` is followed like any other import;
 *   - the workspace packages of pnpm-workspace.yaml (found from their package.json), followed into their
 *     sources whatever their name: a workspace package that imports server code is a violation of whoever
 *     imports it;
 *   - platform files (`.native`, `.ios`, `.android`) for relative imports.
 *
 * It fails on:
 *
 *   1. a Node built-in (`fs`, `node:path`, `child_process`, ...) - unless the bare name is a declared dependency
 *      that resolves to an installed package (a React Native polyfill such as `buffer`);
 *   2. a server-side package: @nextsparkjs/core and its plugins, the CLI, next, a database driver or ORM, better-auth's
 *      server, server-only, react-dom/server;
 *   3. a file that is server code wherever it is reached from (packages/core, apps/dev, plugins/, a `.nextspark`,
 *      `registries` or `migrations` directory);
 *   4. a package.json of a package whose files are reached that declares a server-side dependency, since
 *      everything it imports would become reachable.
 *
 * Third-party packages are not opened: what they import is their own concern. Every violation names the
 * chain of files that led to it.
 *
 * Where the mobile app, the portable packages and the server code are is a layout: MOBILE_TREES,
 * ALWAYS_CHECKED_MANIFESTS and SERVER_PATHS are this repository's; `projectLayout()` is a generated project's
 * (`mobile/`, `packages/contracts`, the web project as server code).
 */

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Package `exports` resolution (conditions per bundler target, wildcard and longest-pattern subpaths, dist -> src) is stage 7a's:
// one resolver serves the plugin capability check and this one
import { CONDITION_SETS, exportsTarget, resolveBuilt } from './registry/discovery/plugin-capabilities.mjs'

const SELF_DIR = dirname(realpathSync(fileURLToPath(import.meta.url)))

/**
 * The trees whose files are checked, from the repo root; `tsconfig` is the configuration their imports resolve with
 * (a missing one is replaced by a bundler-style default).
 */
export const MOBILE_TREES = Object.freeze([
  { dir: 'apps/mobile/app', tsconfig: 'apps/mobile/tsconfig.json' },
  { dir: 'apps/mobile/src', tsconfig: 'apps/mobile/tsconfig.json' },
  { dir: 'packages/mobile/src', tsconfig: 'packages/mobile/tsconfig.json' },
  { dir: 'packages/mobile/templates/src', tsconfig: 'packages/mobile/templates/tsconfig.json' },
  { dir: 'packages/mobile/templates/app', tsconfig: 'packages/mobile/templates/tsconfig.json' },
  { dir: 'packages/ui/src', tsconfig: 'packages/ui/tsconfig.json', nativeOnly: true },
  { dir: 'packages/contracts/src', tsconfig: 'packages/contracts/tsconfig.json' },
])

/** The packages whose manifests are always checked (mobile's own app and the portable workspace packages). */
export const ALWAYS_CHECKED_MANIFESTS = Object.freeze(['apps/mobile', 'packages/mobile', 'packages/ui', 'packages/contracts'])

/** Directories (from the repo root) that are server code wherever they are reached from, with what to say about them. */
export const SERVER_PATHS = Object.freeze([
  ['packages/core', 'server code (packages/core)'],
  ['apps/dev', 'project server code'],
  ['plugins', 'project server code'],
])

/**
 * The layout of a generated web+mobile project: the mobile app in `mobileDir`, the generated contracts package, and the
 * web project (`webDir`, where the server code is) as the code the mobile app must never reach. All from the workspace root.
 */
export function projectLayout({ mobileDir = 'mobile', webDir = 'web' } = {}) {
  return {
    trees: [
      { dir: `${mobileDir}/app`, tsconfig: `${mobileDir}/tsconfig.json` },
      { dir: `${mobileDir}/src`, tsconfig: `${mobileDir}/tsconfig.json` },
      { dir: 'packages/contracts/src', tsconfig: 'packages/contracts/tsconfig.json' },
    ],
    manifests: [mobileDir, 'packages/contracts'],
    serverPaths: [[webDir, `server code (${webDir})`], ...SERVER_PATHS],
  }
}

/** A package (and everything under its name) that must never be reachable from a mobile bundle. */
const SERVER_PACKAGES = [
  ['@nextsparkjs/core', 'the server framework'],
  ['@nextsparkjs/cli', 'the CLI'],
  ['@nextsparkjs/plugin-', 'a server plugin'],
  ['@nextsparkjs/testing', 'the web test kit'],
  ['next', 'Next.js'],
  ['server-only', 'a server-only marker'],
  ['react-dom/server', 'server rendering'],
  ['better-auth', "Better Auth's server"],
  ['pg', 'the database driver'],
  ['pg-native', 'the database driver'],
  ['postgres', 'the database driver'],
  ['@neondatabase/', 'the database driver'],
  ['drizzle-orm', 'an ORM'],
  ['kysely', 'a query builder'],
  ['@prisma/client', 'an ORM'],
  ['prisma', 'an ORM'],
  ['better-sqlite3', 'the database driver'],
  ['dotenv', 'a Node-only loader'],
  ['fs-extra', 'a Node-only module'],
]

/** Directory names that are server-side wherever they are found. */
const SERVER_DIRECTORIES = [
  ['migrations', 'database migrations'],
  ['.nextspark', 'generated registries'],
  ['registries', 'generated registries'],
]

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
const PLATFORM_SUFFIXES = ['.native', '.ios', '.android', '']
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
const BUILTINS = new Set(builtinModules.flatMap(name => [name, `node:${name}`]))

const posix = path => path.split(sep).join('/')

function packageName(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const isNodePrefixed = specifier => specifier.startsWith('node:')
const isBuiltinName = specifier => BUILTINS.has(specifier) || BUILTINS.has(specifier.split('/')[0])

/** Why this bare specifier is server-side, or null. */
export function serverPackageReason(specifier) {
  for (const [name, reason] of SERVER_PACKAGES) {
    if (name.endsWith('-') || name.endsWith('/')) {
      if (specifier.startsWith(name)) return reason
    } else if (specifier === name || specifier.startsWith(`${name}/`)) {
      return reason
    }
  }
  return null
}

/** Why this path (from the repo root, posix) is server-side, or null. */
function serverPathReason(path, serverPaths) {
  for (const [directory, reason] of serverPaths) if (path === directory || path.startsWith(`${directory}/`)) return reason
  for (const part of path.split('/')) {
    const match = SERVER_DIRECTORIES.find(([name]) => name === part)
    if (match) return match[1]
  }
  return null
}

function loadTypeScript(root) {
  for (const base of [join(root, 'package.json'), join(SELF_DIR, 'package.json')]) {
    try {
      return createRequire(base)('typescript')
    } catch {
      // try the next place
    }
  }
  throw new Error('typescript is not installed: run pnpm install at the repo root')
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.expo' || entry.name === 'dist') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, files)
    else if (entry.isFile()) files.push(path)
  }
  return files
}

/** The `packages:` globs of pnpm-workspace.yaml (a plain list; anything fancier is ignored). */
function workspaceGlobs(root) {
  const file = join(root, 'pnpm-workspace.yaml')
  if (!existsSync(file)) return []
  const globs = []
  let inPackages = false
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^packages:\s*(#.*)?$/.test(line)) inPackages = true
    else if (inPackages && /^\s+-\s+/.test(line)) globs.push(line.replace(/^\s+-\s+/, '').replace(/\s*#.*$/, '').trim().replace(/^['"]|['"]$/g, ''))
    else if (inPackages && /^\S/.test(line)) inPackages = false
  }
  return globs
}

/** name -> `{ dir, manifest }` of every workspace package, from the workspace globs and their package.json. */
function workspacePackages(root) {
  const packages = new Map()
  const add = dir => {
    const manifestPath = join(dir, 'package.json')
    if (!existsSync(manifestPath)) return
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (typeof manifest.name === 'string') packages.set(manifest.name, { dir, manifest })
    } catch {
      // a package.json that does not parse names nothing
    }
  }
  for (const glob of workspaceGlobs(root)) {
    if (glob.startsWith('!')) continue
    if (glob.endsWith('/*') || glob.endsWith('/**')) {
      const parent = join(root, glob.replace(/\/\*+$/, ''))
      if (existsSync(parent)) for (const entry of readdirSync(parent, { withFileTypes: true })) if (entry.isDirectory() && entry.name !== 'node_modules') add(join(parent, entry.name))
    } else {
      add(join(root, glob))
    }
  }
  return packages
}

/**
 * Every entry a workspace package offers for `subpath` ('' for the package itself), from its manifest. The `exports`
 * are read with stage 7a's `exportsTarget` (wildcard and longest-pattern subpaths, nested conditions): first the two
 * condition sets Metro selects (`react-native` + `import` / `require` + `default`), then every condition of the package
 * on its own and with `default`. A bundler picks by condition and platform, so the boundary is what ALL of them import,
 * never only the first that exists: a safe typings or default entry beside a React Native entry that imports the server
 * would otherwise pass.
 */
function workspaceEntries({ dir, manifest }, subpath) {
  const targets = []
  const exportsField = manifest.exports
  if (exportsField !== undefined) {
    const names = new Set()
    const gather = value => {
      if (Array.isArray(value)) value.forEach(gather)
      else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { if (!key.startsWith('.')) names.add(key); gather(inner) }
    }
    gather(exportsField)
    const sets = [...CONDITION_SETS.mobile.import, ...CONDITION_SETS.mobile.require, ...[...names].flatMap(name => [new Set([name]), new Set([name, 'default'])]), new Set(['default'])]
    const key = subpath ? `./${subpath}` : '.'
    for (const conditions of sets) {
      const target = exportsTarget(exportsField, key, conditions)
      if (target) targets.push(target)
    }
  }
  if (!subpath) {
    // The top-level fields a bundler reads without `exports` (and Metro's own `react-native`)
    for (const field of ['react-native', 'browser', 'module', 'main', 'types']) {
      if (typeof manifest[field] === 'string') targets.push(manifest[field])
      else if (field === 'browser' && manifest.browser && typeof manifest.browser === 'object') for (const value of Object.values(manifest.browser)) if (typeof value === 'string') targets.push(value)
    }
  }
  // Every target is kept, build output included: a bundler consumes the file the manifest names (`dist/native.js`),
  // wherever the sources are. `build` marks the ones under a build directory, `typings` the `.d.ts` ones (not runtime).
  const isBuild = target => /(^|[\\/])(dist|build|lib|out)[\\/]/.test(target.replace(/^\.\//, ''))
  const entries = targets.map(target => ({ path: join(dir, target), build: isBuild(target), typings: /\.d\.[cm]?ts$/.test(target) }))
  const sources = subpath ? [join(dir, 'src', subpath), join(dir, subpath)] : [join(dir, 'src', 'index'), join(dir, 'index')]
  const seenPaths = new Set()
  return [...entries, ...(entries.some(entry => !entry.typings) && subpath === '' ? [] : sources.map(path => ({ path, build: false, typings: false })))].filter(entry => !seenPaths.has(entry.path) && seenPaths.add(entry.path))
}

/**
 * The source file a build output is compiled from, when the mapping is the conventional one (`dist/native.js` <- `src/native.ts`,
 * `.cjs`/`.mjs`/`.js` to `.ts`/`.tsx`): the sources that exist for it, or none.
 */
function sourcesOfBuild(entryPath, packageDir) {
  const relativePath = posix(relative(packageDir, entryPath)).replace(/^(?:dist|build|lib|out)\//, '')
  const stem = relativePath.replace(/\.(?:[cm]?[jt]sx?)$/, '')
  return ['.ts', '.tsx', '.mts', '.cts'].map(extension => join(packageDir, 'src', `${stem}${extension}`)).filter(candidate => existsSync(candidate))
}

/**
 * Check the import boundary of the mobile trees under `repoRoot`.
 *
 * @param {{ repoRoot: string, ts?: object, trees?: typeof MOBILE_TREES, manifests?: readonly string[], serverPaths?: typeof SERVER_PATHS }} options
 * @returns {{ violations: { file: string, specifier: string, reason: string, chain: string[] }[], filesChecked: number }}
 */
export function checkMobileBoundary({ repoRoot, ts = loadTypeScript(repoRoot), trees = MOBILE_TREES, manifests = ALWAYS_CHECKED_MANIFESTS, serverPaths = SERVER_PATHS }) {
  const root = resolve(repoRoot)
  const workspace = workspacePackages(root)
  const violations = []
  const seen = new Map() // file -> chain that first reached it
  const queue = []
  const checkedManifests = new Set()
  const rel = file => posix(relative(root, file))

  const report = (file, specifier, reason, chain) => {
    if (!violations.some(v => v.file === rel(file) && v.specifier === specifier && v.reason === reason)) violations.push({ file: rel(file), specifier, reason, chain: chain.map(rel) })
  }

  // --- TypeScript resolution, one configuration per tsconfig
  const configs = new Map()
  const host = { fileExists: file => existsSync(file) && statSync(file).isFile(), readFile: file => readFileSync(file, 'utf8'), directoryExists: dir => existsSync(dir) && statSync(dir).isDirectory(), realpath: realpathSync, getCurrentDirectory: () => root }
  const configFor = tsconfigPath => {
    const key = tsconfigPath ?? ''
    if (configs.has(key)) return configs.get(key)
    let options = {}
    const file = tsconfigPath ? join(root, tsconfigPath) : null
    if (file && existsSync(file)) {
      const parsed = ts.readConfigFile(file, ts.sys.readFile)
      // Errors (an `extends` that is not installed yet) leave the file's own paths and baseUrl, which is what is needed
      options = ts.parseJsonConfigFileContent(parsed.config ?? {}, ts.sys, dirname(file), undefined, file).options
    }
    const resolved = {
      ...options,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      allowJs: true,
      resolveJsonModule: true,
      noEmit: true,
      types: [],
    }
    const entry = { options: resolved, cache: ts.createModuleResolutionCache(root, file => file, resolved) }
    configs.set(key, entry)
    return entry
  }
  const tsResolve = (specifier, from, tsconfigPath) => {
    const { options, cache } = configFor(tsconfigPath)
    const found = ts.resolveModuleName(specifier, from, options, host, cache).resolvedModule
    return found ? found.resolvedFileName : null
  }

  const enqueue = (file, chain, tsconfig) => {
    if (seen.has(file)) return
    seen.set(file, chain)
    queue.push({ file, chain, tsconfig })
  }

  /** The files a base path names (a file or a directory), trying the platform variants a native bundle takes. */
  const resolveFile = base => {
    const variants = []
    if (SOURCE_FILE.test(base) || base.endsWith('.json')) {
      const stripped = base.replace(/\.(?:[cm]?[jt]sx?)$/, '')
      for (const suffix of PLATFORM_SUFFIXES) for (const extension of EXTENSIONS) variants.push(`${stripped}${suffix}${extension}`)
      variants.push(base)
    } else {
      for (const suffix of PLATFORM_SUFFIXES) for (const extension of EXTENSIONS) variants.push(`${base}${suffix}${extension}`)
      for (const suffix of PLATFORM_SUFFIXES) for (const extension of EXTENSIONS) variants.push(join(base, `index${suffix}${extension}`))
      variants.push(base)
    }
    return [...new Set(variants.filter(candidate => existsSync(candidate) && statSync(candidate).isFile()))]
  }

  /**
   * What a relative specifier names inside a declaration file, by TypeScript's rule: `./x.js` is `./x.d.ts` (`.mjs` is
   * `.d.mts`, `.cjs` is `.d.cts`), and `./x` or `./dir` is `./x.d.ts` or `./dir/index.d.ts`. A bundler's build output
   * (`dist/index.d.ts` beside `dist/storage-abc.d.ts`) is written that way.
   */
  const resolveTypings = base => {
    const stem = base.replace(/\.[cm]?js$/, '')
    const extension = base.endsWith('.mjs') ? '.d.mts' : base.endsWith('.cjs') ? '.d.cts' : '.d.ts'
    return [`${stem}${extension}`, join(stem, `index${extension}`)].filter(candidate => existsSync(candidate) && statSync(candidate).isFile())
  }

  /** The package.json above a file, up to the repo root: `{ dir, manifest }` or null. */
  const owningPackage = file => {
    for (let dir = dirname(file); dir.startsWith(root); dir = dirname(dir)) {
      const manifestPath = join(dir, 'package.json')
      if (existsSync(manifestPath)) {
        try {
          return { dir, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) }
        } catch {
          return null
        }
      }
      if (dir === root) break
    }
    return null
  }

  const declaresDependency = (file, name) => {
    const owner = owningPackage(file)
    return Boolean(owner && ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some(field => owner.manifest[field]?.[name]))
  }

  /** A package whose file is reached must not declare a server dependency (everything it imports would be reachable). */
  const checkManifest = (dir, manifest, chain) => {
    if (checkedManifests.has(dir)) return
    checkedManifests.add(dir)
    const manifestPath = join(dir, 'package.json')
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        const reason = serverPackageReason(dependency)
        if (reason) report(manifestPath, dependency, `${manifest.name ?? rel(dir)} declares it in ${field} (${reason})`, [...chain, manifestPath])
      }
    }
  }

  const follow = (from, specifier, files, chain, tsconfig) => {
    for (const file of files) {
      const reason = serverPathReason(rel(file), serverPaths)
      if (reason) {
        report(from, specifier, reason, chain)
        continue
      }
      if (!SOURCE_FILE.test(file)) continue
      const owner = owningPackage(file)
      if (owner) checkManifest(owner.dir, owner.manifest, chain)
      enqueue(file, [...chain, file], tsconfig)
    }
  }

  const inspect = ({ file, chain, tsconfig }) => {
    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch (error) {
      report(file, '(file)', `cannot be read: ${error.message}`, chain)
      return
    }
    const { importedFiles } = ts.preProcessFile(source, true, true)
    for (const { fileName: specifier } of importedFiles) {
      if (isNodePrefixed(specifier)) {
        report(file, specifier, 'a Node-only module', chain)
      } else if (specifier.startsWith('.') || isAbsolute(specifier)) {
        const target = resolve(dirname(file), specifier)
        // A declaration file is read by TypeScript, which takes the sibling typings before any .js beside them
        const typings = /\.d\.[cm]?ts$/.test(file) ? resolveTypings(target) : []
        const files = typings.length > 0 ? typings : resolveFile(target)
        if (files.length === 0) report(file, specifier, 'cannot be resolved', chain)
        else follow(file, specifier, files, chain, tsconfig)
      } else {
        inspectBare(file, specifier, chain, tsconfig)
      }
    }
  }

  const inspectBare = (file, specifier, chain, tsconfig) => {
    const name = packageName(specifier)
    const resolved = tsResolve(specifier, file, tsconfig)
    const installed = resolved && /[\\/]node_modules[\\/]/.test(resolved)
    // The project alias of the app (`@/...`) names a file of the tree: one that does not resolve is a broken import, not a package
    if (!resolved && specifier.startsWith('@/')) {
      report(file, specifier, 'cannot be resolved', chain)
      return
    }
    if (isBuiltinName(specifier)) {
      // `buffer`, `events`, `process`...: Node's own, unless the project declares and installs a package of that name
      if (!(installed && declaresDependency(file, name))) report(file, specifier, 'a Node-only module', chain)
      return
    }
    const serverReason = serverPackageReason(specifier)
    if (serverReason) {
      report(file, specifier, serverReason, chain)
      return
    }
    // An alias (`paths`) or a linked workspace package resolves to a file of the repository. That is one entry of the
    // package: the others (what Metro takes on a device, `react-native`, or build output) are followed too, below
    if (resolved && !installed && resolved.startsWith(root) && SOURCE_FILE.test(resolved)) follow(file, specifier, [resolved], chain, tsconfig)
    const workspacePackage = workspace.get(name)
    if (workspacePackage) {
      const subpath = specifier.slice(name.length + 1)
      const found = new Set()
      const unverifiable = []
      for (const entry of workspaceEntries(workspacePackage, subpath)) {
        const existing = resolveFile(entry.path)
        if (existing.length > 0) {
          existing.forEach(candidate => found.add(candidate))
        } else if (entry.build && !entry.typings) {
          // Not built here: the conventional source of the build output, or nothing to verify it against
          const viaResolver = resolveBuilt(entry.path)
          const mapped = viaResolver ? [viaResolver] : sourcesOfBuild(entry.path, workspacePackage.dir)
          if (mapped.length > 0) mapped.forEach(candidate => found.add(candidate))
          else unverifiable.push(entry.path)
        }
      }
      if (found.size > 0) follow(file, specifier, [...found], chain, tsconfig)
      else if (unverifiable.length === 0 && !resolved) report(file, specifier, `cannot be resolved inside the workspace package ${name}`, chain)
      for (const entryPath of unverifiable) report(join(workspacePackage.dir, 'package.json'), `./${posix(relative(workspacePackage.dir, entryPath))}`, `${name} has a runtime entry that is build output which is not on disk and has no source counterpart: it cannot be verified`, chain)
    }
    // any other package is third-party: it is not opened
  }

  // The manifests that are always checked
  for (const dir of manifests) {
    const manifestPath = join(root, dir, 'package.json')
    if (existsSync(manifestPath)) checkManifest(join(root, dir), JSON.parse(readFileSync(manifestPath, 'utf8')), [])
  }

  let checked = 0
  const drain = () => {
    while (queue.length > 0) {
      inspect(queue.shift())
      checked += 1
    }
  }
  // The app's own files first, so a violation deep in a portable package is reported with the chain that reached it
  // from the app; then every file of the other trees, reached or not (a file nothing imports yet is still checked).
  // The app is the tree of the first manifest (`apps/mobile`, or the project's `mobile/`), whatever directory it is in
  const appRoot = manifests[0]
  const isApp = tree => tree.dir === appRoot || tree.dir.startsWith(`${appRoot}/`)
  for (const group of [trees.filter(isApp), trees.filter(tree => !isApp(tree))]) {
    for (const tree of group) {
      for (const file of walk(join(root, tree.dir)).filter(candidate => SOURCE_FILE.test(candidate))) {
        // packages/ui's web entries are not part of a mobile bundle: only its native entry and what that imports
        if (tree.nativeOnly && !/index\.native\.[cm]?[jt]sx?$/.test(file)) continue
        enqueue(file, [file], tree.tsconfig)
      }
    }
    drain()
  }
  return { violations, filesChecked: checked }
}

/** Human-readable lines for the violations. */
export function describeViolations(violations) {
  return violations.flatMap(({ file, specifier, reason, chain }) => [
    `${file}: imports ${specifier}, ${reason}`,
    ...(chain.length > 1 ? [`    reached through ${chain.join(' -> ')}`] : []),
  ])
}
