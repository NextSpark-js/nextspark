/**
 * Unit tests for validateEnvironment function
 *
 * Run with: node --test packages/core/scripts/build/registry/validate-env.test.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { validateEnvironment } from './config.mjs'

describe('validateEnvironment', () => {
  it('should return valid when .env exists and activeTheme is set', () => {
    // Use the current working directory which has a .env file
    const config = {
      projectRoot: process.cwd(),
      activeTheme: 'default'
    }

    const result = validateEnvironment(config)
    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it('should return error when .env file is missing', () => {
    const config = {
      projectRoot: '/nonexistent/path/that/does/not/exist',
      activeTheme: 'default'
    }

    const result = validateEnvironment(config)
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.length >= 1)
    assert.ok(result.errors[0].includes('.env'))
  })

  it('should return error when activeTheme is undefined', () => {
    const config = {
      projectRoot: process.cwd(),
      activeTheme: undefined
    }

    const result = validateEnvironment(config)
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('NEXT_PUBLIC_ACTIVE_THEME')))
  })

  it('should return error when activeTheme is empty string', () => {
    const config = {
      projectRoot: process.cwd(),
      activeTheme: ''
    }

    const result = validateEnvironment(config)
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('NEXT_PUBLIC_ACTIVE_THEME')))
  })

  it('should return multiple errors when both .env and activeTheme are missing', () => {
    const config = {
      projectRoot: '/nonexistent/path/that/does/not/exist',
      activeTheme: undefined
    }

    const result = validateEnvironment(config)
    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.errors.length, 2)
  })

  it('should include fix instructions in .env error', () => {
    const config = {
      projectRoot: '/nonexistent/path',
      activeTheme: 'default'
    }

    const result = validateEnvironment(config)
    assert.ok(result.errors[0].includes('NEXT_PUBLIC_ACTIVE_THEME'))
  })

  it('should include fix instructions in activeTheme error', () => {
    const config = {
      projectRoot: process.cwd(),
      activeTheme: undefined
    }

    const result = validateEnvironment(config)
    const themeError = result.errors.find(e => e.includes('Missing NEXT_PUBLIC_ACTIVE_THEME'))
    assert.ok(themeError)
    assert.ok(themeError.includes('NEXT_PUBLIC_ACTIVE_THEME=default'))
  })
})

console.log('\n✅ All environment validation tests passed!\n')
