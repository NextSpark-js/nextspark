/**
 * The team routes return an explicit set of columns, and `metadata` only to a member who can edit the team (#564).
 * GET /api/v1/teams, GET /api/v1/teams/:teamId and PATCH /api/v1/teams/:teamId.
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockQueryRows = jest.fn()
const mockQueryWithRLS = jest.fn()
const mockQueryOneWithRLS = jest.fn()
const mockMutate = jest.fn()
const mockMembershipGet = jest.fn()

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...a: unknown[]) => mockAuth(...a),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  checkRateLimit: () => ({ allowed: true, resetTime: 0 }),
}))
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryRows: (...a: unknown[]) => mockQueryRows(...a),
  queryWithRLS: (...a: unknown[]) => mockQueryWithRLS(...a),
  queryOneWithRLS: (...a: unknown[]) => mockQueryOneWithRLS(...a),
  mutateWithRLS: (...a: unknown[]) => mockMutate(...a),
  getServiceTransactionClient: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/services', () => ({
  TeamService: { isSlugAvailable: jest.fn().mockResolvedValue(true) },
  TeamDeleteVetoedError: class extends Error {},
  MembershipService: { get: (...a: unknown[]) => mockMembershipGet(...a) },
}))

import { GET as list } from '../../../src/routes/api/v1/teams/route'
import { GET as one, PATCH as patch } from '../../../src/routes/api/v1/teams/[teamId]/route'

const metadata = { billing: { taxId: 'secret' } }
const row = (userRole: string) => ({
  id: 'team-1', name: 'Team', slug: 'team', description: null, ownerId: 'u-owner', avatarUrl: null,
  isGlobal: false, settings: {}, metadata, createdAt: 'x', updatedAt: 'x', deletedAt: null,
  userRole, joinedAt: 'x', memberCount: '2',
})
const signIn = (_teamRole: string) => mockAuth.mockResolvedValue({ success: true, type: 'session', user: { id: 'u-1', role: 'user' } })
const sqlOf = (mock: jest.Mock) => mock.mock.calls.map(c => String(c[0])).join('\n')

describe('team routes: explicit columns and metadata (#564)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  describe('GET /api/v1/teams', () => {
    const call = () => list(new NextRequest('http://localhost:3000/api/v1/teams'), undefined as never)
    const run = async (teamRole: string) => {
      signIn(teamRole)
      mockQueryWithRLS.mockResolvedValueOnce([row(teamRole)]).mockResolvedValueOnce([{ count: '1' }])
      const body = await (await call()).json()
      return body.data[0] as Record<string, unknown>
    }

    it.each(['member', 'viewer'])('leaves metadata out for a %s', async role => {
      const team = await run(role)
      expect(team).not.toHaveProperty('metadata')
      expect(team.name).toBe('Team')
      expect(team.userRole).toBe(role)
    })

    it.each(['owner', 'admin'])('keeps metadata for an %s', async role => {
      expect((await run(role)).metadata).toEqual(metadata)
    })

    it('selects listed columns, not t.*', async () => {
      await run('owner')
      expect(sqlOf(mockQueryWithRLS)).not.toMatch(/t\.\*/)
      expect(sqlOf(mockQueryWithRLS)).toContain('t."ownerId"')
    })
  })

  describe('GET /api/v1/teams/:teamId', () => {
    const call = () => one(new NextRequest('http://localhost:3000/api/v1/teams/team-1'), { params: Promise.resolve({ teamId: 'team-1' }) })
    const run = async (teamRole: string) => {
      signIn(teamRole)
      mockQueryOneWithRLS.mockResolvedValueOnce({ role: teamRole }).mockResolvedValueOnce(row(teamRole))
      return (await (await call()).json()).data as Record<string, unknown>
    }

    it.each(['member', 'viewer'])('leaves metadata out for a %s', async role => {
      const team = await run(role)
      expect(team).not.toHaveProperty('metadata')
      expect(team.memberCount).toBe(2)
    })

    it.each(['owner', 'admin'])('keeps metadata for an %s', async role => {
      expect((await run(role)).metadata).toEqual(metadata)
    })

    it('selects listed columns, not t.*', async () => {
      await run('owner')
      expect(sqlOf(mockQueryOneWithRLS)).not.toMatch(/t\.\*/)
    })
  })

  describe('PATCH /api/v1/teams/:teamId', () => {
    const call = () =>
      patch(
        new NextRequest('http://localhost:3000/api/v1/teams/team-1', {
          method: 'PATCH', body: JSON.stringify({ description: 'd' }), headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({ teamId: 'team-1' }) }
      )

    it('returns metadata to the editor and writes with listed columns, not RETURNING *', async () => {
      signIn('owner')
      mockMembershipGet.mockResolvedValue({ canPerformAction: () => ({ allowed: true }) })
      mockMutate.mockResolvedValue({ rows: [{ id: 'team-1' }] })
      mockQueryOneWithRLS.mockResolvedValueOnce(row('owner'))

      const body = await (await call()).json()

      expect(body.data.metadata).toEqual(metadata)
      expect(sqlOf(mockMutate)).not.toMatch(/RETURNING \*/)
      expect(sqlOf(mockQueryOneWithRLS)).not.toMatch(/t\.\*/)
    })

    it('answers 403 and reads nothing for a member without team.edit', async () => {
      signIn('member')
      mockMembershipGet.mockResolvedValue({ canPerformAction: () => ({ allowed: false, message: 'no', reason: 'permission_denied' }) })

      expect((await call()).status).toBe(403)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })
  })
})
