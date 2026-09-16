/**
 * PATCH /api/user/profile (apps/dev) saves a preference group without erasing
 * the keys it does not carry (#194).
 *
 * The theme toggle sends `{ meta: { uiPreferences: { theme } } }` and the
 * sidebar sends `{ meta: { uiPreferences: { sidebarCollapsed } } }`: each
 * request carries one key of a group that holds both. Writing the group as it
 * arrives drops the other key, so saving the theme reset the sidebar and the
 * sidebar reset the theme.
 *
 * The route runs with the real MetaService; only the database, the rate limiter
 * and the session are mocked. The database mock applies to its stored value
 * what the query it receives asks for — a jsonb merge or a plain replace — so
 * the assertions are about what the user gets back, not about SQL text.
 *
 * apps/dev/app is the source of the app/ a project is generated with
 * (packages/core/templates/app, written at pack time), so this covers the
 * route the template ships.
 */
import { NextRequest } from 'next/server'

const mockMutateWithRLS = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryOne: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))
jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { PATCH } from '@/app/api/user/profile/route'

const USER_ID = 'test-user-123'

/** What `users_metas` holds, keyed by meta key. */
let stored: Record<string, Record<string, unknown>>

/**
 * The write as Postgres runs it. For a meta upsert the ON CONFLICT clause
 * either merges the two jsonb objects or replaces the stored one, and this
 * applies whichever the query carries; the profile UPDATE answers with the row.
 */
function applyWrite(query: string, params: unknown[]) {
  if (/UPDATE "users"/.test(query)) return { rows: [{ id: USER_ID }], rowCount: 1 }

  const [, metaKey, jsonString] = params as [string, string, string]
  const incoming = JSON.parse(jsonString) as Record<string, unknown>
  const current = stored[metaKey]
  const mergesStoredKeys = query.includes('"users_metas"."metaValue" || EXCLUDED."metaValue"')

  stored[metaKey] = current && mergesStoredKeys ? { ...current, ...incoming } : incoming
  return { rows: [], rowCount: 1 }
}

function patchProfile(body: unknown) {
  return PATCH(new NextRequest('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  stored = { uiPreferences: { theme: 'light', sidebarCollapsed: true } }
  mockMutateWithRLS.mockReset().mockImplementation((query: string, params: unknown[]) => applyWrite(query, params))
  mockGetSession.mockReset().mockResolvedValue({ user: { id: USER_ID } })
})

describe('PATCH /api/user/profile — preference groups', () => {
  test('saving the theme keeps the sidebar state', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('saving the sidebar state keeps the theme', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { sidebarCollapsed: false } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'light', sidebarCollapsed: false })
  })

  test('a profile update that also carries meta keeps the rest of the group', async () => {
    const response = await patchProfile({
      firstName: 'Ada',
      lastName: 'Lovelace',
      country: 'AR',
      timezone: 'America/Argentina/Buenos_Aires',
      language: 'en',
      meta: { uiPreferences: { theme: 'dark' } },
    })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
    // The profile UPDATE and the meta write, in that order
    expect(mockMutateWithRLS.mock.calls[0][0]).toMatch(/UPDATE "users"/)
    expect(mockMutateWithRLS.mock.calls).toHaveLength(2)
  })

  test('writes the group for the signed-in user under their own RLS context', async () => {
    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    const [, params, rlsUserId] = mockMutateWithRLS.mock.calls[0]
    expect(params[0]).toBe(USER_ID)
    expect(params[1]).toBe('uiPreferences')
    expect(rlsUserId).toBe(USER_ID)
  })

  test('leaves the groups the request does not carry alone', async () => {
    stored.notificationsPreferences = { pushEnabled: true }

    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(stored.notificationsPreferences).toEqual({ pushEnabled: true })
  })
})
