/**
 * S192 — input validation of the invitation and team-billing routes:
 *   /api/v1/team-invitations (GET), /api/v1/team-invitations/[token] (GET, accept, decline),
 *   /api/v1/teams/[teamId]/invoices (GET), /api/v1/teams/[teamId]/usage/[limitSlug] (POST).
 */

import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER } from './__helpers__/route-harness'

const mockMembership = { role: 'owner', canPerformAction: jest.fn(() => ({ allowed: true })) }
const mockTrack = jest.fn()
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: async () => mockMembership },
  SubscriptionService: { checkQuota: jest.fn() },
  UsageService: { track: (...a: unknown[]) => mockTrack(...a) },
}))

import { GET as listInvitations } from '@/app/api/v1/team-invitations/route'
import { GET as getInvitation } from '@/app/api/v1/team-invitations/[token]/route'
import { POST as acceptInvitation } from '@/app/api/v1/team-invitations/[token]/accept/route'
import { POST as declineInvitation } from '@/app/api/v1/team-invitations/[token]/decline/route'
import { GET as listTeamInvitations } from '@/app/api/v1/teams/[teamId]/invitations/route'
import { GET as getInvoice } from '@/app/api/v1/teams/[teamId]/invoices/[invoiceNumber]/route'
import { GET as listInvoices } from '@/app/api/v1/teams/[teamId]/invoices/route'
import { POST as trackUsage } from '@/app/api/v1/teams/[teamId]/usage/[limitSlug]/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]

beforeEach(() => {
  routeHarness.reset()
  mockMembership.canPerformAction.mockReturnValue({ allowed: true })
  mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
})

