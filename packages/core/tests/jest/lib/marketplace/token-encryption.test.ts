/**
 * Token Encryption Tests
 *
 * AES-256-GCM encryption/decryption for marketplace OAuth tokens.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { encryptToken, decryptToken, encryptTokens, decryptTokens } from '@/core/lib/marketplace/token-encryption'

const VALID_KEY = 'a'.repeat(64) // 32 bytes in hex

describe('Token Encryption', () => {
  let originalKey: string | undefined

  beforeEach(() => {
    originalKey = process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY
    process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY
    } else {
      process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = originalKey
    }
  })

  describe('encryptToken', () => {
    test('should return a string in "iv:authTag:ciphertext" format', () => {
      const encrypted = encryptToken('my-secret-token')
      const parts = encrypted.split(':')

      expect(parts).toHaveLength(3)
      // IV = 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24)
      // Auth tag = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32)
      // Ciphertext should be non-empty hex
      expect(parts[2].length).toBeGreaterThan(0)
      // All parts should be valid hex
      parts.forEach((part) => {
        expect(part).toMatch(/^[0-9a-f]+$/)
      })
    })

    test('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'same-token-value'
      const encrypted1 = encryptToken(plaintext)
      const encrypted2 = encryptToken(plaintext)

      expect(encrypted1).not.toBe(encrypted2)

      // Both should still decrypt to the same value
      expect(decryptToken(encrypted1)).toBe(plaintext)
      expect(decryptToken(encrypted2)).toBe(plaintext)
    })
  })

  describe('decryptToken', () => {
    test('should reverse encryptToken correctly (roundtrip)', () => {
      const plaintext = 'APP_USR-abc123-refresh-token-xyz'
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    test('should handle empty string', () => {
      const encrypted = encryptToken('')
      expect(decryptToken(encrypted)).toBe('')
    })

    test('should handle unicode characters', () => {
      const plaintext = 'token-with-unicode-\u00e9\u00e8\u00ea'
      const encrypted = encryptToken(plaintext)
      expect(decryptToken(encrypted)).toBe(plaintext)
    })

    test('should throw on tampered ciphertext', () => {
      const encrypted = encryptToken('my-secret-token')
      const parts = encrypted.split(':')
      // Tamper with the ciphertext portion
      const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`

      expect(() => decryptToken(tampered)).toThrow()
    })

    test('should throw on invalid format (missing parts)', () => {
      expect(() => decryptToken('only-one-part')).toThrow(
        'Invalid encrypted token format'
      )
      expect(() => decryptToken('two:parts')).toThrow(
        'Invalid encrypted token format'
      )
      expect(() => decryptToken('too:many:parts:here')).toThrow(
        'Invalid encrypted token format'
      )
    })
  })

  describe('encryptTokens', () => {
    test('should only encrypt accessToken and refreshToken, leave expiresAt and publicKey unchanged', () => {
      const tokens = {
        accessToken: 'APP_USR-access-123',
        refreshToken: 'TG-refresh-456',
        expiresAt: '2025-12-31T23:59:59Z',
        publicKey: 'APP_USR-public-789',
      }

      const encrypted = encryptTokens(tokens)

      // Sensitive fields should be encrypted (different from original)
      expect(encrypted.accessToken).not.toBe(tokens.accessToken)
      expect(encrypted.refreshToken).not.toBe(tokens.refreshToken)

      // Encrypted fields should have the iv:authTag:ciphertext format
      expect(encrypted.accessToken.split(':')).toHaveLength(3)
      expect(encrypted.refreshToken.split(':')).toHaveLength(3)

      // Non-sensitive fields should be unchanged
      expect(encrypted.expiresAt).toBe(tokens.expiresAt)
      expect(encrypted.publicKey).toBe(tokens.publicKey)
    })
  })

  describe('decryptTokens', () => {
    test('should reverse encryptTokens correctly', () => {
      const tokens = {
        accessToken: 'APP_USR-access-123',
        refreshToken: 'TG-refresh-456',
        expiresAt: '2025-12-31T23:59:59Z',
        publicKey: 'APP_USR-public-789',
      }

      const encrypted = encryptTokens(tokens)
      const decrypted = decryptTokens(encrypted)

      expect(decrypted).toEqual(tokens)
    })
  })

  describe('encryption key validation', () => {
    test('should throw if MARKETPLACE_TOKEN_ENCRYPTION_KEY is not set', () => {
      delete process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY

      expect(() => encryptToken('test')).toThrow(
        'MARKETPLACE_TOKEN_ENCRYPTION_KEY is not configured'
      )
    })

    test('should throw if encryption key is invalid length', () => {
      // 16 hex chars = 8 bytes, too short for AES-256 which needs 32 bytes
      process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = 'a'.repeat(16)

      expect(() => encryptToken('test')).toThrow()
    })
  })
})
