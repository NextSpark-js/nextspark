import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runnerArguments } from '../src/commands/db.js'

test('db:migrate hands the runner only the options it was given (#428)', () => {
  assert.deepEqual(runnerArguments({}), [])
  assert.deepEqual(runnerArguments({ strict: true }), ['--strict'])
  assert.deepEqual(runnerArguments({ sampleData: true, envFile: false, legacyTheme: 'app', strict: true }), ['--sample-data', '--no-env-file', '--legacy-theme', 'app', '--strict'])
  // commander sets envFile to true when --no-env-file is absent
  assert.deepEqual(runnerArguments({ envFile: true, strict: false }), [])
})
