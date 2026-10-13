/**
 * inviteMember follows the invitation flow of POST /api/v1/teams/:teamId/members: it creates a pending
 * invitation through the same service and adds nobody to the team. Both run with the real
 * TeamInvitationService; only the database, membership lookup, email, rate limiter and authentication are mocked.
 */
import { NextRequest } from 'next/server'

const mockQueryOne = jest.fn()
const mockMutate = jest.fn()
const mockMembershipGet = jest.fn()
const mockSend = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockAuthenticateRequest = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@/core/lib/db', () => ({
  ...jest.requireActual('@/core/lib/db'),
  queryWithRLS: jest.fn(),
  queryOneWithRLS: (...args: unknown[]) => mockQueryOne(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutate(...args),
}))
jest.mock('@/core/lib/services/membership.service', () => ({
  MembershipService: { get: (...args: unknown[]) => mockMembershipGet(...args) },
}))
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: { add: jest.fn(), getRole: jest.fn(), hasPermission: jest.fn() },
}))
jest.mock('@/core/lib/email/factory', () => ({
  EmailFactory: { getInstance: () => ({ send: (...args: unknown[]) => mockSend(...args) }) },
}))
jest.mock('@/core/lib/email/send', () => ({
  sendTeamInvitationEmail: jest.fn().mockResolvedValue({ subject: 's', html: 'h' }),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args),
  createAuthFailureResponse: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('next/server').NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}))
jest.mock('@/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: (...args: unknown[]) => mockGetSession(...args),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: {} } }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: jest.fn() }),
}))

import { inviteMember } from '@/core/lib/actions/team.actions'
import { POST } from '@/app/api/v1/teams/[teamId]/members/route'
import { TeamMemberService } from '@/core/lib/services/team-member.service'

const ACTOR = { id: 'user-owner', email: 'owner@example.com' }
const TEAM = { id: 'team-1', name: 'Team One' }
const INVITATION = {
  id: 'inv-1',
  teamId: 'team-1',
  email: 'new@example.com',
  role: 'member',
  status: 'pending',
  token: 'secret-accept-token',
  invitedBy: ACTOR.id,
  expiresAt: '2026-10-20T00:00:00.000Z',
}

type World = { role?: string | null; allowed?: boolean; userExists?: boolean; isMember?: boolean; pending?: boolean; team?: boolean }

/** Sets what the database and the membership lookup answer */
function world({ role = 'owner', allowed = true, userExists = false, isMember = false, pending = false, team = true }: World = {}) {
  mockMembershipGet.mockResolvedValue({
    role,
    canPerformAction: () => (allowed
      ? { allowed: true }
      : { allowed: false, message: 'You do not have permission', reason: 'ROLE_NOT_ALLOWED', meta: { teamId: 'team-1' } }),
  })
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM "users"')) return userExists ? { id: 'user-existing' } : null
    if (sql.includes('FROM "team_members"')) return isMember ? { id: 'tm-1' } : null
    if (sql.includes('FROM "team_invitations"')) return pending ? INVITATION : null
    if (sql.includes('FROM "teams"')) return team ? TEAM : null
    return null
  })
  mockMutate.mockResolvedValue({ rows: [INVITATION], rowCount: 1 })
}

