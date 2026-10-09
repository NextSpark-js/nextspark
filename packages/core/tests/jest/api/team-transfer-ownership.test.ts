/**
 * POST /api/v1/teams/:teamId/transfer-ownership and the transferTeamOwnership Server Action: the session user is the
 * one who must own the team (TeamMemberService.transferOwnership checks it in its transaction), the target is a user
 * id, and the service's refusals map to 400 / 403 / 404. There is no API-key path.
 */
import { NextRequest } from 'next/server'

const mockSession = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => mockSession() }))
jest.mock('@/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => mockSession() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const mockTransfer = jest.fn()
jest.mock('@nextsparkjs/core/lib/services/team-member.service', () => ({ TeamMemberService: { transferOwnership: (...a: unknown[]) => mockTransfer(...a) } }))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { transferOwnership: (...a: unknown[]) => mockTransfer(...a) } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: {} }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))

import { POST } from '../../../src/routes/api/v1/teams/[teamId]/transfer-ownership/route'
import { transferTeamOwnership } from '@/core/lib/actions/team.actions'

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost:3000/api/v1/teams/team-a/transfer-ownership', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ teamId: 'team-a' }) })
const refusal = (code: string) => Object.assign(new Error(code), { code })

describe('transfer ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: 'owna' } })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('the owner hands the team to a member', async () => {
    mockTransfer.mockResolvedValue({ previousOwner: { role: 'admin' }, newOwner: { role: 'owner' } })
    const response = await post({ newOwnerId: 'mema' })
    expect(response.status).toBe(200)
    expect(mockTransfer).toHaveBeenCalledWith('team-a', 'mema', 'owna')
  })

  it.each([
    ['SAME_OWNER', 400],
    ['NOT_OWNER', 403],
    ['NOT_A_MEMBER', 404],
  ])('the service refusing with %s answers %i', async (code, status) => {
    mockTransfer.mockRejectedValue(refusal(code))
    const response = await post({ newOwnerId: 'x' })
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ code })
  })

  it('without a session (an API key, or nobody) answers 401 and transfers nothing', async () => {
    mockSession.mockResolvedValue(null)
    expect((await post({ newOwnerId: 'mema' })).status).toBe(401)
    expect(mockTransfer).not.toHaveBeenCalled()
  })

  it('a body without newOwnerId answers 400', async () => {
    expect((await post({ ownerId: 'mema' })).status).toBe(400)
    expect(mockTransfer).not.toHaveBeenCalled()
  })

  it('the Server Action passes the session user as the current owner', async () => {
    mockTransfer.mockResolvedValue({})
    expect(await transferTeamOwnership('team-a', 'mema')).toEqual({ success: true })
    expect(mockTransfer).toHaveBeenCalledWith('team-a', 'mema', 'owna')

    mockTransfer.mockRejectedValue(refusal('NOT_OWNER'))
    expect(await transferTeamOwnership('team-a', 'mema')).toMatchObject({ success: false })
  })
})
