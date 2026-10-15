/**
 * S192 — input validation of the team routes:
 *   /api/v1/teams (GET, POST), /api/v1/teams/[teamId] (PATCH), /api/v1/teams/switch (POST),
 *   /api/v1/teams/[teamId]/members (GET), /api/v1/teams/[teamId]/members/[memberId] (PATCH),
 *   /api/v1/teams/[teamId]/transfer-ownership (POST).
 */

import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, allWrites } from './__helpers__/route-harness'

const mockMembership = { role: 'owner', canPerformAction: jest.fn(() => ({ allowed: true })) }
const mockIsSlugAvailable = jest.fn()
const mockSwitchActive = jest.fn()
const mockTransferOwnership = jest.fn()
jest.mock('@/core/lib/services', () => ({
  TeamService: { isSlugAvailable: (...a: unknown[]) => mockIsSlugAvailable(...a), switchActive: (...a: unknown[]) => mockSwitchActive(...a) },
  MembershipService: { get: async () => mockMembership },
  TeamMemberService: { transferOwnership: (...a: unknown[]) => mockTransferOwnership(...a) },
  TeamInvitationService: { create: jest.fn() },
}))
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: { teams: { mode: 'multi-tenant', options: { allowCreateTeams: true } } } }))
const mockTransferSession = jest.fn()
jest.mock('@/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => mockTransferSession() }))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { transferOwnership: (...a: unknown[]) => mockTransferOwnership(...a) } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: {} }))

import { GET as listTeams, POST as createTeam } from '@/app/api/v1/teams/route'
import { PATCH as patchTeam } from '@/app/api/v1/teams/[teamId]/route'
import { POST as switchTeam } from '@/app/api/v1/teams/switch/route'
import { GET as listMembers } from '@/app/api/v1/teams/[teamId]/members/route'
import { PATCH as patchMember } from '@/app/api/v1/teams/[teamId]/members/[memberId]/route'
import { POST as transferOwnership } from '@/app/api/v1/teams/[teamId]/transfer-ownership/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const TEAM = { id: 'team-1', name: 'Team', slug: 'team' }

beforeEach(() => {
  routeHarness.reset()
  mockMembership.canPerformAction.mockReturnValue({ allowed: true })
  mockIsSlugAvailable.mockResolvedValue(true)
  mockSwitchActive.mockResolvedValue(undefined)
  mockTransferSession.mockResolvedValue({ user: { id: 'owner-1' } })
  mocks.authenticateRequest.mockResolvedValue({ ...sessionAs(MEMBER), sessionId: 'session-1' })
  mocks.txQuery.mockResolvedValue([TEAM])
  mocks.queryWithRLS.mockResolvedValue([{ ...TEAM, memberCount: '1', count: '1' }])
})

describe('POST /api/v1/teams', () => {
  const invoke = (body: Body) => createTeam(makeReq('POST', '/api/v1/teams', body), undefined as never)

  describe('bodies', () => {
    // an unreadable body or a JSON null is thrown outside the schema parse and answered 500 (finding F8)
    describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['a name of one character', { name: 'A', slug: 'team-a' }],
      ['a name over 100 characters', { name: 'x'.repeat(101), slug: 'team-a' }],
      ['a name far over 100 characters', { name: 'x'.repeat(500_000), slug: 'team-a' }],
      ['a name given a number', { name: 12345, slug: 'team-a' }],
      ['a name given an object', { name: { en: 'Team' }, slug: 'team-a' }],
      ['a name given null', { name: null, slug: 'team-a' }],
      ['a slug with capitals', { name: 'Team A', slug: 'Team-A' }],
      ['a slug with spaces', { name: 'Team A', slug: 'team a' }],
      ['a slug that is empty', { name: 'Team A', slug: '' }],
      ['a slug with non-ASCII letters', { name: 'Team A', slug: 'équipe' }],
      ['a slug with a double hyphen', { name: 'Team A', slug: 'team--a' }],
      ['a slug given a number', { name: 'Team A', slug: 7 }],
      ['a description given a number', { name: 'Team A', slug: 'team-a', description: 5 }],
      ['a description given null', { name: 'Team A', slug: 'team-a', description: null }],
    ], { code: 'VALIDATION_ERROR' })

    test('extra fields are ignored and never written', async () => {
      await invoke(asJson({ name: 'Team A', slug: 'team-a', ownerId: 'someone-else', id: 'forced-id', plan: 'enterprise' }))
      for (const [, params] of mocks.txQuery.mock.calls as Array<[string, unknown[]]>) {
        expect(params).not.toContain('someone-else')
        expect(params).not.toContain('forced-id')
        expect(params).not.toContain('enterprise')
      }
    })

    test.each([['accented Latin', 'Équipe Núñez'], ['CJK', '日本語チーム'], ['right-to-left', 'فريق الأحلام'], ['emoji', 'Team 🐕‍🦺 🚀']])('stores a %s name unchanged', async (_label, name) => {
      mocks.txQuery.mockImplementation(async (_sql: string, params: unknown[]) => [{ id: 'team-9', name: params[0], slug: params[1] }])
      mocks.queryWithRLS.mockImplementation(async () => [{ id: 'team-9', name, slug: 'team-a', memberCount: '1' }])
      const response = await invoke(asJson({ name, slug: 'team-a' })) as unknown as { status: number; json(): Promise<{ data: { name: string } }> }
      expect(response.status).toBe(201)
      const [, params] = (mocks.txQuery.mock.calls as Array<[string, unknown[]]>)[0]
      expect(params[0]).toBe(name)
      expect((await response.json()).data.name).toBe(name)
    })
  })
})

