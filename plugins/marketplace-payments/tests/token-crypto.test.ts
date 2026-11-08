import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  accessTokenContext,
  decryptToken,
  encryptToken,
  isOnCurrentKey,
  parseTokenKeyring,
  refreshTokenContext,
  rotateSellerTokenKeys,
  type EncryptedCredential,
  type KeyRotationStore,
} from '../lib/token-crypto'

const key = () => randomBytes(32).toString('base64')
const KEY1 = key()
const KEY2 = key()
const CONTEXT = 'acc-1:accessToken'

test('a token round-trips and the ciphertext does not hold it', () => {
  const keyring = parseTokenKeyring(`k1:${KEY1}`)
  const stored = encryptToken('APP_USR-secret', keyring, CONTEXT)
  assert.ok(!stored.includes('APP_USR'))
  assert.match(stored, /^v1\.k1\./)
  assert.equal(decryptToken(stored, keyring, CONTEXT), 'APP_USR-secret')
  assert.notEqual(encryptToken('x', keyring, CONTEXT), encryptToken('x', keyring, CONTEXT))
})

test('a token encrypted with the old key decrypts after a rotation, and new ones use the new key', () => {
  const old = parseTokenKeyring(`k1:${KEY1}`)
  const stored = encryptToken('t0ken', old, CONTEXT)
  const rotated = parseTokenKeyring(`k2:${KEY2},k1:${KEY1}`)
  assert.equal(decryptToken(stored, rotated, CONTEXT), 't0ken')
  assert.match(encryptToken('t0ken', rotated, CONTEXT), /^v1\.k2\./)
  assert.equal(isOnCurrentKey(stored, rotated), false)
  assert.equal(isOnCurrentKey(stored, old), true)
})

test('a removed key, another account, a tampered value or a bad format fail, and the error holds no token', () => {
  const keyring = parseTokenKeyring(`k1:${KEY1}`)
  const stored = encryptToken('t0ken', keyring, CONTEXT)
  assert.throws(() => decryptToken(stored, parseTokenKeyring(`k2:${KEY2}`), CONTEXT), /no longer configured/)
  assert.throws(() => decryptToken(stored, keyring, 'acc-2:accessToken'), /could not be decrypted/)
  assert.throws(() => decryptToken(stored, keyring, 'acc-1:refreshToken'), /could not be decrypted/)
  const parts = stored.split('.')
  parts[4] = Buffer.from('forged').toString('base64url')
  assert.throws(() => decryptToken(parts.join('.'), keyring, CONTEXT), /could not be decrypted/)
  assert.throws(() => decryptToken('plain-token', keyring, CONTEXT), (error: Error) => /unknown format/.test(error.message) && !error.message.includes('plain-token'))
  // the same bytes under a different key id
  const swapped = stored.split('.')
  swapped[1] = 'k2'
  assert.throws(() => decryptToken(swapped.join('.'), parseTokenKeyring(`k2:${KEY2},k1:${KEY1}`), CONTEXT), /could not be decrypted/)
})

test('a stored value must carry the whole authentication tag', () => {
  const keyring = parseTokenKeyring(`k1:${KEY1}`)
  const parts = encryptToken('t0ken', keyring, CONTEXT).split('.')
  parts[3] = Buffer.from(parts[3], 'base64url').subarray(0, 4).toString('base64url')
  assert.throws(() => decryptToken(parts.join('.'), keyring, CONTEXT), /could not be decrypted/)
})

test('a keyring must be well formed and the error holds no key', () => {
  for (const value of [undefined, '', 'nokey', `:${KEY1}`, 'k1:short', `bad id:${KEY1}`, `k1:${KEY1},k1:${KEY2}`]) {
    assert.throws(() => parseTokenKeyring(value), (error: Error) => !error.message.includes(KEY1), String(value))
  }
})

function memoryRotationStore(rows: EncryptedCredential[]): KeyRotationStore {
  return {
    listCredentialsNotOnKey: async (keyId, after, limit) =>
      rows
        .filter(row => (!row.accessTokenEnc.startsWith(`v1.${keyId}.`) || !row.refreshTokenEnc.startsWith(`v1.${keyId}.`)) && (after === null || row.accountId > after))
        .map(row => row.accountId)
        .sort()
        .slice(0, limit),
    rewriteLockedCredential: async (id, rewrite) => {
      const index = rows.findIndex(row => row.accountId === id)
      rows[index] = rewrite(rows[index])
    },
  }
}

const credential = (accountId: string, keyring: ReturnType<typeof parseTokenKeyring>): EncryptedCredential => ({
  accountId,
  accessTokenEnc: encryptToken(`access-${accountId}`, keyring, accessTokenContext(accountId)),
  refreshTokenEnc: encryptToken(`refresh-${accountId}`, keyring, refreshTokenContext(accountId)),
})

test('the rotation moves every row to the current key and they still decrypt with the old key removed', async () => {
  const old = parseTokenKeyring(`k1:${KEY1}`)
  const rows = [credential('a', old), credential('b', old)]
  const rotated = parseTokenKeyring(`k2:${KEY2},k1:${KEY1}`)
  assert.deepEqual(await rotateSellerTokenKeys(memoryRotationStore(rows), rotated), { rotated: 2, failed: 0 })
  const newOnly = parseTokenKeyring(`k2:${KEY2}`)
  for (const row of rows) {
    assert.equal(decryptToken(row.accessTokenEnc, newOnly, accessTokenContext(row.accountId)), `access-${row.accountId}`)
    assert.equal(decryptToken(row.refreshTokenEnc, newOnly, refreshTokenContext(row.accountId)), `refresh-${row.accountId}`)
  }
  assert.deepEqual(await rotateSellerTokenKeys(memoryRotationStore(rows), rotated), { rotated: 0, failed: 0 })
})

test('a row that cannot be decrypted is counted, stays untouched, and does not stop the others', async t => {
  t.mock.method(console, 'error', () => {})
  const old = parseTokenKeyring(`k1:${KEY1}`)
  const rows = [{ accountId: 'a', accessTokenEnc: 'garbage', refreshTokenEnc: 'garbage' }, credential('b', old)]
  const rotated = parseTokenKeyring(`k2:${KEY2},k1:${KEY1}`)
  assert.deepEqual(await rotateSellerTokenKeys(memoryRotationStore(rows), rotated), { rotated: 1, failed: 1 })
  assert.equal(rows[0].accessTokenEnc, 'garbage')
})
