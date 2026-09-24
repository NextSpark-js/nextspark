/** Root-first environment validation has no .env or project-selection requirements. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateEnvironment } from './config.mjs'

describe('validateEnvironment', () => {
  it('accepts a root-first project without an env file', () => {
    assert.deepEqual(validateEnvironment(), { valid: true, errors: [] })
  })

})
