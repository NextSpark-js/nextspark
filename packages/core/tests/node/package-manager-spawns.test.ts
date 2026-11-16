import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { packageManagerCommand, stepCommand } from '../../scripts/utils/package-manager.mjs'
import { runCommand } from '../../scripts/maintenance/core-updater.mjs'

// update-core and the cy-run-prod.cjs projects get start pnpm the same way on every platform (#450)
const require = createRequire(import.meta.url)
const cyRunProd = require('../../templates/scripts/cy-run-prod.cjs')

const AWKWARD = ['exec', 'cypress', 'run', '--spec', 'tests/My Specs/a&b.cy.ts', '--env', 'grepTags=@smoke|@api', 'C:\\dir\\', '']

test('update-core starts pnpm through the helper: quoted for cmd.exe on Windows, directly elsewhere', () => {
  assert.deepEqual(stepCommand('pnpm', ['install'], 'win32'), { command: 'pnpm "install"', args: [], shell: true, windowsHide: true })
  assert.deepEqual(stepCommand('pnpm', ['install'], 'linux'), { command: 'pnpm', args: ['install'], shell: false, windowsHide: true })
  // update-core downloads a plugin copy's package with npm pack (#473), also a .cmd shim on Windows
  assert.deepEqual(stepCommand('npm', ['pack', '@nextsparkjs/plugin-ai@1.0.0'], 'win32'), { command: 'npm "pack" "@nextsparkjs/plugin-ai@1.0.0"', args: [], shell: true, windowsHide: true })
  assert.throws(() => stepCommand('pnpm', ['view', '%x%'], 'win32'), /cannot quote/)
})

test('update-core starts git and node with no shell on any platform, so their arguments reach them as written', () => {
  const printf = ['submodule', 'foreach', '--quiet', 'printf "%s\\0" "$displaypath"']
  for (const platform of ['win32', 'linux', 'darwin']) {
    assert.deepEqual(stepCommand('git', printf, platform), { command: 'git', args: printf, shell: false, windowsHide: true })
    assert.deepEqual(stepCommand(process.execPath, ['cli.mjs'], platform), { command: process.execPath, args: ['cli.mjs'], shell: false, windowsHide: true })
  }
})

test('cy-run-prod.cjs builds the same pnpm command as core for every platform', () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    assert.deepEqual(cyRunProd.packageManagerCommand('pnpm', AWKWARD, platform), packageManagerCommand('pnpm', AWKWARD, platform))
  }
  assert.throws(() => cyRunProd.packageManagerCommand('pnpm', ['--env', 'a="b"'], 'win32'), /cannot quote/)
})

test('on this machine update-core hands pnpm each argument whole', () => {
  const values = ['My App', 'a&b|c<d>e^f!g', 'C:\\dir\\', 'plain']
  const result = runCommand('pnpm', ['exec', 'node', '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...values], { cwd: import.meta.dirname, capture: true })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').pop()!), values)
})

test('cy-run-prod.cjs starts pnpm through the helper: no shell on linux, one quoted command line on win32', () => {
  const calls: unknown[][] = []
  const spawner = (...call: unknown[]) => { calls.push(call); return {} }
  cyRunProd.spawnPnpm(spawner, ['build'], { cwd: 'x' }, 'linux')
  cyRunProd.spawnPnpm(spawner, ['build'], { cwd: 'x' }, 'win32')
  assert.deepEqual(calls, [
    ['pnpm', ['build'], { cwd: 'x', shell: false, windowsHide: true }],
    ['pnpm "build"', [], { cwd: 'x', shell: true, windowsHide: true }],
  ])
})
