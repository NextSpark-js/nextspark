import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { workerBlocker, workerCommand } from '../src/commands/worker.js'

test('the worker runs the core entry under tsx with the project tsconfig and an empty server-only', () => {
  const { args, env } = workerCommand('/core', '/project')
  const preloads = args.filter((_, i) => args[i - 1] === '--import')
  assert.equal(preloads.length, 2)
  assert.ok(preloads[1].endsWith('preload.mjs'), 'the stub is registered after tsx')
  assert.equal(args.at(-1), join('/core', 'scripts', 'jobs', 'worker.mjs'))
  assert.equal(env.TSX_TSCONFIG_PATH, join('/project', 'tsconfig.json'))
  assert.equal(env.NEXTSPARK_CORE_DIR, '/core')
})

test('the worker does not start without pg-boss or without the generated registries, and says what to run', () => {
  const root = mkdtempSync(join(tmpdir(), 'worker-blocker-'))
  try {
    // (the no-pg-boss message is checked with the built CLI: tsx patches module resolution)
    // a project where pg-boss resolves but nothing was generated (core has pg-boss as a dev dependency)
    assert.match(workerBlocker(join(import.meta.dirname, '..', '..', 'core')) ?? '', /nextspark prepare/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
