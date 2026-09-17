import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { directFsWritesIn, generatorFiles } from '../../core/scripts/build/registry/__tests__/direct-fs-writes.mjs'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The commands that write in a project, or start what does: sync:app, build, dev, registry:build and registry:watch, and generate. */
const COMMANDS = ['sync-app', 'build', 'dev', 'registry', 'generate'].map((name) => join(PKG_ROOT, 'src', 'commands', `${name}.ts`))

test('no file the commands that write in a project load changes the file system except through core’s safe-fs', () => {
  const files: string[] = generatorFiles({ entries: COMMANDS, within: join(PKG_ROOT, 'src') })
  const names = files.map((file) => file.slice(PKG_ROOT.length + 1))
  for (const expected of [
    'src/commands/sync-app.ts',
    'src/commands/registry.ts',
    'src/utils/sync-files.ts',
    'src/utils/sync-state.ts',
    'src/utils/sync-plan.ts',
    'src/utils/templates-gitignore.ts',
    'src/utils/proxy-file.ts',
    'src/utils/registry-build.ts',
    'src/utils/core-write-places.ts',
  ]) {
    assert.ok(names.includes(expected), `${expected} is scanned`)
  }
  assert.deepEqual(directFsWritesIn(files, { base: PKG_ROOT }), [])
})
