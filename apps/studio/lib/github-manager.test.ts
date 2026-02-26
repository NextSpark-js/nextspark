/**
 * GitHub Manager Tests
 *
 * Tests for pure/extractable functions: token encryption/decryption,
 * OAuth state parsing, and configuration checks.
 *
 * Network-dependent functions (createRepo, pushProject, etc.) are NOT tested here.
 */

// Mock ESM-only dependencies that Jest can't parse
jest.mock('octokit', () => ({
  Octokit: jest.fn(),
}))
jest.mock('./project-manager', () => ({
  getProjectPath: jest.fn(() => '/mock/path'),
}))

import { encryptToken, decryptToken, parseState, isConfigured, isDevMode, getDevToken } from './github-manager'

// ── Token Encryption/Decryption ─────────────────────────────────────────

describe('encryptToken / decryptToken', () => {
  it('round-trips a token correctly', () => {
    const token = 'ghp_abc123XYZ789'
    const encrypted = encryptToken(token)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const token = 'ghp_test_token'
    const a = encryptToken(token)
    const b = encryptToken(token)
    expect(a).not.toBe(b) // Different IVs → different ciphertext
  })

  it('encrypted format contains IV and data separated by colon', () => {
    const encrypted = encryptToken('test')
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+$/)
  })

  it('throws on invalid encrypted token format (no colon)', () => {
    expect(() => decryptToken('invalidhexstring')).toThrow()
  })

  it('throws on corrupted ciphertext', () => {
    const encrypted = encryptToken('test')
    const [iv] = encrypted.split(':')
    expect(() => decryptToken(`${iv}:deadbeef`)).toThrow()
  })

  it('handles empty string token', () => {
    const encrypted = encryptToken('')
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe('')
  })

  it('handles long tokens', () => {
    const longToken = 'ghp_' + 'a'.repeat(500)
    const encrypted = encryptToken(longToken)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(longToken)
  })
})

// ── OAuth State Parsing ─────────────────────────────────────────────────

describe('parseState', () => {
  it('parses valid base64url-encoded state with returnTo', () => {
    const payload = JSON.stringify({ nonce: 'abc123', returnTo: '/dashboard' })
    const state = Buffer.from(payload).toString('base64url')
    const result = parseState(state)
    expect(result.returnTo).toBe('/dashboard')
  })

  it('defaults to /build for missing returnTo', () => {
    const payload = JSON.stringify({ nonce: 'abc123' })
    const state = Buffer.from(payload).toString('base64url')
    const result = parseState(state)
    expect(result.returnTo).toBe('/build')
  })

  it('defaults to /build for invalid base64url', () => {
    const result = parseState('!!!not-valid-base64!!!')
    expect(result.returnTo).toBe('/build')
  })

  it('defaults to /build for non-JSON content', () => {
    const state = Buffer.from('just a string').toString('base64url')
    const result = parseState(state)
    expect(result.returnTo).toBe('/build')
  })
})

// ── Configuration Checks ────────────────────────────────────────────────

describe('configuration checks', () => {
  // These depend on env vars — test the current state without mocking
  // (in CI/dev, GITHUB_CLIENT_ID is usually not set, GITHUB_PAT may be)

  it('isConfigured returns a boolean', () => {
    expect(typeof isConfigured()).toBe('boolean')
  })

  it('isDevMode returns a boolean', () => {
    expect(typeof isDevMode()).toBe('boolean')
  })

  it('getDevToken returns string or null', () => {
    const token = getDevToken()
    expect(token === null || typeof token === 'string').toBe(true)
  })
})
