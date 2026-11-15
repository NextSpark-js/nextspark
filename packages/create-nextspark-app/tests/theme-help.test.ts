import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

import {
  PROJECT_TEMPLATE_OPTIONS,
  selectTheme,
} from '../../cli/src/wizard/generators/theme-plugins-installer.js'
import { packageManagerCommand } from '../src/utils/package-manager.js'

/** `pnpm` the way the code under test starts it: through cmd.exe, every argument quoted, on Windows (#450) */
function pnpmCall<T extends object>(args: string[], options: T) {
  const call = packageManagerCommand('pnpm', args)
  return [call.command, call.args, { ...options, shell: call.shell, windowsHide: call.windowsHide }] as const
}

const PACKAGE_ROOT = new URL('..', import.meta.url)

function advertisedThemeNames(): string[] {
  const result = spawnSync(...pnpmCall(['exec', 'tsx', 'src/index.ts', '--help'], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  }))
  assert.equal(result.status, 0, result.stderr)

  // commander wraps long descriptions, at a column that depends on the longest option name
  const match = result.stdout.replace(/\s+/g, ' ').match(/Theme to use \(([^)]+)\)/)
  assert.ok(match, `could not find the --theme help text:\n${result.stdout}`)
  return match[1].split(', ')
}

test('the create-app --theme help advertises exactly the templates accepted by nextspark init', () => {
  const advertised = advertisedThemeNames()

  assert.deepEqual(advertised, PROJECT_TEMPLATE_OPTIONS)
  for (const template of advertised) assert.doesNotThrow(() => selectTheme(template))
})
