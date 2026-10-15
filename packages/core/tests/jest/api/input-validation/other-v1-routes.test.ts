/**
 * S192 — input validation of the remaining request-taking routes under /api:
 *   billing (cancel, change-plan, check-action, checkout, plans), auth/signup-with-invite, post-categories,
 *   patterns/[id]/usages, internal/user-metadata, csp-report.
 */

import { NextRequest } from 'next/server'
import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, SUPERADMIN } from './__helpers__/route-harness'

const mockMembership = { role: 'owner', canPerformAction: jest.fn(() => ({ allowed: true })) }
const sub = { getActive: jest.fn(), canPerformAction: jest.fn(), changePlan: jest.fn() }
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: async () => mockMembership },
  SubscriptionService: new Proxy({}, { get: (_t, name: string) => (sub as Record<string, unknown>)[name] }),
  PlanService: { getAll: jest.fn(async () => []) },
  PatternUsageService: { getUsagesWithEntityInfo: jest.fn(async () => ({ usages: [], counts: {}, total: 0 })) },
}))
const mockVerify = jest.fn()
jest.mock('@/core/lib/billing/gateways/factory', () => ({ getBillingGateway: async () => ({ verifyWebhookSignature: (...a: unknown[]) => mockVerify(...a) }) }))
const mockMerge = jest.fn()
jest.mock('@/core/lib/services/meta.service', () => ({ MetaService: { mergeEntityMetaGroups: (...a: unknown[]) => mockMerge(...a) }, MetaValueTooLargeError: class extends Error {} }))
jest.mock('@/core/lib/config', () => ({ AUTH_CONFIG: {}, I18N_CONFIG: {}, getApplicationConfig: jest.fn(() => ({})) }))
jest.mock('@/core/lib/auth/auth-methods', () => ({ isPasswordLoginEnabled: () => true }))
jest.mock('@/core/lib/auth-context', () => ({ withSignupContext: async (_c: unknown, fn: () => unknown) => fn() }))
jest.mock('@/core/lib/auth/registration-errors', () => ({ isRegistrationRefusal: () => false }))
jest.mock('@/core/lib/base-path', () => ({ withBasePath: (p: string) => p }))
const mockPostCategoryQuery = jest.fn()
jest.mock('@/core/lib/api/post-categories', () => ({
  categoryReadTeam: async () => ({ teamId: 'team-1' }),
  categoryWriter: async () => ({ writer: { userId: 'user-1', teamId: 'team-1', canManage: true } }),
}))

import { POST as cancelBilling } from '@/app/api/v1/billing/cancel/route'
import { POST as changePlan } from '@/app/api/v1/billing/change-plan/route'
import { POST as checkAction } from '@/app/api/v1/billing/check-action/route'
import { POST as checkout } from '@/app/api/v1/billing/checkout/route'
import { POST as createPlan } from '@/app/api/v1/billing/plans/route'
import { POST as signupWithInvite } from '@/app/api/v1/auth/signup-with-invite/route'
import { POST as createCategory } from '@/app/api/v1/post-categories/route'
import { PUT as patchCategory } from '@/app/api/v1/post-categories/[id]/route'
import { GET as patternUsages } from '@/app/api/v1/patterns/[id]/usages/route'
import { createPatternUsagesHandlers } from '@/core/lib/api/routes/patterns-usages'
import { POST as seedUserMetadata } from '@/app/api/internal/user-metadata/route'
import { POST as cspReport } from '@/app/api/csp-report/route'
import { POST as stripeWebhook } from '@/app/api/v1/billing/webhooks/stripe/route'
import { POST as polarWebhook } from '@/app/api/v1/billing/webhooks/polar/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const TEAM = { 'x-team-id': 'team-1' }

beforeEach(() => {
  routeHarness.reset()
  mockMembership.canPerformAction.mockReturnValue({ allowed: true })
  Object.values(sub).forEach(fn => fn.mockReset())
  mockMerge.mockReset()
  mocks.authenticateRequest.mockResolvedValue({ ...sessionAs({ ...MEMBER, defaultTeamId: 'team-1' } as typeof MEMBER) })
  mocks.queryOneWithRLS.mockResolvedValue(null)
})

