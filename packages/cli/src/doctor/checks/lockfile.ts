/**
 * Lockfile Health Checks
 *
 * Reads the workspace's pnpm-lock.yaml for packages that must not resolve to two versions
 * (next, better-auth, zod) and for a zod below the range of the installed core (#374).
 */

import fs from 'fs-extra'
import path from 'path'
import semver from 'semver'
import type { HealthCheckResult } from '../index.js'

/** Packages that cannot sit next to a second copy of themselves. */
const SINGLE_COPY = ['next', 'better-auth', 'zod']
const DIRECT_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies']
const CORE = '@nextsparkjs/core'

export interface LockfileView {
  /** lockfileVersion as written, e.g. "9.0"; '' when absent. */
  lockfileVersion: string
  /** Every resolved version per package name, from the `packages:` section. */
  versions: Map<string, Set<string>>
  /** Importers that declare each version directly, per package name. */
  direct: Map<string, Map<string, Set<string>>>
  /** Every importer listed, with or without dependencies. */
  importers: Set<string>
  /** `name@version` -> the `name@version` of the packages that depend on it, from the `snapshots:` section (peer suffixes dropped). */
  parents: Map<string, Set<string>>
}

function setOf<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key)
  if (!set) map.set(key, (set = new Set()))
  return set
}

/**
 * Parses the parts of a v9 pnpm-lock.yaml the checks need. It reads lines instead of YAML
 * because the CLI ships no YAML parser.
 * ponytail: line-based, tied to pnpm's two-space layout; swap for a YAML parser if pnpm changes it.
 */
export function parseLockfile(text: string): LockfileView {
  const versions = new Map<string, Set<string>>()
  const direct = new Map<string, Map<string, Set<string>>>()
  let lockfileVersion = ''
  const importerIds = new Set<string>()
  let section = ''
  let importer = ''
  let field = ''
  let name = ''
  const parents = new Map<string, Set<string>>()
  let snapshot = ''
  let inDeps = false
  for (const line of text.split('\n')) {
    const top = /^(\w+):[ \t]*'?([^'\s]*)/.exec(line)
    if (top) {
      section = top[1]
      if (section === 'lockfileVersion') lockfileVersion = top[2]
      continue
    }
    if (section === 'snapshots') {
      const key = /^ {2}'?((?:@[^/@\s]+\/)?[^@\s']+)@([^:'\s(]+)/.exec(line)
      if (key) { snapshot = `${key[1]}@${key[2]}`; inDeps = false; continue }
      const fld = /^ {4}(\w+):/.exec(line)
      if (fld) { inDeps = fld[1] === 'dependencies' || fld[1] === 'optionalDependencies'; continue }
      const dep = inDeps ? /^ {6}'?([^'\s:]+)'?: '?([^'\s(]+)/.exec(line) : null
      if (dep) {
        // an npm alias is written `alias: real-name@version`
        const child = /^(?:@[^/]+\/)?[^@]+@/.test(dep[2]) ? dep[2] : `${dep[1]}@${dep[2]}`
        setOf(parents, child).add(snapshot)
      }
    } else if (section === 'packages') {
      const key = /^ {2}'?((?:@[^/@\s]+\/)?[^@\s']+)@([^:'\s(]+)/.exec(line)
      if (key) setOf(versions, key[1]).add(key[2])
    } else if (section === 'importers') {
      const imp = /^ {2}'?([^'\s:]+)'?:/.exec(line)
      if (imp) { importer = imp[1]; importerIds.add(importer); field = ''; continue }
      const fld = /^ {4}(\w+):/.exec(line)
      if (fld) { field = fld[1]; continue }
      const dep = /^ {6}'?([^'\s:]+)'?:/.exec(line)
      if (dep) { name = dep[1]; continue }
      const ver = /^ {8}version: '?([^'\s(]+)/.exec(line)
      if (ver && DIRECT_FIELDS.includes(field)) {
        let byVersion = direct.get(name)
        if (!byVersion) direct.set(name, (byVersion = new Map()))
        setOf(byVersion, ver[1]).add(importer)
      }
    }
  }
  return { lockfileVersion, versions, direct, importers: importerIds, parents }
}

interface Lock {
  root: string
  view: LockfileView
  /** Whether an importer belongs to the project for `pkg`: it declares core or the package as a peer, or no importer declares core. */
  inProject: (importer: string, pkg: string) => boolean
  /** Importer -> peerDependencies of its package.json. */
  peers: Map<string, Record<string, string>>
  /** The range the installed core declares for a package (dependency or peer), if any. */
  coreRange: (pkg: string) => string | undefined
}

