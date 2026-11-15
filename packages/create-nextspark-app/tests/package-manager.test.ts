import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { packageManagerCommand } from '../src/utils/package-manager.js'
import { wizardCommand } from '../src/create.js'
// The CLI and core's scripts keep copies of the same function (#450)
import { packageManagerCommand as corePackageManagerCommand } from '../../core/scripts/utils/package-manager.mjs'

const ARGS = ['exec', 'nextspark', 'init', '--name', 'My App', '--description', 'Tom & Jerry <3', '--yes']

test('the wizard arguments reach pnpm whole on Windows and untouched elsewhere', () => {
  assert.deepEqual(packageManagerCommand('pnpm', ARGS, 'linux'), { command: 'pnpm', args: ARGS, shell: false, windowsHide: true })
  assert.deepEqual(packageManagerCommand('pnpm', ARGS, 'win32'), {
    command: 'pnpm "exec" "nextspark" "init" "--name" "My App" "--description" "Tom & Jerry <3" "--yes"',
    args: [],
    shell: true,
    windowsHide: true,
  })
  assert.throws(() => packageManagerCommand('pnpm', ['--name', '50% "off"'], 'win32'), /cannot quote/)
})

test('the wizard runs through pnpm exec, except on Windows, where Node runs the CLI entry and no .CMD shim is read', () => {
  const initArgs = ARGS.slice(1)
  const project = join('projects', 'my-app')
  assert.deepEqual(wizardCommand(project, initArgs, 'linux'), packageManagerCommand('pnpm', ARGS, 'linux'))
  assert.deepEqual(wizardCommand(project, initArgs, 'darwin'), packageManagerCommand('pnpm', ARGS, 'darwin'))
  assert.deepEqual(wizardCommand(project, initArgs, 'win32'), {
    command: process.execPath,
    args: [join(project, 'node_modules', '@nextsparkjs', 'cli', 'bin', 'nextspark.js'), 'init', '--name', 'My App', '--description', 'Tom & Jerry <3', '--yes'],
    shell: false,
    windowsHide: true,
  })
})

test('create-nextspark-app and core build the same command for every platform', () => {
  const args = [...ARGS, 'C:\\dir\\', '']
  for (const platform of ['win32', 'linux', 'darwin']) {
    assert.deepEqual(packageManagerCommand('pnpm', args, platform), corePackageManagerCommand('pnpm', args, platform))
  }
})
