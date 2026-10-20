/**
 * DELETE /api/v1/teams/:teamId answers for the team deletion lifecycle (#314): deleted, vetoed by a hook, unknown.
 */
import { NextRequest } from 'next/server'

const mockDelete = jest.fn()

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', user: { id: 'owner-1', email: 'o@example.test' } }),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  checkRateLimit: () => ({ allowed: true, resetTime: 0 }),
}))
jest.mock('@nextsparkjs/core/lib/services', () => {
  class TeamDeleteVetoedError extends Error {
    readonly code = 'TEAM_DELETE_VETOED'
  }
  return {
    TeamService: { delete: (...args: unknown[]) => mockDelete(...args) },
    TeamDeleteVetoedError,
    MembershipService: {},
  }
})

import { TeamDeleteVetoedError } from '@nextsparkjs/core/lib/services'
import { DELETE } from '../../../src/routes/api/v1/teams/[teamId]/route'

const call = () =>
  DELETE(new NextRequest('http://localhost:3000/api/v1/teams/team-1', { method: 'DELETE' }), { params: Promise.resolve({ teamId: 'team-1' }) })

describe('DELETE /api/v1/teams/:teamId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('answers deleted', async () => {
    mockDelete.mockResolvedValue(undefined)

    const response = await call()

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ deleted: true, id: 'team-1' })
    expect(mockDelete).toHaveBeenCalledWith('team-1', 'owner-1')
  })

  it('answers 409 with the hook message when a before-delete hook vetoes', async () => {
    mockDelete.mockRejectedValue(new TeamDeleteVetoedError('Cancel the active contract first'))

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Cancel the active contract first')
    expect(body.code).toBe('TEAM_DELETE_VETOED')
  })

  it.each([
    ['The global team cannot be deleted', 'GLOBAL_TEAM_DELETE_FORBIDDEN'],
    ['The system admin team cannot be deleted', 'SYSTEM_TEAM_DELETE_FORBIDDEN'],
  ])('answers 403 %s', async (message, code) => {
    mockDelete.mockRejectedValue(new Error(message))

    const response = await call()

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe(code)
  })

  it('answers 404 for a team that is unknown or already deleted', async () => {
    mockDelete.mockRejectedValue(new Error('Team not found'))

    expect((await call()).status).toBe(404)
  })
})