/** The nearest pnpm-lock.yaml from `start` upwards, parsed. */
async function readLockfile(start: string): Promise<Lock | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'pnpm-lock.yaml')
    if (await fs.pathExists(file)) {
      const view = parseLockfile(await fs.readFile(file, 'utf8'))
      const importers = view.importers
      const withCore = new Set([...(view.direct.get(CORE) ? [...view.direct.get(CORE)!.values()].flatMap(s => [...s]) : [])])
      // The project also holds what its core importers reach by `link:` (workspace packages), along the whole chain.
      const links = new Map<string, Set<string>>()
      for (const byVersion of view.direct.values()) {
        for (const [version, from] of byVersion) {
          if (!version.startsWith('link:')) continue
          for (const importer of from) setOf(links, importer).add(path.posix.join(importer, version.slice(5)))
        }
      }
      for (const importer of withCore) for (const target of links.get(importer) ?? new Set<string>()) withCore.add(target)
      const peers = new Map<string, Record<string, string>>()
      for (const importer of importers) {
        try {
          const manifest = await fs.readJson(path.join(dir, importer, 'package.json'))
          if (manifest.peerDependencies) peers.set(importer, manifest.peerDependencies)
        } catch { /* no readable manifest */ }
      }
      // A peer with autoInstallPeers: false is not under the importer: attribute it to the versions its range accepts.
      for (const [importer, declared] of peers) {
        for (const pkg of SINGLE_COPY) {
          const range = declared[pkg]
          if (!range || !semver.validRange(range)) continue
          let byVersion = view.direct.get(pkg)
          if (!byVersion) view.direct.set(pkg, (byVersion = new Map()))
          if ([...byVersion.values()].some(set => set.has(importer))) continue
          for (const version of view.versions.get(pkg) ?? []) {
            if (semver.valid(version) && semver.satisfies(version, range)) setOf(byVersion, version).add(importer)
          }
        }
      }
      let core: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = {}
      for (const base of [start, dir]) {
        try {
          core = await fs.readJson(path.join(base, 'node_modules', '@nextsparkjs', 'core', 'package.json'))
          break
        } catch { /* try the next directory */ }
      }
      return {
        coreRange: pkg => core.dependencies?.[pkg] ?? core.peerDependencies?.[pkg],
        root: dir,
        view,
        inProject: (importer, pkg) => withCore.size === 0 || withCore.has(importer) || peers.get(importer)?.[pkg] !== undefined,
        peers,
      }
    }
    if (path.dirname(dir) === dir) return null
  }
}

/** Not-checked result for a lockfile this parser does not read. */
function unsupported(name: string, lock: Lock): HealthCheckResult | null {
  if (/^9(\.|$)/.test(lock.view.lockfileVersion)) return null
  return {
    name,
    status: 'warn',
    message: `Not checked: lockfile v${lock.view.lockfileVersion || '?'} (doctor reads v9)`,
    fix: 'Update pnpm and run: pnpm install',
  }
}

/** `pnpm add --filter <importer> [--save-peer] <pkg>@<range>`; the root importer is `.`, a peer needs --save-peer. */
function addCommand(lock: Lock, importer: string, pkg: string, range: string): string {
  const peer = lock.peers.get(importer)?.[pkg] !== undefined ? ' --save-peer' : ''
  return `pnpm add --filter ${importer === '.' ? '.' : `./${importer}`}${peer} ${pkg}@'${range}'`
}

/** The directory of an installed package in pnpm's virtual store, whatever its peer suffix. */
function storeManifest(root: string, name: string, version: string): { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string> } | null {
  const store = path.join(root, 'node_modules', '.pnpm')
  const prefix = `${name.replace('/', '+')}@${version}`
  try {
    for (const entry of fs.readdirSync(store)) {
      if (entry !== prefix && !entry.startsWith(`${prefix}_`)) continue
      return fs.readJsonSync(path.join(store, entry, 'node_modules', name, 'package.json'))
    }
  } catch { /* no store: the copy is reported */ }
  return null
}

/**
 * Whether the copy `version` of `pkg` stays because every package that pulls it declares a range that does not accept `top`.
 * The lockfile keeps only resolved versions, so the declared range is read from the parent's package.json in the store;
 * a parent that cannot be read, or that accepts `top`, means the project could align it.
 */
