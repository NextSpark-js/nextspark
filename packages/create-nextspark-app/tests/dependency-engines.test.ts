/**
 * The dependencies create-nextspark-app adds before the wizard runs have to install on the oldest
 * Node the package declares. A range floats, so what a new project gets is read from the npm
 * registry: the newest version the spec allows, which pnpm 9 and pnpm 10 before 10.16 pick, and the
 * newest one published at least a day before, which pnpm 10.16 and later and pnpm 11 pick under the
 * release-age policy the project declares. A spec without a version resolves the `latest` tag.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import semver from 'semver'

import { ESSENTIAL_DEPENDENCIES } from '../src/create.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const OLDEST_NODE = semver.minVersion(manifest.engines.node)!.version

interface RegistryDocument {
  'dist-tags': { latest: string }
  time: Record<string, string>
  versions: Record<string, { engines?: { node?: string } }>
}

function parseSpecifier(specifier: string): [name: string, range: string | undefined] {
  const at = specifier.lastIndexOf('@')
  return at > 0 ? [specifier.slice(0, at), specifier.slice(at + 1)] : [specifier, undefined]
}

async function registry(name: string): Promise<RegistryDocument> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`)
  assert.ok(response.ok, `the npm registry answered ${response.status} for ${name}`)
  return response.json() as Promise<RegistryDocument>
}

/** The versions a new project can resolve for `range`: the newest, and the newest a day old. */
function resolvable(document: RegistryDocument, range: string | undefined): string[] {
  const effective = range ?? `<=${document['dist-tags'].latest}`
  const versions = Object.keys(document.versions)
  const mature = versions.filter(version => Date.parse(document.time[version]) <= Date.now() - ONE_DAY_MS)
  const picked = [
    range ? semver.maxSatisfying(versions, effective) : document['dist-tags'].latest,
    semver.maxSatisfying(mature, effective),
  ]
  assert.ok(picked.every(Boolean), `no published version satisfies ${effective}`)
  return [...new Set(picked as string[])]
}

test(`the dependencies create-nextspark-app adds install on Node ${OLDEST_NODE}`, async () => {
  const specifiers = ESSENTIAL_DEPENDENCIES.map(parseSpecifier)
  const documents = await Promise.all(specifiers.map(([name]) => registry(name)))

  const incompatible = specifiers.flatMap(([name, range], index) =>
    resolvable(documents[index], range)
      .map(version => ({ version, node: documents[index].versions[version].engines?.node }))
      .filter(({ node }) => node && !semver.satisfies(OLDEST_NODE, node))
      .map(({ version, node }) => `${name}@${version} requires Node ${node}`)
  )
  assert.deepEqual(incompatible, [])
})
