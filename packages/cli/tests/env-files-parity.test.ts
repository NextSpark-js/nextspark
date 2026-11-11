import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectEnvFiles } from '../src/utils/env-files.js'
// Core's list, by path: the CLI and core's scripts must read the same files (#438)
import { projectEnvFiles as coreProjectEnvFiles } from '../../core/scripts/utils/env-files.mjs'

test('the CLI and core read the same env files, in the same order, for every NODE_ENV', () => {
  for (const nodeEnv of [undefined, 'test', 'production', 'development']) {
    assert.deepEqual(projectEnvFiles(nodeEnv), coreProjectEnvFiles(nodeEnv), String(nodeEnv))
  }
  assert.deepEqual(projectEnvFiles('development'), ['.env.local', '.env'])
  assert.deepEqual(projectEnvFiles('test'), ['.env'])
})
