/**
 * @jest-environment node
 *
 * OAUTH_ENCRYPTION_KEY is 32 bytes as base64. A hex key (what the plugin docs used to ask for) decodes to 48 bytes and
 * failed as a generic "Failed to encrypt token"; it now says what the key must be (#476).
 */
import { randomBytes, webcrypto } from 'node:crypto'

const ORIGINAL = process.env.OAUTH_ENCRYPTION_KEY

// tests/jest/setup.ts mocks crypto.subtle; this test needs the real AES-GCM
const subtle = globalThis.crypto.subtle as unknown as Record<string, unknown>
const mocked = { importKey: subtle.importKey, encrypt: subtle.encrypt, decrypt: subtle.decrypt }
beforeAll(() => {
  subtle.importKey = webcrypto.subtle.importKey.bind(webcrypto.subtle)
  subtle.encrypt = webcrypto.subtle.encrypt.bind(webcrypto.subtle)
  subtle.decrypt = webcrypto.subtle.decrypt.bind(webcrypto.subtle)
})
afterAll(() => Object.assign(subtle, mocked))

async function freshEncryption(key: string | undefined) {
  if (key === undefined) delete process.env.OAUTH_ENCRYPTION_KEY
  else process.env.OAUTH_ENCRYPTION_KEY = key
  jest.resetModules() // the class caches the imported key
  return import('@/core/lib/oauth/encryption')
}

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.OAUTH_ENCRYPTION_KEY
  else process.env.OAUTH_ENCRYPTION_KEY = ORIGINAL
})

describe('TokenEncryption and the OAUTH_ENCRYPTION_KEY format (#476)', () => {
  test('a base64 key of 32 bytes encrypts and decrypts', async () => {
    const { TokenEncryption } = await freshEncryption(randomBytes(32).toString('base64'))
    const { encrypted, iv, keyId } = await TokenEncryption.encrypt('page-token')
    await expect(TokenEncryption.decrypt(encrypted, iv, keyId)).resolves.toBe('page-token')
  })

  test.each([
    ['a hex key of 32 bytes', randomBytes(32).toString('hex')],
    ['a base64 key of 16 bytes', randomBytes(16).toString('base64')],
    ['a value that is not base64', 'not a key!'],
  ])('%s fails encrypt and decrypt with what the key must be, never the value', async (_label, key) => {
    const { TokenEncryption, OAUTH_KEY_FORMAT_MESSAGE } = await freshEncryption(key)
    expect(OAUTH_KEY_FORMAT_MESSAGE).toBe('OAUTH_ENCRYPTION_KEY must be 32 bytes encoded as base64; generate one with: openssl rand -base64 32')
    await expect(TokenEncryption.encrypt('page-token')).rejects.toThrow(OAUTH_KEY_FORMAT_MESSAGE)
    await expect(TokenEncryption.decrypt('AAAA', 'AAAA', 'v1')).rejects.toThrow(OAUTH_KEY_FORMAT_MESSAGE)
    const error = await TokenEncryption.encrypt('page-token').catch((e: Error) => e)
    expect(String((error as Error).message)).not.toContain(key)
  })

  test('a missing key says it is not set', async () => {
    const { TokenEncryption } = await freshEncryption(undefined)
    await expect(TokenEncryption.encrypt('page-token')).rejects.toThrow('OAUTH_ENCRYPTION_KEY environment variable is not set')
  })
})
