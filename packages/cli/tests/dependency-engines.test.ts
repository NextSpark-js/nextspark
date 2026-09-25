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
import { incompatibleResolutions, type RegistryDocument } from './dependency-engines.js'

const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const OLDEST_NODE = semver.minVersion(manifest.engines.node)!.version

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

test(`the dependencies the wizard writes for the web app and the monorepo root install on Node ${OLDEST_NODE}`, { skip: process.env.NEXTSPARK_OFFLINE_TESTS === '1' }, async () => {
  const ranges = Object.entries({ ...await webDependencies(), typescript: VERSIONS.TYPESCRIPT })
    .filter(([name]) => !name.startsWith('@nextsparkjs/'))
  const documents = await Promise.all(ranges.map(([name]) => registry(name)))

  const incompatible = ranges.flatMap(([name, range], index) =>
    incompatibleResolutions(documents[index], range, OLDEST_NODE).map(message => `${name}@${message}`)
  )
  assert.deepEqual(incompatible, [])
})

const NOW = Date.parse('2026-01-03T00:00:00.000Z')
const OLD = '2025-12-31T00:00:00.000Z'
const RECENT = '2026-01-02T12:00:00.000Z'

function document(versions: RegistryDocument['versions'], time: Record<string, string>): RegistryDocument {
  return { versions, time }
}

test('checks every version that the configured resolution policies can select', () => {
  const registryDocument = document(
    {
      '1.0.0': { engines: { node: '>=22.14.0' } },
      '1.1.0': { engines: { node: '>=23.0.0' } },
    },
    { '1.0.0': OLD, '1.1.0': RECENT },
  )

  assert.deepEqual(incompatibleResolutions(registryDocument, '^1.0.0', '22.14.0', NOW), [
    '1.1.0 requires Node >=23.0.0',
  ])
})

test('reports a range for which no resolvable version accepts the oldest Node', () => {
  const registryDocument = document(
    {
      '2.0.0': { engines: { node: '>=23' } },
      '2.1.0': { engines: { node: '>=24' } },
    },
    { '2.0.0': OLD, '2.1.0': RECENT },
  )

  assert.deepEqual(incompatibleResolutions(registryDocument, '^2.0.0', '22.14.0', NOW), [
    '2.1.0 requires Node >=24',
    '2.0.0 requires Node >=23',
  ])
})

test('allows missing engines and reports malformed engine ranges', () => {
  const registryDocument = document(
    {
      '3.0.0': {},
      '3.1.0': { engines: { node: 'this is not a range' } },
    },
    { '3.0.0': OLD, '3.1.0': RECENT },
  )

  assert.deepEqual(incompatibleResolutions(registryDocument, '^3.0.0', '22.14.0', NOW), [
    '3.1.0 requires Node this is not a range',
  ])
})

test('handles prerelease versions when the range admits them', () => {
  const registryDocument = document(
    {
      '4.0.0-beta.1': { engines: { node: '>=22.14.0' } },
      '4.0.0-beta.2': { engines: { node: '>=23' } },
    },
    { '4.0.0-beta.1': OLD, '4.0.0-beta.2': RECENT },
  )

  assert.deepEqual(incompatibleResolutions(registryDocument, '>=4.0.0-beta.1 <4.0.0', '22.14.0', NOW), [
    '4.0.0-beta.2 requires Node >=23',
  ])
})

test('fails clearly when a range matches no published version', () => {
  const registryDocument = document({ '1.0.0': {} }, { '1.0.0': OLD })

  assert.throws(
    () => incompatibleResolutions(registryDocument, '^2.0.0', '22.14.0', NOW),
    /no published version satisfies \^2\.0\.0/,
  )
})
