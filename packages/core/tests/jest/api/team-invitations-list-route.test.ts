/**
 * GET /api/v1/team-invitations: with no query string it lists the caller's pending invitations with the
 * default page and limit, and a query the schema refuses is a 400 the caller can read, not a 500.
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', user: { id: 'user-1', email: 'me@example.com' } }),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryWithRLS: (...args: unknown[]) => queryWithRLS(...args),
}))

import { GET } from '../../../src/routes/api/v1/team-invitations/route'

const get = (query = '') => GET(new NextRequest(`http://localhost:3000/api/v1/team-invitations${query}`), undefined as never)

describe('GET /api/v1/team-invitations', () => {
  beforeEach(() => {
    queryWithRLS.mockReset()
    queryWithRLS.mockResolvedValueOnce([{ id: 'inv-1', teamName: 'Team A' }]).mockResolvedValueOnce([{ count: '1' }])
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('lists pending invitations with the default page and limit when there is no query string', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual([{ id: 'inv-1', teamName: 'Team A' }])
    expect(body.info).toMatchObject({ page: 1, limit: 20, total: 1 })
    expect(queryWithRLS.mock.calls[0][1]).toEqual(['me@example.com', 'pending', 20, 0])
  })

  it('answers 400 VALIDATION_ERROR for a query the schema refuses', async () => {
    for (const query of ['?page=0', '?limit=abc', '?status=bogus']) {
      const response = await get(query)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(queryWithRLS).not.toHaveBeenCalled()
  })
})
