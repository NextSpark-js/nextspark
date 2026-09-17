/**
 * The dependencies the wizard writes into a new project have to install on the oldest Node the CLI
 * declares. Their ranges float, so what a new project gets is read from the npm registry: the newest
 * version each range allows, which pnpm 9 and pnpm 10 before 10.16 pick, and the newest one published
 * at least a day before, which pnpm 10.16 and later and pnpm 11 pick under the release-age policy the
 * project declares. The NextSpark packages are pinned to the CLI's own version and left out.
 *
 * mobile/ of a web-mobile project is left out too: Expo SDK 54 runs on React Native 0.81, which
 * requires Node 20.19.4.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import semver from 'semver'

import { updatePackageJson } from '../src/wizard/generators/index.js'
import { VERSIONS } from '../src/wizard/generators/monorepo-generator.js'
import type { WizardConfig } from '../src/wizard/types.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const OLDEST_NODE = semver.minVersion(manifest.engines.node)!.version

interface RegistryDocument {
  time: Record<string, string>
  versions: Record<string, { engines?: { node?: string } }>
}

async function registry(name: string): Promise<RegistryDocument> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`)
  assert.ok(response.ok, `the npm registry answered ${response.status} for ${name}`)
  return response.json() as Promise<RegistryDocument>
}

/** The dependencies and devDependencies the wizard writes into a web project's package.json. */
async function webDependencies(): Promise<Record<string, string>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-dependency-engines-'))
  const previous = process.cwd()
  try {
    process.chdir(dir)
    await updatePackageJson({ projectSlug: 'acme', projectType: 'web' } as WizardConfig)
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return { ...written.dependencies, ...written.devDependencies }
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** The versions a new project can resolve for `range`: the newest, and the newest a day old. */
function resolvable(document: RegistryDocument, range: string): string[] {
  const versions = Object.keys(document.versions)
  const mature = versions.filter(version => Date.parse(document.time[version]) <= Date.now() - ONE_DAY_MS)
  const picked = [semver.maxSatisfying(versions, range), semver.maxSatisfying(mature, range)]
  assert.ok(picked.every(Boolean), `no published version satisfies ${range}`)
  return [...new Set(picked as string[])]
}

test(`the dependencies the wizard writes for the web app and the monorepo root install on Node ${OLDEST_NODE}`, async () => {
  const ranges = Object.entries({ ...await webDependencies(), typescript: VERSIONS.TYPESCRIPT })
    .filter(([name]) => !name.startsWith('@nextsparkjs/'))
  const documents = await Promise.all(ranges.map(([name]) => registry(name)))

  const incompatible = ranges.flatMap(([name, range], index) =>
    resolvable(documents[index], range)
      .map(version => ({ version, node: documents[index].versions[version].engines?.node }))
      .filter(({ node }) => node && !semver.satisfies(OLDEST_NODE, node))
      .map(({ version, node }) => `${name}@${version} requires Node ${node}`)
  )
  assert.deepEqual(incompatible, [])
})
