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

export interface LockfileView {
  /** Every resolved version per package name, from the `packages:` section. */
  versions: Map<string, Set<string>>
  /** Importers that declare each version directly, per package name. */
  direct: Map<string, Map<string, Set<string>>>
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
  let section = ''
  let importer = ''
  let field = ''
  let name = ''
  for (const line of text.split('\n')) {
    const top = /^(\w+):/.exec(line)
    if (top) { section = top[1]; continue }
    if (section === 'packages') {
      const key = /^ {2}'?((?:@[^/@\s]+\/)?[^@\s']+)@([^:'\s(]+)/.exec(line)
      if (key) setOf(versions, key[1]).add(key[2])
    } else if (section === 'importers') {
      const imp = /^ {2}'?([^'\s:]+)'?:/.exec(line)
      if (imp) { importer = imp[1]; field = ''; continue }
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
  return { versions, direct }
}

/** The nearest pnpm-lock.yaml from `start` upwards, parsed, with the directory that holds it. */
async function readLockfile(start: string): Promise<{ root: string; view: LockfileView } | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'pnpm-lock.yaml')
    if (await fs.pathExists(file)) return { root: dir, view: parseLockfile(await fs.readFile(file, 'utf8')) }
    if (path.dirname(dir) === dir) return null
  }
}

/** `pnpm add --filter <importer> <pkg>@<range>` for an importer; the root importer is `.`. */
function addCommand(importer: string, pkg: string, range: string): string {
  return `pnpm add --filter ${importer === '.' ? '.' : `./${importer}`} ${pkg}@'${range}'`
}

/** Warns when the lockfile resolves more than one version of next, better-auth or zod. */
export async function checkDuplicateDependencies(): Promise<HealthCheckResult> {
  const name = 'Duplicates'
  const lock = await readLockfile(process.cwd())
  if (!lock) return { name, status: 'pass', message: 'No pnpm-lock.yaml to check' }
  const found: string[] = []
  const fixes: string[] = []
  for (const pkg of SINGLE_COPY) {
    const all = [...(lock.view.versions.get(pkg) ?? [])].filter(v => semver.valid(v)).sort(semver.compare)
    if (all.length < 2) continue
    const highest = all[all.length - 1]
    const parts = all.map(version => {
      const importers = [...(lock.view.direct.get(pkg)?.get(version) ?? [])]
      if (importers.length === 0) return `${version} (a transitive dependency)`
      if (version !== highest) importers.forEach(importer => fixes.push(addCommand(importer, pkg, `^${highest}`)))
      return `${version} (${importers.join(', ')})`
    })
    found.push(`${pkg} ${parts.join(' and ')}`)
  }
  if (found.length === 0) return { name, status: 'pass', message: 'One version of next, better-auth and zod' }
  // warn, not fail: the build works with two copies. The reason to align them is an older copy that has an advisory.
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

/** Fails when a zod the lockfile resolves is below the range of the installed core. */
export async function checkZodBelowCore(): Promise<HealthCheckResult> {
  const name = 'Zod'
  const lock = await readLockfile(process.cwd())
  if (!lock) return { name, status: 'pass', message: 'No pnpm-lock.yaml to check' }
  let range: string | undefined
  for (const dir of [process.cwd(), lock.root]) {
    try {
      const core = await fs.readJson(path.join(dir, 'node_modules', '@nextsparkjs', 'core', 'package.json'))
      range = core.dependencies?.zod ?? core.peerDependencies?.zod
      break
    } catch { /* try the next directory */ }
  }
  const floor = range && semver.validRange(range) ? semver.minVersion(range) : null
  if (!range || !floor) return { name, status: 'pass', message: 'Not checked: core does not declare a zod range' }
  const below = [...(lock.view.versions.get('zod') ?? [])].filter(v => semver.valid(v) && semver.lt(v, floor))
  if (below.length === 0) return { name, status: 'pass', message: `Every zod satisfies core's ${range}` }
  const fixes = below.flatMap(version => [...(lock.view.direct.get('zod')?.get(version) ?? [])]
    .map(importer => addCommand(importer, 'zod', range!)))
  return {
    name,
    status: 'fail',
    code: 'NS_ZOD_BELOW_CORE',
    message: `NS_ZOD_BELOW_CORE: zod ${below.join(', ')} is below core's ${range}; two zod versions break schema types`,
    fix: fixes.length > 0
      ? `Run: ${[...new Set(fixes)].join(' && ')}`
      : `Raise the package that pulls zod ${below.join(', ')} to ${range}, then run: pnpm install`,
  }
}
