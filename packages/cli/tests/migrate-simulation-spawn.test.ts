import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simulationSpawnOptions } from '../src/commands/migrate.js'

test('the simulation runs its children in a process group off Windows, and attached with no window on Windows (#468)', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.deepEqual(simulationSpawnOptions(platform), { detached: true, windowsHide: true }, platform)
  }
  // detached on Windows means no console, and each git or node the child starts would open a window of its own
  assert.deepEqual(simulationSpawnOptions('win32'), { detached: false, windowsHide: true })
})
