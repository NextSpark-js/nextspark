/**
 * A new project declares, for every dependency it shares with @nextsparkjs/core, a range that does not start
 * below core's, so the first `update-core` has nothing to list under "Not moved" (#397). The test reads core's
 * real package.json and runs update-core's own comparison; there is no second copy of the ranges here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import semver from 'semver'

import { getTemplatesDir } from '../src/wizard/generators/templates-dir.js'
import { readTemplateDependencies } from '../src/wizard/generators/theme-renamer.js'
import { updatePackageJson } from '../src/wizard/generators/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

const TEMPLATES = getTemplatesDir()
const CORE = path.resolve(TEMPLATES, '..')
const core = JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8'))
const { dependenciesBelowCore } = await import(path.join(CORE, 'scripts/maintenance/dependency-floors.mjs'))

for (const template of ['starter', 'blog', 'crm', 'productivity']) {
  test(`${template}: no dependency the wizard writes is below core's range`, async () => {
    const previous = process.cwd()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-core-ranges-'))
    process.chdir(dir)
    try {
      await updatePackageJson({ projectSlug: 'acme', projectType: 'web' } as WizardConfig, await readTemplateDependencies(TEMPLATES, template))
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))

      assert.deepEqual(dependenciesBelowCore(pkg, core, semver), [])
      // The six that were behind take core's range as it is.
      for (const name of ['@hookform/resolvers', '@tanstack/react-query', 'lucide-react', 'react-hook-form', 'sonner', 'tailwind-merge']) {
        assert.equal(pkg.dependencies[name], core.dependencies[name], name)
      }
    } finally {
      process.chdir(previous)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}
