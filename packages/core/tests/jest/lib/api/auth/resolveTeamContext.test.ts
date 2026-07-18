/**
 * resolveTeamContext — 403 error-code tests.
 *
 * Previously returned a flat 403 for both "the team doesn't exist / was
 * soft-deleted" and "the team exists but this user was never a member" —
 * indistinguishable from the outside. This distinguishes them via a `code`
 * field, so a caller can eventually tell "your cached team went stale" from
 * "you don't have access to this."
 */
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: { getById: jest.fn() },
}))
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: { isMember: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { resolveTeamContext } from '@/core/lib/api/auth/dual-auth'
import { TeamService } from '@/core/lib/services/team.service'
import { TeamMemberService } from '@/core/lib/services/team-member.service'

const mockGetById = TeamService.getById as jest.MockedFunction<typeof TeamService.getById>
const mockIsMember = TeamMemberService.isMember as jest.MockedFunction<typeof TeamMemberService.isMember>

function makeRequest(teamId: string): NextRequest {
  return new (NextRequest as unknown as { new (url: string, init?: RequestInit): NextRequest })(
    'http://localhost/api/v1/some-entity',
    { headers: { 'x-team-id': teamId } },
  )
}

const authResult = { user: { id: 'user-1' } } as Parameters<typeof resolveTeamContext>[1]

describe('resolveTeamContext', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns TEAM_NOT_FOUND when the team row does not exist at all', async () => {
    mockGetById.mockResolvedValueOnce(null)

    const result = await resolveTeamContext(makeRequest('team-gone'), authResult)

    expect(mockGetById).toHaveBeenCalledWith('team-gone') // no userId arg — service pool, bypasses RLS
    expect(mockIsMember).not.toHaveBeenCalled()
    const body = await (result as Response).json()
    expect((result as Response).status).toBe(403)
    expect(body.code).toBe('TEAM_NOT_FOUND')
  })

  it('returns TEAM_NOT_FOUND when the team exists but is soft-deleted', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'team-deleted', deletedAt: '2026-07-01T00:00:00Z' } as never)

    const result = await resolveTeamContext(makeRequest('team-deleted'), authResult)

    const body = await (result as Response).json()
    expect((result as Response).status).toBe(403)
    expect(body.code).toBe('TEAM_NOT_FOUND')
  })

  it('returns NOT_A_MEMBER when the team is real and active but this user never joined it', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'team-real', deletedAt: null } as never)
    mockIsMember.mockResolvedValueOnce(false)

    const result = await resolveTeamContext(makeRequest('team-real'), authResult)

    expect(mockIsMember).toHaveBeenCalledWith('team-real', 'user-1')
    const body = await (result as Response).json()
    expect((result as Response).status).toBe(403)
    expect(body.code).toBe('NOT_A_MEMBER')
  })

  it('returns the teamId (not a Response) when the team is real, active, and the user is a member', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'team-real', deletedAt: null } as never)
    mockIsMember.mockResolvedValueOnce(true)

    const result = await resolveTeamContext(makeRequest('team-real'), authResult)

    expect(result).toBe('team-real')
  })
})
