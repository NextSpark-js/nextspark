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

import { createMobilePackageJson, generateMonorepoStructure } from '../src/wizard/generators/monorepo-generator.js'
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
    // Expo SDK 54 expects these exactly; expo-doctor fails otherwise
    for (const n of ['react-native-worklets', '@types/react']) {
      const pick = (p: any) => p.dependencies?.[n] ?? p.devDependencies?.[n]
      assert.equal(pick(wizard), pick(template), `${n} must be pinned the same in both`)
    }
    assert.equal(wizard.dependencies['react-native-worklets'], '0.5.1')
    assert.equal(wizard.devDependencies['@types/react'], '~19.1.10')
    for (const n of ['react-native-css-interop', 'react-native-worklets', 'babel-preset-expo']) {
      assert.ok(wizard.dependencies[n], `${n} must be declared`)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('app.config.ts keeps the whole project name, escaped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-app-config-'))
  try {
    await generateMonorepoStructure(dir, {
      projectName: "Bob's \\ \"App\"\nTwo",
      projectSlug: 'bobs-app',
      projectType: 'web-mobile',
    } as WizardConfig)
    const src = fs.readFileSync(path.join(dir, 'mobile/app.config.ts'), 'utf8')
    // JSON.stringify: quotes, backslashes and newlines all stay inside one valid string literal
    assert.ok(src.includes(`name: ${JSON.stringify("Bob's \\ \"App\"\nTwo")},`), src)
    assert.ok(src.includes('slug: "bobs-app",'), src)
    assert.ok(src.includes("scheme: 'bobs-app'"))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