describe('billing — POST /cancel, /change-plan, /check-action, /checkout', () => {
  // These routes catch an unreadable body themselves and answer 400 { success: false, error }, without a `code`.
  describe('cancel', () => {
    const invoke = (body: Body) => cancelBilling(makeReq('POST', '/api/v1/billing/cancel', body, TEAM), undefined as never)
    describeMalformedBodies(invoke, {})
    describeRejectedValues(invoke, [
      ['immediate given text', { immediate: 'yes' }],
      ['a reason given a number', { reason: 5 }],
    ], {})
  })

  describe('change-plan', () => {
    const invoke = (body: Body) => changePlan(makeReq('POST', '/api/v1/billing/change-plan', body, TEAM), undefined as never)
    describeMalformedBodies(invoke, {})
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['a plan slug given a number', { planSlug: 5 }],
      ['a plan slug that is empty', { planSlug: '' }],
      ['an interval that does not exist', { planSlug: 'pro', billingInterval: 'weekly' }],
    ], {})
    test('nothing is changed for any of them', () => { expect(sub.changePlan).not.toHaveBeenCalled() })
  })

  describe('check-action', () => {
    const invoke = (body: Body) => checkAction(makeReq('POST', '/api/v1/billing/check-action', body, TEAM), undefined as never)
    describeMalformedBodies(invoke, {})
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['an action given a number', { action: 5 }],
      ['an action that is empty', { action: '' }],
      ['a team id that is not a UUID', { action: 'create', teamId: 'not-a-uuid' }],
      ['a team id given a number', { action: 'create', teamId: 5 }],
    ], {})
  })

  describe('checkout', () => {
    const invoke = (body: Body) => checkout(makeReq('POST', '/api/v1/billing/checkout', body, TEAM), undefined as never)
    describeMalformedBodies(invoke, {})
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['a plan slug given a number', { planSlug: 5 }],
      ['a billing period that does not exist', { planSlug: 'pro', billingPeriod: 'weekly' }],
    ], {})
  })
})

describe('POST /api/v1/billing/plans', () => {
  const invoke = (body: Body) => createPlan(makeReq('POST', '/api/v1/billing/plans', body, { cookie: 'session=1' }), undefined as never)
  beforeEach(() => { mocks.getSession.mockResolvedValue({ user: { ...SUPERADMIN }, session: { id: 's1' } }) })

  describe('bodies', () => {
    describeMalformedBodies(invoke)
  })
  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a slug with capitals', { slug: 'Pro', name: 'Pro' }],
      ['a slug over 50 characters', { slug: 'x'.repeat(51), name: 'Pro' }],
      ['a name over 100 characters', { slug: 'pro', name: 'x'.repeat(101) }],
      ['a description over 500 characters', { slug: 'pro', name: 'Pro', description: 'x'.repeat(501) }],
      ['a price given text', { slug: 'pro', name: 'Pro', priceMonthly: 'free' }],
      ['a negative price', { slug: 'pro', name: 'Pro', priceMonthly: -1 }],
      ['a fractional price', { slug: 'pro', name: 'Pro', priceMonthly: 9.99 }],
      ['a currency of two letters', { slug: 'pro', name: 'Pro', currency: 'us' }],
      ['features given text', { slug: 'pro', name: 'Pro', features: 'all' }],
      ['limits holding text', { slug: 'pro', name: 'Pro', limits: { projects: 'many' } }],
    ], )
  })
})

