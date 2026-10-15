/**
 * S192 — POST /api/v1/teams/[teamId]/members (an invitation), with the real TeamInvitationService behind it:
 * the body is validated by inviteMemberSchema inside the service; only the database, membership lookup and
 * e-mail are mocked.
 */

import { routeHarness, makeReq, idParams, describeMalformedBodies, describeRejectedValues, expectCleanRejection, asJson, sessionAs, MEMBER, noWrites } from './__helpers__/route-harness'

const mockMembership = { role: 'owner', canPerformAction: jest.fn(() => ({ allowed: true })) }
jest.mock('@/core/lib/services/membership.service', () => ({ MembershipService: { get: async () => mockMembership } }))
jest.mock('@/core/lib/email/factory', () => ({ EmailFactory: { getInstance: () => ({ send: jest.fn() }) } }))
jest.mock('@/core/lib/email/send', () => ({ sendTeamInvitationEmail: jest.fn().mockResolvedValue({ subject: 's', html: 'h' }) }))
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: async () => mockMembership },
  TeamMemberService: {},
  TeamInvitationService: jest.requireActual('@/core/lib/services/team-invitation.service').TeamInvitationService,
}))

import { POST as invite } from '@/app/api/v1/teams/[teamId]/members/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const invoke = (body: Body, teamId = 'team-1') => invite(makeReq('POST', `/api/v1/teams/${teamId}/members`, body), idParams({ teamId }))

beforeEach(() => {
  routeHarness.reset()
  mockMembership.canPerformAction.mockReturnValue({ allowed: true })
  mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
})

describe('POST /api/v1/teams/[teamId]/members — bodies', () => {
  describeMalformedBodies(invoke, { code: 'VALIDATION_ERROR' })
})

describe('POST /api/v1/teams/[teamId]/members — values', () => {
  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['an email that is not an email', { email: 'not-an-email', role: 'member' }],
    ['an email given a number', { email: 5, role: 'member' }],
    ['an email given an object', { email: { a: 1 }, role: 'member' }],
    ['an email given null', { email: null, role: 'member' }],
    ['a role that does not exist', { email: 'ana@example.test', role: 'emperor' }],
    ['the owner role', { email: 'ana@example.test', role: 'owner' }],
    ['a role given a number', { email: 'ana@example.test', role: 3 }],
    ['a role given an array', { email: 'ana@example.test', role: ['member'] }],
    ['a missing role', { email: 'ana@example.test' }],
  ], { code: 'VALIDATION_ERROR' })

  test('a blank team id is answered 400 MISSING_TEAM_ID and writes nothing', async () => {
    await expectCleanRejection(await invoke(asJson({ email: 'ana@example.test', role: 'member' }), '   '), { status: 400, code: 'MISSING_TEAM_ID' })
    noWrites()
  })

  // No maximum length is declared for the address (finding F10, low): it is stored as sent, so only "not a 500" holds.
  test('an e-mail far over any sane length does not cause a server error', async () => {
    const response = await invoke(asJson({ email: `${'a'.repeat(100_000)}@example.test`, role: 'member' }))
    expect(response.status).toBeLessThan(500)
  })
})
