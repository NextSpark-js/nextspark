/**
 * better-auth depends on one exact @better-fetch/fetch and @better-auth/core requires that same
 * version as a peer. A project declares @better-fetch/fetch itself, since the template proxy.ts
 * imports it, and any other version is an unmet peer: pnpm with strict peers aborts the install.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { updatePackageJson } from '../src/wizard/generators/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** The @better-fetch/fetch the better-auth installed for core depends on. */
function betterAuthsBetterFetch(): string {
  const betterAuth = fs.realpathSync(path.join(REPO, 'packages/core/node_modules/better-auth'))
  return JSON.parse(fs.readFileSync(path.join(betterAuth, 'package.json'), 'utf8')).dependencies['@better-fetch/fetch']
}

test('init declares the @better-fetch/fetch better-auth depends on', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nextspark-init-deps-'))
  const previousCwd = process.cwd()
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'acme', private: true }))
    process.chdir(root)
    await updatePackageJson({ projectSlug: 'acme', projectType: 'web' } as WizardConfig)

    const { dependencies } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    assert.equal(dependencies['@better-fetch/fetch'], betterAuthsBetterFetch())
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})
