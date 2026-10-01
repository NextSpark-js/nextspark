#!/usr/bin/env node
/**
 * Publish order for a directory of .tgz files: a package is listed after every
 * package in the set that it pins through dependencies / peerDependencies /
 * optionalDependencies, so nothing is ever live before an internal dependency.
 *
 * CLI: node publish-order.mjs <dir>  ->  one "<tgz path>\t<name>\t<version>" per line, in order.
 * Exits 1 with a message naming the packages involved on a dependency cycle.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']

/** manifests: [{ file, name, version, dependencies?, peerDependencies?, optionalDependencies? }] */
export function computeOrder(manifests) {
  const names = new Set(manifests.map((m) => m.name))
  const needs = (m) => [...new Set(DEP_FIELDS.flatMap((f) => Object.keys(m[f] ?? {})))].filter((n) => names.has(n) && n !== m.name)
  const pending = [...manifests].sort((a, b) => a.name.localeCompare(b.name))
  const done = new Set()
  const ordered = []
  while (pending.length) {
    const i = pending.findIndex((m) => needs(m).every((n) => done.has(n)))
    if (i === -1) {
      const cycle = pending.map((m) => `${m.name} -> ${needs(m).filter((n) => !done.has(n)).join(', ')}`)
      throw new Error(`Dependency cycle among packages to publish:\n  ${cycle.join('\n  ')}`)
    }
    const [next] = pending.splice(i, 1)
    done.add(next.name)
    ordered.push(next)
  }
  return ordered
}

export function readManifests(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tgz'))
    .map((f) => {
      const file = join(dir, f)
      const r = spawnSync('tar', ['xzOf', file, 'package/package.json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      if (r.status !== 0) throw new Error(`Cannot read package.json from ${file}: ${r.stderr}`)
      return { file, ...JSON.parse(r.stdout) }
    })
}

// Real paths: under a symlinked directory (macOS /tmp) argv[1] and import.meta.url differ and nothing would print
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const dir = resolve(process.argv[2] ?? '.')
    for (const m of computeOrder(readManifests(dir))) console.log(`${m.file}\t${m.name}\t${m.version}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
