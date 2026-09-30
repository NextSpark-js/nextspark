/**
 * The wizard writes mobile/package.json itself (createMobilePackageJson) and does not copy
 * packages/mobile/templates/package.json.template. The two lists drifted once: the template's
 * babel config loads react-native-css-interop, which neither declared, and Metro then failed on a
 * fresh project under pnpm's isolated layout. Keep them in step.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createMobilePackageJson } from '../src/wizard/generators/monorepo-generator.js'
import type { WizardConfig } from '../src/wizard/types.js'

const TEMPLATE_DIR = path.resolve(import.meta.dirname, '../../mobile/templates')
const names = (p: { dependencies?: object; devDependencies?: object }) =>
  Object.keys({ ...p.dependencies, ...p.devDependencies }).sort()

test('the wizard declares the same mobile packages as the shipped template', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-pkg-parity-'))
  try {
    await createMobilePackageJson(dir, { projectSlug: 'x', projectType: 'web-mobile' } as WizardConfig)
    const wizard = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    const template = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'package.json.template'), 'utf8'))
    assert.deepEqual(names(wizard), names(template))
    for (const n of ['react-native-css-interop', 'react-native-worklets', 'babel-preset-expo']) {
      assert.ok(wizard.dependencies[n], `${n} must be declared`)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
