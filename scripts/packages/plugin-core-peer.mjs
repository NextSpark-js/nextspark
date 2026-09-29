/**
 * A plugin that imports from @nextsparkjs/core must declare a core peer its imports can be satisfied by
 * (#203, stage 7a): plugin.config.ts runtime-imports `definePlugin`, so a core older than the first
 * release that exports it evaluates the config to a TypeError.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** The first core release that exports `definePlugin`. */
export const FIRST_DEFINE_PLUGIN_CORE = '0.1.0-beta.192'

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

export function parseVersion(text) {
  const match = VERSION.exec(text)
  if (!match) return null
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split('.') : [] }
}

/** semver precedence: a release outranks its prereleases; prerelease identifiers compare numerically when both are numbers. */
export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] < b.core[i] ? -1 : 1
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) return Number(x) < Number(y) ? -1 : 1
    if (nx !== ny) return nx ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

/**
 * The lowest version a peer range accepts, for the shapes packages use (`>=X`, `^X`, `~X`, `X`, and `||` of these);
 * null for anything else (`*`, `latest`, `workspace:*`, x-ranges, hyphen ranges), which cannot promise a minimum.
 */
export function minimumOfRange(range) {
  const minimums = []
  for (const alternative of range.split('||')) {
    const comparators = alternative.trim().split(/\s+/)
    const first = comparators[0].replace(/^(>=|\^|~|=)/, '')
    const version = parseVersion(first)
    if (!version || /^(<|>(?!=))/.test(comparators[0])) return null
    minimums.push(version)
  }
  return minimums.sort(compareVersions)[0] ?? null
}

const SKIPPED_DIRS = new Set(['node_modules', '__tests__', 'tests', 'test', 'docs', 'examples', 'dist', '.next'])
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/

function sourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) files.push(...sourceFiles(join(dir, entry.name)))
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !TEST_FILE.test(entry.name)) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

/** True when the text imports a runtime value from @nextsparkjs/core (type-only imports are erased). */
export function importsCoreAtRuntime(text) {
  const imports = text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]@nextsparkjs\/core(?:\/[^'"]*)?['"]|(?:^|\n)\s*import\s*['"]@nextsparkjs\/core(?:\/[^'"]*)?['"]|\b(?:require|import)\(\s*['"]@nextsparkjs\/core(?:\/[^'"]*)?['"]\s*\)/g)
  for (const match of imports) {
    if (match[1]) continue
    if (match[2] !== undefined && /^\{[^}]*\}$/.test(match[2].trim()) && match[2].replace(/[{}]/g, '').split(',').every(part => !part.trim() || /^type\s/.test(part.trim()))) continue
    return true
  }
  return false
}

/** Problems of one plugin directory, as strings. */
export function checkPluginCorePeer(pluginDir, { minimum = FIRST_DEFINE_PLUGIN_CORE } = {}) {
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
  const name = manifest.name ?? pluginDir
  const importing = sourceFiles(pluginDir).filter(file => importsCoreAtRuntime(readFileSync(file, 'utf8')))
  if (importing.length === 0) return []
  const range = manifest.peerDependencies?.['@nextsparkjs/core'] ?? manifest.dependencies?.['@nextsparkjs/core']
  if (!range) return [`${name}: imports @nextsparkjs/core (${importing.length} file(s)) but declares no @nextsparkjs/core peerDependency`]
  const lowest = minimumOfRange(range)
  if (!lowest) return [`${name}: @nextsparkjs/core peer "${range}" has no readable minimum; use ">=${minimum}"`]
  if (compareVersions(lowest, parseVersion(minimum)) < 0) {
    return [`${name}: @nextsparkjs/core peer "${range}" accepts releases older than ${minimum}, the first that exports definePlugin`]
  }
  return []
}

export function checkAllPlugins(pluginsRoot, options) {
  if (!existsSync(pluginsRoot)) return []
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(pluginsRoot, entry.name, 'package.json')))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap(entry => checkPluginCorePeer(join(pluginsRoot, entry.name), options))
}