describe('GET /api/v1/teams — query parameters', () => {
  const list = (query: string) => listTeams(makeReq('GET', `/api/v1/teams${query}`), undefined as never)

  // The list query is parsed by the schema inside a handler whose catch answers every error 500 (finding F9).
  test.failing.each([
    ['a page of zero', '?page=0'],
    ['a negative page', '?page=-1'],
    ['a page of text', '?page=abc'],
    ['a limit of zero', '?limit=0'],
    ['a limit over the maximum', '?limit=101'],
    ['a limit of text', '?limit=many'],
    ['a fractional limit', '?limit=1.5'],
    ['a sort field that does not exist', '?sort=password'],
    ['an order that is not asc or desc', '?order=sideways'],
    ['a scope that does not exist', '?scope=everything'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, query) => {
    await expectCleanRejection(await list(query), { status: 400, code: 'VALIDATION_ERROR' })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters (the first is read)', '?page=1&page=9&limit=5&limit=50'],
    ['empty values', '?page=&limit=&search='],
    ['a long search string', `?search=${encodeURIComponent('ñ'.repeat(20_000))}`],
  ])('answers %s with a normal 200', async (_label, query) => {
    expect((await list(query)).status).toBe(200)
  })

  test('scope=all for a caller who is not a superadmin is answered 403', async () => {
    await expectCleanRejection(await list('?scope=all'), { status: 403 })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/teams/[teamId]', () => {
  const invoke = (body: Body, teamId = 'team-1') => patchTeam(makeReq('PATCH', `/api/v1/teams/${teamId}`, body), idParams({ teamId }))

  describe('bodies', () => {
    describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a name of one character', { name: 'A' }],
      ['a name over 100 characters', { name: 'x'.repeat(101) }],
      ['a name given a number', { name: 5 }],
      ['a name given an array', { name: ['Team'] }],
      ['a slug with capitals', { slug: 'Team-A' }],
      ['a slug with spaces', { slug: 'team a' }],
      ['an avatar that is not a URL', { avatarUrl: 'not a url' }],
      ['an avatar given a number', { avatarUrl: 3 }],
      ['settings given an array', { settings: ['a'] }],
      ['settings given text', { settings: 'dark' }],
      ['a description given a number', { description: 5 }],
    ], { code: 'VALIDATION_ERROR' })

    test('an object with nothing to update says so with 400 NO_FIELDS and writes nothing', async () => {
      await expectCleanRejection(await invoke(asJson({})), { status: 400, code: 'NO_FIELDS' })
      noWrites()
    })

    test('a blank team id is answered 400 MISSING_TEAM_ID', async () => {
      await expectCleanRejection(await invoke(asJson({ name: 'Team' }), '   '), { status: 400, code: 'MISSING_TEAM_ID' })
      noWrites()
    })

    test('stores unusual Unicode in the name unchanged', async () => {
      const name = 'Équipe 日本語 🐕‍🦺 ريكس'
      mocks.queryOneWithRLS.mockResolvedValue({ ...TEAM, name })
      mocks.mutateWithRLS.mockResolvedValue({ rows: [{ ...TEAM, name }], rowCount: 1 })
      await invoke(asJson({ name }))
      const [update] = allWrites()
      expect(update[1]).toContain(name)
    })
  })
})

describe('POST /api/v1/teams/switch', () => {
  const invoke = (body: Body) => switchTeam(makeReq('POST', '/api/v1/teams/switch', body), undefined as never)

  describeMalformedBodies(invoke)

  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['a team id given a number', { teamId: 5 }],
    ['a team id given null', { teamId: null }],
    ['a team id that is empty', { teamId: '' }],
    ['a team id given an array', { teamId: ['team-1'] }],
  ], { code: 'VALIDATION_ERROR' })

  test('an API key is refused with 400 SESSION_REQUIRED', async () => {
    mocks.authenticateRequest.mockResolvedValue({ success: true, type: 'api-key', user: MEMBER, scopes: ['*'] })
    await expectCleanRejection(await invoke(asJson({ teamId: 'team-1' })), { status: 400, code: 'SESSION_REQUIRED' })
    expect(mockSwitchActive).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/teams/[teamId]/members — query parameters', () => {
  const list = (query: string) => listMembers(makeReq('GET', `/api/v1/teams/team-1/members${query}`), idParams({ teamId: 'team-1' }))

  test.failing.each([
    ['a page of zero', '?page=0'],
    ['a page of text', '?page=abc'],
    ['a limit over the maximum', '?limit=500'],
    ['a role that does not exist', '?role=emperor'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, query) => {
    mocks.queryOneWithRLS.mockResolvedValue({ role: 'owner' })
    await expectCleanRejection(await list(query), { status: 400, code: 'VALIDATION_ERROR' })
  })
})

describe('PATCH /api/v1/teams/[teamId]/members/[memberId]', () => {
  const invoke = (body: Body) => patchMember(makeReq('PATCH', '/api/v1/teams/team-1/members/member-1', body), idParams({ teamId: 'team-1', memberId: 'member-1' }))
  beforeEach(() => { mocks.queryOneWithRLS.mockResolvedValue({ id: 'member-1', teamId: 'team-1', userId: 'user-9', role: 'member' }) })

  describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })

  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['a role that does not exist', { role: 'emperor' }],
    ['the owner role', { role: 'owner' }],
    ['a role given a number', { role: 3 }],
    ['a role given an array', { role: ['admin'] }],
    ['a role given null', { role: null }],
  ], { code: 'VALIDATION_ERROR' })

  test('a member that does not exist is answered 404 and changes nothing', async () => {
    mocks.queryOneWithRLS.mockResolvedValue(null)
    await expectCleanRejection(await invoke(asJson({ role: 'admin' })), { status: 404, code: 'MEMBER_NOT_FOUND' })
    noWrites()
  })
})

describe('POST /api/v1/teams/[teamId]/transfer-ownership', () => {
  const invoke = (body: Body) => transferOwnership(makeReq('POST', '/api/v1/teams/team-1/transfer-ownership', body), idParams({ teamId: 'team-1' }))

  describeMalformedBodies(invoke)

  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['a new owner given a number', { newOwnerId: 5 }],
    ['a new owner given an object', { newOwnerId: { id: 'x' } }],
    ['a new owner that is empty', { newOwnerId: '' }],
  ])

  test('nothing is transferred for any of them', async () => {
    await invoke(asJson({ newOwnerId: 5 }))
    expect(mockTransferOwnership).not.toHaveBeenCalled()
  })
})
