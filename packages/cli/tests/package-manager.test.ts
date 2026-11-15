import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { packageManagerCommand } from '../src/utils/package-manager.js'
// Core's scripts start pnpm and npx with their own copy (#450)
import { packageManagerCommand as corePackageManagerCommand } from '../../core/scripts/utils/package-manager.mjs'

const AWKWARD = ['view', '@nextsparkjs/core@0.1.0-beta.1', 'My App', 'a&b|c<d>e^f!g', 'C:\\Users\\Me\\', '']

test('outside Windows pnpm and npx start directly, with the arguments untouched', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.deepEqual(packageManagerCommand('pnpm', AWKWARD, platform), { command: 'pnpm', args: AWKWARD, shell: false })
    assert.deepEqual(packageManagerCommand('npx', ['next', 'dev'], platform), { command: 'npx', args: ['next', 'dev'], shell: false })
  }
})

test('on Windows the shell gets one command line with every argument quoted', () => {
  assert.deepEqual(packageManagerCommand('pnpm', AWKWARD, 'win32'), {
    command: 'pnpm "view" "@nextsparkjs/core@0.1.0-beta.1" "My App" "a&b|c<d>e^f!g" "C:\\Users\\Me\\\\" ""',
    args: [],
    shell: true,
  })
  assert.deepEqual(packageManagerCommand('npx', [], 'win32'), { command: 'npx', args: [], shell: true })
})

test('on Windows an argument cmd.exe cannot quote is refused, not run', () => {
  for (const arg of ['say "hi"', '%PATH%', 'two\nlines', 'cr\r']) {
    assert.throws(() => packageManagerCommand('pnpm', ['view', arg], 'win32'), /cannot quote/)
  }
  // The same arguments go through untouched elsewhere: no shell reads them
  assert.deepEqual(packageManagerCommand('pnpm', ['%PATH%'], 'linux').args, ['%PATH%'])
})

test('the CLI and core build the same command for every platform', () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    for (const command of ['pnpm', 'npx'] as const) {
      assert.deepEqual(packageManagerCommand(command, AWKWARD, platform), corePackageManagerCommand(command, AWKWARD, platform))
      assert.throws(() => corePackageManagerCommand(command, ['%x%'], 'win32'), /cannot quote/)
    }
  }
})

test('on this machine pnpm receives each argument whole', () => {
  const values = ['My App', 'a&b|c<d>e^f!g', 'C:\\dir\\', 'plain']
  const pnpm = packageManagerCommand('pnpm', ['exec', 'node', '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...values])
  const output = execFileSync(pnpm.command, pnpm.args, { shell: pnpm.shell, cwd: import.meta.dirname, encoding: 'utf8' })
  assert.deepEqual(JSON.parse(output.trim().split('\n').pop()!), values)
})
