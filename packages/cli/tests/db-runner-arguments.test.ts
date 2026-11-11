import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runnerArguments } from '../src/commands/db.js'

test('db:migrate hands the runner only the options it was given (#428, #429)', () => {
  assert.deepEqual(runnerArguments({}), [])
  assert.deepEqual(runnerArguments({ strict: true }), ['--strict'])
  assert.deepEqual(runnerArguments({ dryRun: true }), ['--dry-run'])
  assert.deepEqual(runnerArguments({ expectDatabase: 'app', expectHost: 'db.example.com' }), ['--expect-database', 'app', '--expect-host', 'db.example.com'])
  assert.deepEqual(
    runnerArguments({ sampleData: true, envFile: false, legacyTheme: 'app', strict: true, dryRun: true, expectDatabase: 'app' }),
    ['--sample-data', '--no-env-file', '--legacy-theme', 'app', '--strict', '--dry-run', '--expect-database', 'app'],
  )
  // commander sets envFile to true when --no-env-file is absent
  assert.deepEqual(runnerArguments({ envFile: true, strict: false }), [])
})