describe('GET /api/v1/team-invitations — query parameters', () => {
  const list = (query: string) => listInvitations(makeReq('GET', `/api/v1/team-invitations${query}`), undefined as never)

  test.each([
    ['a page of zero', '?page=0'],
    ['a negative page', '?page=-2'],
    ['a page of text', '?page=abc'],
    ['a limit over the maximum', '?limit=1000'],
    ['a limit of text', '?limit=many'],
    ['a status that does not exist', '?status=lost'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, query) => {
    await expectCleanRejection(await list(query), { status: 400, code: 'VALIDATION_ERROR' })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters', '?status=pending&status=accepted'],
    ['empty values', '?page=&limit=&status='],
  ])('answers %s with a normal 200', async (_label, query) => {
    mocks.queryWithRLS.mockResolvedValue([])
    expect((await list(query)).status).toBe(200)
  })
})

describe('invitation tokens that match nothing (any shape is just an unknown token)', () => {
  const TOKENS: Array<[string, string]> = [
    ['text', 'not-a-token'],
    ['a UUID with a missing group', '3f2b8c1e-5d4a-4b7e-9c10'],
    ['an over-long string', 'a'.repeat(5000)],
    ['non-ASCII text', 'señal-日本語-🐕'],
  ]

  describe.each(TOKENS)('%s', (_label, token) => {
    beforeEach(() => {
      mocks.queryOneWithRLS.mockResolvedValue(null)
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
    })

    test('GET is answered 404 INVITATION_NOT_FOUND', async () => {
      await expectCleanRejection(await getInvitation(makeReq('GET', '/api/v1/team-invitations/x'), idParams({ token })), { status: 404, code: 'INVITATION_NOT_FOUND' })
    })

    test('accept is answered 404 INVITATION_NOT_FOUND and changes nothing', async () => {
      await expectCleanRejection(await acceptInvitation(makeReq('POST', '/api/v1/team-invitations/x/accept'), idParams({ token })), { status: 404, code: 'INVITATION_NOT_FOUND' })
      noWrites()
    })

    test('decline is answered 404 INVITATION_NOT_FOUND and changes nothing', async () => {
      await expectCleanRejection(await declineInvitation(makeReq('POST', '/api/v1/team-invitations/x/decline'), idParams({ token })), { status: 404, code: 'INVITATION_NOT_FOUND' })
      noWrites()
    })
  })

  test.each([['GET', getInvitation, 'MISSING_TOKEN'], ['accept', acceptInvitation, 'MISSING_TOKEN'], ['decline', declineInvitation, 'MISSING_TOKEN']] as const)('a blank token on %s is answered 400 MISSING_TOKEN', async (_label, handler, code) => {
    await expectCleanRejection(await handler(makeReq('POST', '/api/v1/team-invitations/%20'), idParams({ token: '   ' })), { status: 400, code })
    noWrites()
  })
})

describe('GET /api/v1/teams/[teamId]/invoices — query parameters', () => {
  const list = (query: string) => listInvoices(makeReq('GET', `/api/v1/teams/team-1/invoices${query}`), idParams({ teamId: 'team-1' }))

  test.each([
    ['a limit of zero', '?limit=0'],
    ['a limit over the maximum', '?limit=101'],
    ['a limit of text', '?limit=many'],
    ['a fractional limit', '?limit=2.5'],
    ['a negative offset', '?offset=-1'],
    ['an offset of text', '?offset=abc'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, query) => {
    await expectCleanRejection(await list(query), { status: 400, code: 'VALIDATION_ERROR' })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test('repeated and unknown parameters are answered normally', async () => {
    mocks.queryWithRLS.mockResolvedValue([])
    expect((await list('?limit=5&limit=50&colour=brown')).status).toBe(200)
  })
})

describe('POST /api/v1/teams/[teamId]/usage/[limitSlug]', () => {
  const invoke = (body: Body) => trackUsage(
    makeReq('POST', '/api/v1/teams/team-1/usage/projects', body, { cookie: 'session=1' }),
    idParams({ teamId: 'team-1', limitSlug: 'projects' }),
  )
  const NOTHING_TRACKED = () => expect(mockTrack).not.toHaveBeenCalled()

  describe('bodies', () => {
    describeMalformedBodies(invoke)
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a delta given text', { delta: 'one', action: 'create' }],
      ['a delta given an object', { delta: { n: 1 }, action: 'create' }],
      ['an action given a number', { delta: 1, action: 5 }],
    ], { code: 'VALIDATION_ERROR' })

    test('nothing is tracked for any of them', async () => {
      await invoke(asJson({ delta: 'one', action: 'create' }))
      NOTHING_TRACKED()
    })
  })
})

describe('GET /api/v1/teams/[teamId]/invitations — pagination read by hand', () => {
  const list = (query: string) => listTeamInvitations(makeReq('GET', `/api/v1/teams/team-1/invitations${query}`), idParams({ teamId: 'team-1' }))

  beforeEach(() => {
    mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const [, , limit, offset] = params as [string, string, number?, number?]
      if (sql.includes('LIMIT') && (!Number.isFinite(limit) || !Number.isFinite(offset) || (limit as number) < 0 || (offset as number) < 0)) {
        throw Object.assign(new Error('LIMIT must not be negative'), { code: '2201W' })
      }
      return [{ count: '0' }]
    })
  })

  test.each([
    ['a page of zero', '?page=0'],
    ['a negative page', '?page=-3'],
    ['a page of text', '?page=abc'],
    ['a negative limit', '?limit=-5'],
    ['a limit of text', '?limit=many'],
  ])('answers %s without a server error', async (_label, query) => {
    expect((await list(query)).status).toBeLessThan(500)
  })

  test('caps the limit at the same maximum as the other list endpoints (100)', async () => {
    await list('?limit=100000')
    const listCall = (mocks.queryWithRLS.mock.calls as Array<[string, unknown[]]>).find(([sql]) => sql.includes('LIMIT'))!
    expect(listCall[1][2]).toBeLessThanOrEqual(100)
  })
})

describe('GET /api/v1/teams/[teamId]/invoices/[invoiceNumber]', () => {
  const get = (invoiceNumber: string, teamId = 'team-1') => getInvoice(makeReq('GET', '/api/v1/teams/team-1/invoices/x'), idParams({ teamId, invoiceNumber }))
  beforeEach(() => { mocks.queryWithRLS.mockResolvedValue([]) })

  test.each([
    ['text', 'INV-0001'],
    ['non-ASCII text', 'FAC-ñandú-日本語'],
    ['an over-long string', 'x'.repeat(5000)],
  ])('an invoice number of %s that matches nothing is answered 404', async (_label, invoiceNumber) => {
    expect((await get(invoiceNumber)).status).toBe(404)
  })

  test.each([
    ['a trailing percent sign', '100%'],
    ['a broken percent escape', '%E0%A4%A'],
  ])('an invoice number with %s is answered 404, not 500', async (_label, invoiceNumber) => {
    expect((await get(invoiceNumber)).status).toBe(404)
  })

  test.each([['invoice number', '   ', 'team-1', 'MISSING_INVOICE_NUMBER'], ['team id', 'INV-1', '   ', 'MISSING_TEAM_ID']])('a blank %s is answered 400 %s', async (_label, invoiceNumber, teamId, code) => {
    await expectCleanRejection(await get(invoiceNumber, teamId), { status: 400, code })
  })
})
