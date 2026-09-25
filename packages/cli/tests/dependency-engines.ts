import assert from 'node:assert/strict'
import semver from 'semver'

export const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface RegistryDocument {
  time: Record<string, string>
  versions: Record<string, { engines?: { node?: string } }>
}

/** The versions a new project can resolve for `range`: the newest, and the newest a day old. */
export function resolvable(document: RegistryDocument, range: string, now = Date.now()): string[] {
  const versions = Object.keys(document.versions)
  const mature = versions.filter(version => Date.parse(document.time[version]) <= now - ONE_DAY_MS)
  const picked = [semver.maxSatisfying(versions, range), semver.maxSatisfying(mature, range)]
  assert.ok(picked.every(Boolean), `no published version satisfies ${range}`)
  return [...new Set(picked as string[])]
}

/** Resolution candidates whose declared Node engine excludes `oldestNode`. */
export function incompatibleResolutions(document: RegistryDocument, range: string, oldestNode: string, now = Date.now()): string[] {
  return resolvable(document, range, now)
    .map(version => ({ version, node: document.versions[version].engines?.node }))
    .filter(({ node }) => node && !semver.satisfies(oldestNode, node))
    .map(({ version, node }) => `${version} requires Node ${node}`)
}