function pinnedAway(lock: Lock, pkg: string, version: string, top: string): boolean {
  const parents = [...(lock.view.parents.get(`${pkg}@${version}`) ?? [])]
  if (parents.length === 0) return false
  return parents.every(parent => {
    const at = parent.lastIndexOf('@')
    const manifest = at > 0 ? storeManifest(lock.root, parent.slice(0, at), parent.slice(at + 1)) : null
    const range = manifest?.dependencies?.[pkg] ?? manifest?.optionalDependencies?.[pkg] ?? manifest?.peerDependencies?.[pkg]
    return !!range && !!semver.validRange(range) && !semver.satisfies(top, range)
  })
}

/** Warns when the project resolves more than one version of next, better-auth or zod that it can align. */
export async function checkDuplicateDependencies(): Promise<HealthCheckResult> {
  const name = 'Duplicates'
  const lock = await readLockfile(process.cwd())
  if (!lock) return { name, status: 'pass', message: 'No pnpm-lock.yaml to check' }
  const stale = unsupported(name, lock)
  if (stale) return stale
  const found: string[] = []
  const fixes: string[] = []
  for (const pkg of SINGLE_COPY) {
    const byVersion = lock.view.direct.get(pkg) ?? new Map<string, Set<string>>()
    const own = (version: string) => [...(byVersion.get(version) ?? [])].filter(i => lock.inProject(i, pkg))
    const declared = [...byVersion.keys()].filter(v => semver.valid(v) && own(v).length > 0)
    const majors = new Set(declared.map(v => semver.major(v)))
    // A transitive copy counts when it has the major of a version the project declares; one declared by an importer outside the project does not.
    const counted = [...(lock.view.versions.get(pkg) ?? [])].filter(v =>
      semver.valid(v) && (declared.includes(v) || (!byVersion.has(v) && majors.has(semver.major(v)))))
      .sort(semver.compare)
    if (counted.length < 2) continue
    const top = counted[counted.length - 1]
    // ...unless every package that pulls it declares a range that excludes the highest copy (a pinned `zod`): no install or add removes it.
    const relevant = counted.filter(v => declared.includes(v) || v === top || !pinnedAway(lock, pkg, v, top))
    if (relevant.length < 2) continue
    const highest = relevant[relevant.length - 1]
    const parts = relevant.map(version => {
      const importers = own(version)
      if (importers.length === 0) return `${version} (a transitive dependency)`
      if (version !== highest) importers.forEach(importer => fixes.push(addCommand(lock, importer, pkg, lock.coreRange(pkg) ?? `^${highest}`)))
      return `${version} (${importers.join(', ')})`
    })
    found.push(`${pkg} ${parts.join(' and ')}`)
  }
  if (found.length === 0) return { name, status: 'pass', message: 'One version of next, better-auth and zod' }
  // warn, not fail: the build works with two copies. The reason to align them is that an older copy stays installed.
  return {
    name,
    status: 'warn',
    code: 'NS_DUPLICATE_DEPENDENCY',
    message: `NS_DUPLICATE_DEPENDENCY: more than one version resolved (${found.join('; ')})`,
    fix: fixes.length > 0
      ? `Run: ${[...new Set(fixes)].join(' && ')}`
      : 'Raise the packages that pull the older copy, then run: pnpm install',
  }
}

/** Fails when a zod an importer resolves is below the range of the installed core. */
export async function checkZodBelowCore(): Promise<HealthCheckResult> {
  const name = 'Zod'
  const lock = await readLockfile(process.cwd())
  if (!lock) return { name, status: 'pass', message: 'No pnpm-lock.yaml to check' }
  const stale = unsupported(name, lock)
  if (stale) return stale
  const range = lock.coreRange('zod')
  const floor = range && semver.validRange(range) ? semver.minVersion(range) : null
  if (!range || !floor) return { name, status: 'pass', message: 'Not checked: core does not declare a zod range' }
  // Only what an importer resolves: a transitive zod (a tool's own copy) is not the project's to align.
  const resolved = lock.view.direct.get('zod') ?? new Map<string, Set<string>>()
  const below = [...resolved.keys()].filter(v => semver.valid(v) && semver.lt(v, floor))
  if (below.length === 0) return { name, status: 'pass', message: `Every zod of the project satisfies core's ${range}` }
  const fixes = below.flatMap(version => [...(resolved.get(version) ?? [])]
    .map(importer => addCommand(lock, importer, 'zod', range!)))
  return {
    name,
    status: 'fail',
    code: 'NS_ZOD_BELOW_CORE',
    message: `NS_ZOD_BELOW_CORE: zod ${below.join(', ')} is below core's ${range}; two zod versions break schema types`,
    fix: `Run: ${[...new Set(fixes)].join(' && ')}`,
  }
}
