/**
 * GET /api/user/plan-flags: without a userId it answers for the signed-in user; another user's id still
 * needs an admin role.
 */
import { NextRequest } from 'next/server'

const getAuthorizationSession = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: (...args: unknown[]) => getAuthorizationSession(...args) }))
const getUserPlanAndFlags = jest.fn()
jest.mock('@nextsparkjs/core/lib/user-data', () => ({
  getUserPlanAndFlags: (...args: unknown[]) => getUserPlanAndFlags(...args),
  updateUserPlan: jest.fn(),
  updateUserFlags: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))

import { GET } from '../../../src/routes/api/user/plan-flags/route'

const get = (query = '') => GET(new NextRequest(`http://localhost:3000/api/user/plan-flags${query}`), undefined as never)

describe('GET /api/user/plan-flags', () => {
  beforeEach(() => {
    getAuthorizationSession.mockResolvedValue({ user: { id: 'user-1', role: 'member' } })
    getUserPlanAndFlags.mockReset().mockResolvedValue({ plan: 'free', flags: [], cached: false })
  })

  it('answers for the signed-in user when no userId is given', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-1', plan: 'free', flags: [], cached: false })
    expect(getUserPlanAndFlags).toHaveBeenCalledWith('user-1')
  })

  it('still refuses another user id to a member', async () => {
    const response = await get('?userId=user-2')
    expect(response.status).toBe(403)
    expect(getUserPlanAndFlags).not.toHaveBeenCalled()
  })
})
