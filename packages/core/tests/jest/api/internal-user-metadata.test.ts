/**
 * POST /api/internal/user-metadata (apps/dev) creates the default metadata
 * groups a user is missing. Defaults only fill in what is missing: each group
 * is written with the merge in which stored keys win, so a preference saved
 * after the caller read the user's meta is kept. The route runs with the real
 * MetaService; only the database, the rate limiter and authentication are
 * mocked.
 */
import { NextRequest } from 'next/server'

const mockMutateWithRLS = jest.fn()
const mockAuthenticateRequest = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args),
  createAuthFailureResponse: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('next/server').NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}))

import { POST } from '@/app/api/internal/user-metadata/route'

/** The merge in which the stored keys win over the incoming defaults. */
const STORED_KEYS_WIN = 'THEN EXCLUDED."metaValue" || "users_metas"."metaValue"'

const DEFAULTS = {
  uiPreferences: { theme: 'light', sidebarCollapsed: false },
  securityPreferences: { twoFactorEnabled: false, loginAlertsEnabled: true },
  notificationsPreferences: { pushEnabled: true, loginAlertsEmail: true, promotionsEmail: false },
}

function postMetadata(body: unknown, rawBody?: string) {
  return POST(new NextRequest('http://localhost:3000/api/internal/user-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? JSON.stringify(body),
  }))
}

function signedInAs(userId: string) {
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: { id: userId } })
}

/** The meta key and value of each write, in order. */
function writes() {
  return mockMutateWithRLS.mock.calls.map(([, params]) => [params[1], JSON.parse(params[2])])
}

beforeEach(() => {
  mockMutateWithRLS.mockReset().mockResolvedValue({ rows: [], rowCount: 1 })
  mockAuthenticateRequest.mockReset()
  signedInAs('test-user-123')
})

describe('POST /api/internal/user-metadata', () => {
  test('fills in each group without overwriting what the user already saved', async () => {
    const response = await postMetadata({ userId: 'test-user-123', metadata: DEFAULTS })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, message: 'Default metadata created successfully' })
    expect(writes()).toEqual(Object.entries(DEFAULTS))
    for (const [query, params, rlsUserId] of mockMutateWithRLS.mock.calls) {
      expect(query).toContain(STORED_KEYS_WIN)
      expect(query).not.toMatch(/"metaValue" = EXCLUDED\."metaValue",/)
      expect(params[0]).toBe('test-user-123')
      expect(rlsUserId).toBe('test-user-123')
    }
  })

  test('answers 400 without a userId', async () => {
    const response = await postMetadata({ metadata: DEFAULTS })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('User ID is required')
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('answers 400 without metadata', async () => {
    const response = await postMetadata({ userId: 'test-user-123' })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Metadata is required')
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('answers 403 for another user\'s metadata', async () => {
    signedInAs('someone-else')

    const response = await postMetadata({ userId: 'test-user-123', metadata: DEFAULTS })

    expect(response.status).toBe(403)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('answers the authentication failure when the request is not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false })

    const response = await postMetadata({ userId: 'test-user-123', metadata: DEFAULTS })

    expect(response.status).toBe(401)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('writes nothing for an empty metadata object', async () => {
    const response = await postMetadata({ userId: 'test-user-123', metadata: {} })

    expect(response.status).toBe(200)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('writes only the groups it receives', async () => {
    const response = await postMetadata({ userId: 'test-user-123', metadata: { uiPreferences: { theme: 'dark' } } })

    expect(response.status).toBe(200)
    expect(writes()).toEqual([['uiPreferences', { theme: 'dark' }]])
  })

  test('skips entries that are not groups', async () => {
    const response = await postMetadata({
      userId: 'test-user-123',
      metadata: { uiPreferences: { theme: 'dark' }, theme: 'dark', empty: null },
    })

    expect(response.status).toBe(200)
    expect(writes()).toEqual([['uiPreferences', { theme: 'dark' }]])
  })

  test('answers 500 when the database fails', async () => {
    mockMutateWithRLS.mockRejectedValueOnce(new Error('Database error'))

    const response = await postMetadata({ userId: 'test-user-123', metadata: DEFAULTS })

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('Internal server error')
  })

  test('answers 500 for a malformed body', async () => {
    const response = await postMetadata(undefined, 'invalid-json-{')

    expect(response.status).toBe(500)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  test('keeps concurrent requests for different users apart', async () => {
    mockAuthenticateRequest.mockImplementation(async (request: NextRequest) => ({
      success: true,
      user: { id: (await request.json()).userId },
    }))

    const [first, second] = await Promise.all([
      postMetadata({ userId: 'user-1', metadata: { uiPreferences: { theme: 'light' } } }),
      postMetadata({ userId: 'user-2', metadata: { uiPreferences: { theme: 'dark' } } }),
    ])

    expect([first.status, second.status]).toEqual([200, 200])
    const byUser = mockMutateWithRLS.mock.calls.map(([, params, rlsUserId]) => [params[0], rlsUserId, JSON.parse(params[2])])
    expect(byUser).toEqual(expect.arrayContaining([
      ['user-1', 'user-1', { theme: 'light' }],
      ['user-2', 'user-2', { theme: 'dark' }],
    ]))
  })
})
