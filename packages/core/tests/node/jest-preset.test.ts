/**
 * `@nextsparkjs/core/jest-preset` (#328): a project's Jest config extends it instead of repeating the module mappers. The starter's
 * config does, and a test of such a project can import `@nextsparkjs/core/selectors` and a module that imports `server-only` with
 * no other configuration. Every subpath exported with only an `import` condition has a fallback, so a CommonJS resolver finds it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8'))
const require = createRequire(path.join(CORE, 'package.json'))
const STARTER_JEST = path.join(CORE, 'templates/projects/starter/tests/jest')

test('every subpath exported with an import condition has a require or default fallback', () => {
  const importOnly = Object.entries(pkg.exports as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === 'object' && 'import' in value && !('require' in value) && !('default' in value))
    .map(([key]) => key)
  assert.deepEqual(importOnly, [])
  assert.equal(pkg.exports['./selectors'].default, pkg.exports['./selectors'].import)
})

test('the preset is exported and shipped, and its fixed mapper targets are in the package files', () => {
  assert.equal(pkg.exports['./jest-preset'], './jest-preset.cjs')
  assert.ok(pkg.files.includes('jest-preset.cjs'))
  const preset = require('@nextsparkjs/core/jest-preset')
  const targets = Object.entries(preset.moduleNameMapper as Record<string, string>).filter(([pattern]) => !pattern.includes('(.*)'))
  assert.ok(targets.some(([pattern]) => pattern === '^@nextsparkjs/core/selectors$'))
  assert.ok(targets.some(([pattern]) => pattern === '^server-only$'))
  for (const [pattern, target] of targets) {
    const relative = path.relative(CORE, target)
    assert.ok(fs.existsSync(target), `${pattern} -> ${relative} exists`)
    assert.ok(pkg.files.some((entry: string) => relative === entry || relative.startsWith(`${entry}/`)), `${relative} is packed`)
  }
})

test('the starter config extends the preset instead of repeating the core mappers', () => {
  const config = fs.readFileSync(path.join(STARTER_JEST, 'jest.config.cjs'), 'utf8')
  assert.match(config, /require\('@nextsparkjs\/core\/jest-preset'\)/)
  assert.doesNotMatch(config, /node_modules\/@nextsparkjs\/core\/dist/)
})

test('a project built on the starter config runs tests that import core selectors and a server-only module', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-jest-preset-')))
  try {
    const jest = path.join(root, 'tests/jest')
    fs.mkdirSync(path.join(root, 'node_modules/@nextsparkjs'), { recursive: true })
    fs.symlinkSync(CORE, path.join(root, 'node_modules/@nextsparkjs/core'), 'dir')
    for (const name of ['ts-jest', 'jest-environment-jsdom']) fs.symlinkSync(fs.realpathSync(path.join(CORE, 'node_modules', name)), path.join(root, 'node_modules', name), 'dir')
    fs.mkdirSync(path.join(root, 'node_modules/@testing-library'), { recursive: true })
    for (const name of ['jest-dom', 'react']) fs.symlinkSync(fs.realpathSync(path.join(CORE, 'node_modules/@testing-library', name)), path.join(root, 'node_modules/@testing-library', name), 'dir')
    fs.symlinkSync(fs.realpathSync(path.join(CORE, 'node_modules/@types')), path.join(root, 'node_modules/@types'), 'dir')
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"project"}')
    fs.cpSync(STARTER_JEST, jest, { recursive: true, filter: source => !/[\\/](services|example\.test\.tsx)$/.test(source) })
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler', target: 'es2020', lib: ['dom', 'esnext'], jsx: 'preserve', strict: true, esModuleInterop: true, skipLibCheck: true } }))
    fs.mkdirSync(path.join(root, 'lib'))
    fs.writeFileSync(path.join(root, 'lib/secret.ts'), "import 'server-only'\nexport const secret = 'kept on the server'\n")
    fs.writeFileSync(path.join(jest, 'selectors.test.ts'), "// @ts-nocheck\nimport { sel } from '@nextsparkjs/core/selectors'\nimport { sel as authSel } from '@nextsparkjs/core/selectors/auth'\nit('loads the selectors', () => { expect(typeof sel).toBe('function'); expect(typeof authSel).toBe('function') })\n")
    fs.writeFileSync(path.join(jest, 'server-only.test.ts'), "// @ts-nocheck\nimport { secret } from '@/lib/secret'\nit('loads a module that imports server-only', () => { expect(secret).toBe('kept on the server') })\n")
    const run = spawnSync(process.execPath, [path.join(fs.realpathSync(path.join(CORE, 'node_modules/jest')), 'bin/jest.js'), '--config', 'tests/jest/jest.config.cjs', '--maxWorkers=1', '--no-watchman', '--ci'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 240_000,
    })
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`)
    assert.match(run.stderr, /Tests:\s+2 passed, 2 total/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
