/**
 * Encryption at rest for sellers' provider tokens: AES-256-GCM with a keyring, so a key can be rotated.
 *
 * MARKETPLACE_TOKEN_KEYS is `<id>:<base64 of 32 bytes>[,<id>:<base64>...]`. The first key encrypts; every key listed
 * decrypts. To rotate: put a new key first, keep the old one, let the rotation action re-encrypt the rows, then remove
 * the old key.
 *
 * A stored value is `v1.<key id>.<iv>.<tag>.<ciphertext>`, each part base64url. `context` (the account and the field)
 * is authenticated with it, so one seller's ciphertext cannot be moved to another seller or field and still decrypt.
 * Errors never hold a token or a key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface TokenKeyring {
  currentKeyId: string
  keys: Map<string, Buffer>
}

export const ROTATE_TOKEN_KEYS_ACTION = 'marketplace-payments:rotate-token-keys'

const FORMAT = 'v1'
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/
// ponytail: 500 rows per run of the daily action; rerun it by hand after a rotation with more sellers than that
const ROTATION_BATCH = 500

export function parseTokenKeyring(value: string | undefined): TokenKeyring {
  const keys = new Map<string, Buffer>()
  let currentKeyId = ''
  for (const entry of (value ?? '').split(',').map(part => part.trim()).filter(Boolean)) {
    const separator = entry.indexOf(':')
    const id = entry.slice(0, separator)
    const key = Buffer.from(entry.slice(separator + 1), 'base64')
    if (separator < 1 || !KEY_ID.test(id) || key.length !== 32 || keys.has(id)) {
      throw new Error('MARKETPLACE_TOKEN_KEYS must be <id>:<base64 of 32 bytes>, with distinct ids, separated by commas')
    }
    if (!currentKeyId) currentKeyId = id
    keys.set(id, key)
  }
  if (!currentKeyId) throw new Error('MARKETPLACE_TOKEN_KEYS is not set')
  return { currentKeyId, keys }
}

export function encryptToken(plaintext: string, keyring: TokenKeyring, context: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyring.keys.get(keyring.currentKeyId)!, iv)
  cipher.setAAD(Buffer.from(context))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [FORMAT, keyring.currentKeyId, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptToken(stored: string, keyring: TokenKeyring, context: string): string {
  const parts = stored.split('.')
  if (parts.length !== 5 || parts[0] !== FORMAT) throw new Error('Stored token has an unknown format')
  const key = keyring.keys.get(parts[1])
  if (!key) throw new Error('Stored token was encrypted with a key that is no longer configured')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[2], 'base64url'), { authTagLength: 16 })
    decipher.setAAD(Buffer.from(context))
    decipher.setAuthTag(Buffer.from(parts[3], 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored token could not be decrypted')
  }
}

export function isOnCurrentKey(stored: string, keyring: TokenKeyring): boolean {
  return stored.startsWith(`${FORMAT}.${keyring.currentKeyId}.`)
}

export const accessTokenContext = (accountId: string) => `${accountId}:accessToken`
export const refreshTokenContext = (accountId: string) => `${accountId}:refreshToken`

export interface EncryptedCredential {
  accountId: string
  accessTokenEnc: string
  refreshTokenEnc: string
}

export interface KeyRotationStore {
  /** Accounts with a token on another key, ordered by id, after `after`. */
  listCredentialsNotOnKey(keyId: string, after: string | null, limit: number): Promise<string[]>
  /** Runs `rewrite` with the row locked and saves what it returns; a locked row is skipped. */
  rewriteLockedCredential(accountId: string, rewrite: (row: EncryptedCredential) => EncryptedCredential): Promise<void>
}

/** Re-encrypts with the current key every credential on an older one. A row that cannot be decrypted is counted and left as it is. */
export async function rotateSellerTokenKeys(store: KeyRotationStore, keyring: TokenKeyring): Promise<{ rotated: number; failed: number }> {
  const summary = { rotated: 0, failed: 0 }
  let after: string | null = null
  for (;;) {
    const ids: string[] = await store.listCredentialsNotOnKey(keyring.currentKeyId, after, ROTATION_BATCH)
    for (const accountId of ids) {
      try {
        await store.rewriteLockedCredential(accountId, row => ({
          accountId,
          accessTokenEnc: encryptToken(decryptToken(row.accessTokenEnc, keyring, accessTokenContext(accountId)), keyring, accessTokenContext(accountId)),
          refreshTokenEnc: encryptToken(decryptToken(row.refreshTokenEnc, keyring, refreshTokenContext(accountId)), keyring, refreshTokenContext(accountId)),
        }))
        summary.rotated++
      } catch (error) {
        summary.failed++
        console.error(`[marketplace-payments] Key rotation failed for account ${accountId} (${error instanceof Error ? error.message : 'unexpected error'})`)
      }
    }
    if (ids.length < ROTATION_BATCH) return summary
    after = ids[ids.length - 1]
  }
}