function rest(email: unknown, role: unknown, teamId = 'team-1') {
  return POST(
    new NextRequest(`http://localhost:3000/api/v1/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    }),
    { params: Promise.resolve({ teamId }) }
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCheckRateLimit.mockReturnValue({ allowed: true, resetTime: Date.now() + 60_000 })
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: ACTOR })
  mockGetSession.mockResolvedValue({ user: ACTOR, session: { id: 's1' } })
  mockSend.mockResolvedValue(undefined)
  world()
})

describe('inviteMember creates a pending invitation', () => {
  it('inserts an invitation, sends the email and adds no member', async () => {
    const result = await inviteMember('team-1', 'new@example.com', 'member')

    expect(result.success).toBe(true)
    const inserts = mockMutate.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "team_invitations"'))
    expect(inserts).toHaveLength(1)
    expect(inserts[0][1].slice(0, 3)).toEqual(['team-1', 'new@example.com', 'member'])
    expect(mockMutate.mock.calls.some(([sql]) => String(sql).includes('team_members'))).toBe(false)
    expect(TeamMemberService.add).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'new@example.com' }))
  })

  it('returns the pending invitation without its accept token', async () => {
    const result = await inviteMember('team-1', 'new@example.com', 'member')

    expect(result).toEqual({
      success: true,
      data: {
        invitationId: 'inv-1',
        teamId: 'team-1',
        email: 'new@example.com',
        role: 'member',
        status: 'pending',
        expiresAt: '2026-10-20T00:00:00.000Z',
      },
    })
    expect(JSON.stringify(result)).not.toContain('secret-accept-token')
  })

  it('invites someone who has no account yet (the invitee signs up through the link)', async () => {
    world({ userExists: false })
    expect((await inviteMember('team-1', 'nobody@example.com', 'viewer')).success).toBe(true)
  })

  it('needs a session', async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await inviteMember('team-1', 'new@example.com', 'member')).toEqual({ success: false, error: 'Authentication required' })
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('inviteMember refuses what POST /api/v1/teams/:teamId/members refuses', () => {
  const cases: Array<[string, World, string, string, number]> = [
    ['an admin inviting an admin', { role: 'admin' }, 'admin', 'new@example.com', 403],
    ['a role without the invite permission', { allowed: false, role: 'member' }, 'member', 'new@example.com', 403],
    ['someone who is already a member', { userExists: true, isMember: true }, 'member', 'new@example.com', 409],
    ['an email with a pending invitation', { pending: true }, 'member', 'new@example.com', 409],
    ['a team that does not exist', { team: false }, 'member', 'new@example.com', 404],
    ['the owner role', {}, 'owner', 'new@example.com', 400],
    ['an unknown role', {}, 'superhero', 'new@example.com', 400],
    ['an invalid email', {}, 'member', 'not-an-email', 400],
  ]

  it.each(cases)('%s', async (_name, state, role, email, status) => {
    world(state)
    const res = await rest(email, role)
    const body = await res.json()
    expect(res.status).toBe(status)

    jest.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, resetTime: Date.now() + 60_000 })
    mockGetSession.mockResolvedValue({ user: ACTOR, session: { id: 's1' } })
    world(state)
    const result = await inviteMember('team-1', email, role as never)

    expect(result.success).toBe(false)
    if (!result.success) {
      if (status === 400) {
        // REST lists the issues; the action names the first one as "<field>: <message>"
        const issue = body.details[0]
        expect(result.error).toBe(`${issue.path.join('.')}: ${issue.message}`)
      } else {
        expect(result.error).toBe(body.error)
      }
    }
    expect(mockMutate).not.toHaveBeenCalled()
    expect(TeamMemberService.add).not.toHaveBeenCalled()
  })

  it('shares the rate limit of the REST route (20 per minute and inviter)', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, resetTime: Date.now() + 30_000 })

    const res = await rest('new@example.com', 'member')
    const result = await inviteMember('team-1', 'new@example.com', 'member')

    expect(res.status).toBe(429)
    expect(result).toEqual({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    expect(mockCheckRateLimit).toHaveBeenCalledWith(`invite:create:${ACTOR.id}`, 20, 60000)
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('the REST route keeps its answers through the shared service', () => {
  it('201 with the invitation', async () => {
    const res = await rest('new@example.com', 'member')
    expect(res.status).toBe(201)
    expect((await res.json()).data.id).toBe('inv-1')
  })

  it('403 body keeps error, reason and meta for a role without the permission', async () => {
    world({ allowed: false })
    const res = await rest('new@example.com', 'member')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ success: false, error: 'You do not have permission', reason: 'ROLE_NOT_ALLOWED', meta: { teamId: 'team-1' } })
  })

  it('403 ROLE_HIERARCHY_VIOLATION when an admin invites an admin', async () => {
    world({ role: 'admin' })
    const res = await rest('new@example.com', 'admin')
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('ROLE_HIERARCHY_VIOLATION')
  })
})