describe('POST /api/v1/auth/signup-with-invite', () => {
  const invoke = (body: Body) => signupWithInvite(makeReq('POST', '/api/v1/auth/signup-with-invite', body), undefined as never)
  const GOOD = { email: 'ana@example.test', password: 'correct horse', inviteToken: 'tok-1' }

  describe('bodies', () => {
    describeMalformedBodies(invoke)
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['an email that is not an email', { ...GOOD, email: 'not-an-email' }],
      ['a password of seven characters', { ...GOOD, password: '1234567' }],
      ['a missing password', { email: GOOD.email, inviteToken: GOOD.inviteToken }],
      ['a missing token', { email: GOOD.email, password: GOOD.password }],
    ], { code: /MISSING_FIELDS|INVALID_EMAIL|INVALID_PASSWORD/ })

    test.each([
      ['a password given a number', { ...GOOD, password: 12345678 }],
      ['a password given an object', { ...GOOD, password: { length: 99 } }],
      ['a token given an object', { ...GOOD, inviteToken: { a: 1 } }],
    ])('rejects %s with 400 before it looks anything up', async (_label, value) => {
      await expectCleanRejection(await invoke(asJson(value)), { status: 400 })
      expect(mocks.queryOneWithRLS).not.toHaveBeenCalled()
    })

    test('a token that matches no invitation is answered 404 INVITATION_NOT_FOUND', async () => {
      await expectCleanRejection(await invoke(asJson({ ...GOOD, inviteToken: 'x'.repeat(5000) })), { status: 404, code: 'INVITATION_NOT_FOUND' })
      noWrites()
    })
  })
})

describe('/api/v1/post-categories', () => {
  const create = (body: Body) => createCategory(makeReq('POST', '/api/v1/post-categories', body, TEAM), undefined as never)
  const patch = (body: Body, id = 'cat-1') => patchCategory(makeReq('PUT', `/api/v1/post-categories/${id}`, body, TEAM), idParams({ id }))

  describe('POST — bodies', () => {
    describeMalformedBodies(create, {})
  })
  describe('PUT — bodies', () => {
    describeMalformedBodies(patch, {})
  })
  describe('POST — values', () => {
    describeRejectedValues(create, [
      ['an empty object', {}],
      ['a name given a number', { name: 5 }],
      ['a name given an object', { name: { en: 'News' } }],
    ], {})
  })
})

describe('GET /api/v1/patterns/[id]/usages — pagination read by hand', () => {
  const get = (query: string, id = 'pattern-1') => patternUsages(makeReq('GET', `/api/v1/patterns/${id}/usages${query}`), idParams({ id }))
  beforeEach(() => { mocks.queryOneWithRLS.mockResolvedValue({ id: 'pattern-1' }); mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER)) })

  test('an unknown pattern is answered 404 PATTERN_NOT_FOUND', async () => {
    mocks.queryOneWithRLS.mockResolvedValue(null)
    await expectCleanRejection(await get('', 'nope'), { status: 404, code: 'PATTERN_NOT_FOUND' })
  })

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters', '?limit=5&limit=7&page=1&page=2'],
    ['a limit over the maximum', '?limit=100000'],
  ])('answers %s with a normal 200', async (_label, query) => {
    expect((await get(query)).status).toBe(200)
  })

  test.each([
    ['a limit of text', '?limit=many'],
    ['a page of text', '?page=abc'],
    ['a negative limit', '?limit=-5'],
    ['a limit of zero', '?limit=0'],
  ])('answers %s without handing NaN or a negative number to the query', async (_label, query) => {
    const { PatternUsageService } = jest.requireMock('@/core/lib/services') as { PatternUsageService: { getUsagesWithEntityInfo: jest.Mock } }
    PatternUsageService.getUsagesWithEntityInfo.mockClear()
    await get(query)
    expect(PatternUsageService.getUsagesWithEntityInfo).toHaveBeenCalledTimes(1)
    const { limit, offset } = PatternUsageService.getUsagesWithEntityInfo.mock.calls[0][2] as { limit: number; offset: number }
    expect(Number.isFinite(limit) && limit > 0).toBe(true)
    expect(Number.isFinite(offset) && offset >= 0).toBe(true)
  })
})

// the public factory apps export as their route reads page and limit by the same rule
describe('createPatternUsagesHandlers().GET — page and limit', () => {
  const { GET } = createPatternUsagesHandlers()
  beforeEach(() => { mocks.queryOneWithRLS.mockResolvedValue({ id: 'pattern-1' }); mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER)) })

  test.each([
    ['a limit of text', '?limit=many', 50, 0],
    ['a page of text', '?page=abc', 50, 0],
    ['a negative limit', '?limit=-5', 1, 0],
    ['a limit over the maximum', '?limit=100000&page=2', 100, 100],
  ])('%s reaches the service as a finite window', async (_label, query, limit, offset) => {
    const { PatternUsageService } = jest.requireMock('@/core/lib/services') as { PatternUsageService: { getUsagesWithEntityInfo: jest.Mock } }
    PatternUsageService.getUsagesWithEntityInfo.mockClear()
    const response = await GET(makeReq('GET', `/api/v1/patterns/pattern-1/usages${query}`) as never, idParams({ id: 'pattern-1' }) as never)
    expect(response.status).toBe(200)
    expect(PatternUsageService.getUsagesWithEntityInfo.mock.calls[0][2]).toMatchObject({ limit, offset })
  })
})

