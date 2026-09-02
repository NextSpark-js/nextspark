/**
 * API key cache invalidation (#92)
 *
 * validateApiKey() consults an in-process cache BEFORE the database, so a
 * revoked key kept authenticating for up to 5 minutes. Status changes must
 * drop the cached entry so the next request re-reads the row.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import type { NextRequest } from 'next/server'

jest.mock('../../../../src/lib/db', () => ({
  queryOne: jest.fn(),
}))

import { queryOne } from '../../../../src/lib/db'
import { ApiKeyManager } from '../../../../src/lib/api/keys'
import {
  validateApiKey,
  invalidateApiKeyCache,
  invalidateApiKeyCacheById,
} from '../../../../src/lib/api/auth'

const mockedQueryOne = queryOne as unknown as jest.Mock

function requestWithKey(key: string): NextRequest {
  return {
    headers: {
      get: (header: string) => (header === 'Authorization' ? `Bearer ${key}` : null),
    },
  } as unknown as NextRequest
}

function activeRow(id: string, userId = 'user-1') {
  return {
    id,
    userId,
    scopes: ['users:read'],
    status: 'active',
    expiresAt: null,
    failedAttempts: 0,
    lockedUntil: null,
  }
}

/** Only count the SELECT that looks the key up (not lastUsedAt updates etc.) */
function lookupCalls() {
  return mockedQueryOne.mock.calls.filter(([sql]) => String(sql).includes('WHERE "keyHash"')).length
}

describe('API key cache invalidation (#92)', () => {
  beforeEach(() => {
    mockedQueryOne.mockReset()
  })

  test('a revoked key keeps authenticating from cache until the entry is invalidated', async () => {
    const { key, hash } = await ApiKeyManager.generateApiKey()
    const keyId = 'key-revoke-test'

    mockedQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('WHERE "keyHash"')) return activeRow(keyId)
      return null
    })

    // 1. First use populates the cache
    expect(await validateApiKey(requestWithKey(key))).toMatchObject({ keyId })
    expect(lookupCalls()).toBe(1)

    // 2. The key is revoked in the DB, but the cache still says active
    mockedQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('WHERE "keyHash"')) return { ...activeRow(keyId), status: 'inactive' }
      return null
    })
    expect(await validateApiKey(requestWithKey(key))).toMatchObject({ keyId })
    expect(lookupCalls()).toBe(1) // served from cache: this is the bug window

    // 3. Invalidating (what the revoke endpoint now does) forces a re-read → rejected
    invalidateApiKeyCache(hash)
    expect(await validateApiKey(requestWithKey(key))).toBeNull()
    expect(lookupCalls()).toBe(2)
  })

  test('invalidateApiKeyCacheById resolves the hash and drops the entry', async () => {
    const { key, hash } = await ApiKeyManager.generateApiKey()
    const keyId = 'key-by-id-test'

    mockedQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('WHERE "keyHash"')) return activeRow(keyId)
      if (String(sql).includes('SELECT "keyHash"')) return { keyHash: hash }
      return null
    })

    expect(await validateApiKey(requestWithKey(key))).toMatchObject({ keyId })
    expect(lookupCalls()).toBe(1)

    await invalidateApiKeyCacheById(keyId)

    mockedQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('WHERE "keyHash"')) return { ...activeRow(keyId), status: 'inactive' }
      return null
    })
    expect(await validateApiKey(requestWithKey(key))).toBeNull()
    expect(lookupCalls()).toBe(2)
  })
})
