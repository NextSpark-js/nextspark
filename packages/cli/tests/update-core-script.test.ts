import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { updatePackageJson } from '../src/wizard/generators/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

test('a generated project gets an update-core script wired to the core package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-update-core-script-'))
  const previousCwd = process.cwd()
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'app', private: true }))

    process.chdir(root)
    await updatePackageJson({ projectSlug: 'app' } as WizardConfig)

    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'))
    assert.equal(
      packageJson.scripts['update-core'],
      'node node_modules/@nextsparkjs/core/scripts/maintenance/update-core.mjs'
    )
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})
