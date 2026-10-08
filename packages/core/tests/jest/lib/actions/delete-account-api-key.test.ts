/**
 * The deleteAccount Server Action ends the user's API keys at once: a key validated (and cached for 5 minutes) right
 * before the deletion is refused on the next request, without waiting for the cache entry to expire.
 */
import type { NextRequest } from 'next/server'
import { ApiKeyManager } from '@/core/lib/api/keys'

let keyActive = true
let keyHash = ''
const mockTx = {
  query: jest.fn(async (sql: string) => {
    if (sql.includes('UPDATE "api_key"')) {
      keyActive = false
      return [{ keyHash }]
    }
    return []
  }),
  mutate: jest.fn(async () => ({ rows: [], rowCount: 1 })),
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
}
const mockQueryOne = jest.fn(async (sql: string) => {
  if (sql.includes('WHERE "keyHash"')) {
    return { id: 'key-1', userId: 'user-1', scopes: ['tasks:read'], status: keyActive ? 'active' : 'inactive', expiresAt: null, failedAttempts: 0, lockedUntil: null }
  }
  if (sql.includes('FROM "users"')) return { role: 'member' }
  return null
})
jest.mock('@/core/lib/db', () => ({
  queryOne: (sql: string) => mockQueryOne(sql),
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  getServiceTransactionClient: jest.fn(async () => mockTx),
}))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getByOwnerId: jest.fn().mockResolvedValue([]) } }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('@/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ user: { id: 'user-1' } }),
}))

import { deleteAccount } from '@/core/lib/actions/user.actions'
import { validateApiKey } from '@/core/lib/api/auth'

const withKey = (key: string) =>
  ({ headers: { get: (h: string) => (h.toLowerCase() === 'authorization' ? `Bearer ${key}` : null) } }) as unknown as NextRequest

const keyLookups = () => mockQueryOne.mock.calls.filter(([sql]) => sql.includes('WHERE "keyHash"')).length

it('a key cached before deleteAccount is refused right after it', async () => {
  const generated = await ApiKeyManager.generateApiKey()
  keyHash = generated.hash

  expect(await validateApiKey(withKey(generated.key))).toMatchObject({ keyId: 'key-1' })
  expect(await validateApiKey(withKey(generated.key))).toMatchObject({ keyId: 'key-1' })
  expect(keyLookups()).toBe(1) // the second request was served from the cache

  expect(await deleteAccount()).toEqual({ success: true })

  expect(await validateApiKey(withKey(generated.key))).toBeNull()
  expect(keyLookups()).toBe(2) // the cache entry was dropped, the row was read again
  expect(mockTx.query.mock.calls.map(([sql]) => sql).join('\n')).toMatch(/DELETE FROM "team_members" WHERE "userId" = \$1/)
})
