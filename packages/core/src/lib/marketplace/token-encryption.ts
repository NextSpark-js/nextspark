/**
 * Marketplace Token Encryption
 *
 * AES-256-GCM encryption for MercadoPago OAuth tokens stored in the database.
 * Prevents plaintext credential exposure if the database is compromised.
 *
 * Encrypted format: "iv:authTag:ciphertext" (hex-encoded)
 *
 * Setup:
 *   Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Set MARKETPLACE_TOKEN_ENCRYPTION_KEY in .env
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

function getEncryptionKey(): Buffer {
  const key = process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'MARKETPLACE_TOKEN_ENCRYPTION_KEY is not configured. ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a single token string.
 * Returns "iv:authTag:ciphertext" in hex encoding.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a token encrypted by encryptToken.
 * Expects "iv:authTag:ciphertext" in hex encoding.
 */
export function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format. Expected "iv:authTag:ciphertext".')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Token fields that contain sensitive credentials and must be encrypted.
 */
interface MPTokenFields {
  accessToken: string
  refreshToken: string
  expiresAt: string
  publicKey: string
}

/**
 * Encrypt the sensitive fields (accessToken, refreshToken) in a token object.
 * Non-sensitive fields (expiresAt, publicKey) are left as-is.
 */
export function encryptTokens(tokens: MPTokenFields): MPTokenFields {
  return {
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: encryptToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    publicKey: tokens.publicKey,
  }
}

/**
 * Decrypt the sensitive fields (accessToken, refreshToken) in a token object.
 * Non-sensitive fields (expiresAt, publicKey) are returned as-is.
 */
export function decryptTokens(tokens: MPTokenFields): MPTokenFields {
  return {
    accessToken: decryptToken(tokens.accessToken),
    refreshToken: decryptToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    publicKey: tokens.publicKey,
  }
}