describe('POST /api/internal/user-metadata', () => {
  const invoke = (body: Body) => seedUserMetadata(makeReq('POST', '/api/internal/user-metadata', body), undefined as never)
  beforeEach(() => { mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER)) })

  describe('bodies', () => {
    describeMalformedBodies(invoke, {})
  })
  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['metadata given text', { userId: MEMBER.id, metadata: 'x' }],
    ['metadata missing', { userId: MEMBER.id }],
  ], {})
  test('another user id is answered 403 and merges nothing', async () => {
    await expectCleanRejection(await invoke(asJson({ userId: 'someone-else', metadata: { a: 1 } })), { status: 403 })
    expect(mockMerge).not.toHaveBeenCalled()
  })
})

describe('POST /api/csp-report (a report sink: it never answers 5xx)', () => {
  const send = (text: string, contentType = 'application/csp-report') =>
    cspReport(new NextRequest('http://localhost/api/csp-report', { method: 'POST', headers: { 'content-type': contentType }, body: text }))

  test.each([
    ['a body that is not JSON', 'not json at all'],
    ['an empty body', ''],
    ['a JSON null', 'null'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON string', '"x"'],
    ['a report with the wrong shape', '{"csp-report": 5}'],
    ['a report with no csp-report member', '{"other": true}'],
    ['a very long report', `{"csp-report": {"script-sample": "${'x'.repeat(2_000_000)}"}}`],
  ])('%s is answered without a server error', async (_label, text) => {
    const response = await send(text)
    expect(response.status).toBeLessThan(500)
  })

  test('a content type that is not a report type is answered 400', async () => {
    expect((await send('{}', 'text/plain')).status).toBe(400)
  })

  test('a missing content type is answered 400', async () => {
    const response = await cspReport(new NextRequest('http://localhost/api/csp-report', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(400)
  })
})

describe('billing webhooks (the body is only trusted after the signature is verified)', () => {
  const send = (handler: (request: never) => Promise<{ status: number }>, text: string, headers: Record<string, string>) =>
    handler(new NextRequest('http://localhost/api/v1/billing/webhooks/x', { method: 'POST', headers, body: text }) as never)
  const NOTHING_READ = () => expect(mocks.queryOneWithRLS).not.toHaveBeenCalled()
  beforeEach(() => { mockVerify.mockImplementation(() => { throw new Error('No signatures found matching the expected signature for payload') }) })

  test.each([
    ['stripe', stripeWebhook, {}],
    ['polar', polarWebhook, {}],
    ['polar with only some of the headers', polarWebhook, { 'webhook-id': 'x' }],
  ])('%s: a request without the signature headers is answered 400', async (_label, handler, headers) => {
    const response = await send(handler as never, '{"type":"x"}', headers)
    expect(response.status).toBe(400)
    expect(mockVerify).not.toHaveBeenCalled()
    NOTHING_READ()
  })

  test.each([
    ['stripe', stripeWebhook, { 'stripe-signature': 'bogus' }],
    ['polar', polarWebhook, { 'webhook-id': 'x', 'webhook-signature': 'bogus', 'webhook-timestamp': '0' }],
  ])('%s: a signature that does not verify is answered 400 with no internal text', async (_label, handler, headers) => {
    for (const text of ['', 'not json', 'null', '[]', '{"type": 5}']) {
      const response = await send(handler as never, text, headers) as unknown as { status: number; json(): Promise<unknown> }
      expect(response.status).toBe(400)
      expect(JSON.stringify(await response.json())).not.toMatch(/signatures found|payload/)
    }
    NOTHING_READ()
  })
})
