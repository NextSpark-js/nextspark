/**
 * Creating a team and accepting an invitation write their rows on the service connection, after the route's own
 * checks, in one transaction: on the RLS-enforced connection neither the creator nor the invitee is a member yet.
 * Accepting claims the pending invitation first, so a second accept of the same invitation joins no one.
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', user: { id: 'user-1', email: 'Inv@Example.test' } }),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  checkRateLimit: () => ({ allowed: true, resetTime: 0 }),
}))
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: { isSlugAvailable: jest.fn().mockResolvedValue(true) } }))
jest.mock('@nextsparkjs/core/lib/config/config-sync', () => {
  const actual = jest.requireActual('@nextsparkjs/core/lib/config/config-sync')
  const teams = { ...actual.APP_CONFIG_MERGED.teams, mode: 'multi-tenant', options: { allowCreateTeams: true } }
  return { ...actual, APP_CONFIG_MERGED: { ...actual.APP_CONFIG_MERGED, teams } }
})

const mockTx = {
  query: jest.fn(),
  queryOne: jest.fn(),
  mutate: jest.fn(),
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
}
const mockDb = {
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  queryRows: jest.fn(),
  getTransactionClient: jest.fn(),
  getServiceTransactionClient: jest.fn(async () => mockTx),
}
jest.mock('@nextsparkjs/core/lib/db', () => ({ ...jest.requireActual('@nextsparkjs/core/lib/db'), ...mockDb }))

import { POST as createTeam } from '../../../src/routes/api/v1/teams/route'
import { POST as accept } from '../../../src/routes/api/v1/team-invitations/[token]/accept/route'

const json = (url: string, body?: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

const pending = { id: 'inv-1', teamId: 'team-a', email: 'inv@example.test', role: 'member', status: 'pending', invitedBy: 'owner-a', expiresAt: new Date(Date.now() + 86400000).toISOString() }

describe('team join writes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('POST /api/v1/teams writes the team and its owner row in one service transaction', async () => {
    mockDb.queryWithRLS.mockResolvedValue([{ count: '0', memberCount: '1' }])
    mockTx.query.mockResolvedValueOnce([{ id: 'team-new' }]).mockResolvedValueOnce([])

    const response = await createTeam(json('http://localhost:3000/api/v1/teams', { name: 'New team', slug: 'new-team' }), undefined as never)

    expect(response.status).toBe(201)
    expect(mockDb.getServiceTransactionClient).toHaveBeenCalledTimes(1)
    expect(mockDb.getTransactionClient).not.toHaveBeenCalled()
    expect(mockTx.query.mock.calls[0][0]).toMatch(/INSERT INTO "teams"/)
    expect(mockTx.query.mock.calls[1][0]).toMatch(/INSERT INTO "team_members"[\s\S]*'owner'/)
    expect(mockTx.query.mock.calls[1][1]).toEqual(['team-new', 'user-1'])
    expect(mockTx.commit).toHaveBeenCalledTimes(1)
  })

  it('accepting claims the pending invitation and adds the invitee on the service connection', async () => {
    mockDb.queryOneWithRLS
      .mockResolvedValueOnce(pending) // the invitation by token
      .mockResolvedValueOnce(null) // not a member yet
      .mockResolvedValueOnce({ id: 'member-1', userId: 'user-1' }) // member with user details
    mockTx.mutate.mockResolvedValue({ rows: [], rowCount: 1 })
    mockTx.query.mockResolvedValue([{ id: 'member-1', role: 'member' }])

    const response = await accept(json('http://localhost:3000/api/v1/team-invitations/tok/accept'), { params: Promise.resolve({ token: 'tok' }) })

    expect(response.status).toBe(201)
    expect(mockDb.getTransactionClient).not.toHaveBeenCalled()
    expect(mockTx.mutate.mock.calls[0][0]).toMatch(/SET status = 'accepted'[\s\S]*AND status = 'pending'/)
    expect(mockTx.query.mock.calls[0][1]).toEqual(['team-a', 'user-1', 'member', 'owner-a'])
    expect(mockTx.commit).toHaveBeenCalledTimes(1)
  })

  it('an invitation accepted meanwhile adds no member', async () => {
    mockDb.queryOneWithRLS.mockResolvedValueOnce(pending).mockResolvedValueOnce(null)
    mockTx.mutate.mockResolvedValue({ rows: [], rowCount: 0 })

    const response = await accept(json('http://localhost:3000/api/v1/team-invitations/tok/accept'), { params: Promise.resolve({ token: 'tok' }) })

    expect(response.status).toBe(409)
    expect(mockTx.query).not.toHaveBeenCalled()
    expect(mockTx.rollback).toHaveBeenCalledTimes(1)
    expect(mockTx.commit).not.toHaveBeenCalled()
  })

  it('another email\'s invitation never reaches the service connection', async () => {
    mockDb.queryOneWithRLS.mockResolvedValueOnce({ ...pending, email: 'someone@example.test' })

    const response = await accept(json('http://localhost:3000/api/v1/team-invitations/tok/accept'), { params: Promise.resolve({ token: 'tok' }) })

    expect(response.status).toBe(403)
    expect(mockDb.getServiceTransactionClient).not.toHaveBeenCalled()
  })
})
