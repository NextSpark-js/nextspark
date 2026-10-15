/**
 * S192 — input validation of the superadmin and devtools routes:
 *   /api/superadmin/users, /users/[userId], /teams, /teams/[teamId], /subscriptions,
 *   /api/devtools/tests/[...path], /api/v1/devtools/docs, /api/v1/devtools/scheduled-actions (+ /run).
 * These routes answer `{ error: '<fixed text>' }` with a stable `code`.
 */

import { NextRequest } from 'next/server'
import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, bodyOf, sessionAs, SUPERADMIN, DEVELOPER, pgRejectsPaging } from './__helpers__/route-harness'

const mockSession = jest.fn()
jest.mock('@/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: (...a: unknown[]) => mockSession(...a) }))
jest.mock('@/core/lib/auth/suspension', () => ({ suspendUser: jest.fn(), unsuspendUser: jest.fn(), isSuspendedRole: () => false }))
jest.mock('@/core/lib/api/auth/devtools-auth', () => ({
  canAccessDevtoolsApi: () => true,
  createDevtoolsAccessDeniedResponse: () => new Response('{}', { status: 403 }),
  createDevtoolsUnauthorizedResponse: () => new Response('{}', { status: 401 }),
}))
const mockExecute = jest.fn()
const mockSchedule = jest.fn()
jest.mock('@/core/lib/scheduled-actions/processor', () => ({ executeAction: (...a: unknown[]) => mockExecute(...a) }))
jest.mock('@/core/lib/scheduled-actions/scheduler', () => ({ scheduleAction: (...a: unknown[]) => mockSchedule(...a) }))
jest.mock('@/core/lib/scheduled-actions/registry', () => ({ getAllRegisteredActions: () => [] }))
const mockProcessPending = jest.fn()
jest.mock('@/core/lib/scheduled-actions', () => ({ processPendingActions: (...a: unknown[]) => mockProcessPending(...a), cleanupOldActions: jest.fn(async () => 0) }))
jest.mock('next/navigation', () => ({ unstable_rethrow: jest.fn() }))
const mockExpireTrials = jest.fn()
jest.mock('@/core/lib/billing/jobs', () => ({ handlePastDueGracePeriod: jest.fn(async () => ({ processed: 0, errors: [] })) }))
jest.mock('@/core/lib/services', () => ({ SubscriptionService: { processExpiredTrials: (...a: unknown[]) => mockExpireTrials(...a) }, UsageService: { processMonthlyReset: jest.fn() } }))
jest.mock('fs/promises', () => ({ readFile: jest.fn(), stat: jest.fn(async () => { throw new Error('ENOENT') }), readdir: jest.fn(async () => []) }))

import { GET as superadminUsers } from '@/app/api/superadmin/users/route'
import { PATCH as superadminUserAction, GET as superadminUser, DELETE as superadminDeleteUser } from '@/app/api/superadmin/users/[userId]/route'
import { GET as superadminTeams } from '@/app/api/superadmin/teams/route'
import { GET as superadminTeam } from '@/app/api/superadmin/teams/[teamId]/route'
import { GET as superadminSubscriptions } from '@/app/api/superadmin/subscriptions/route'
import { GET as devtoolsTestFile } from '@/app/api/devtools/tests/[...path]/route'
import { GET as devtoolsDocs } from '@/app/api/v1/devtools/docs/route'
import { GET as listScheduled, POST as retryScheduled } from '@/app/api/v1/devtools/scheduled-actions/route'
import { GET as cronProcess } from '@/app/api/v1/cron/process/route'
import { GET as cronBillingLifecycle } from '@/app/api/cron/billing/lifecycle/route'
import { POST as runScheduled } from '@/app/api/v1/devtools/scheduled-actions/run/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]

beforeEach(() => {
  routeHarness.reset()
  mockSession.mockResolvedValue({ session: { id: 's' }, user: { id: 'admin-1', role: 'superadmin' } })
  mocks.authenticateRequest.mockResolvedValue(sessionAs(DEVELOPER))
  mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejectsPaging(sql, params); return [{ total: 0, count: 0 }] })
})

const paging = (handler: (request: NextRequest, ctx?: never) => Promise<{ status: number }>, path: string) => {
  const get = (query: string) => handler(makeReq('GET', `${path}${query}`) as never)

  test.each([
    ['a negative page', '?page=-4'],
    ['page zero', '?page=0'],
    ['a limit over the maximum', '?limit=100000'],
    ['repeated parameters', '?page=1&page=2&limit=5&limit=7'],
    ['unknown parameters', '?colour=brown'],
    ['a very long search string', `?search=${encodeURIComponent('ñ'.repeat(20_000))}`],
  ])('answers %s with a normal 200', async (_label, query) => {
    expect((await get(query)).status).toBe(200)
  })

  return get
}

describe('GET /api/superadmin/users — query parameters', () => {
  const get = paging(superadminUsers as never, '/api/superadmin/users')

  test('a caller who is not a superadmin or developer is answered 403 before any query', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u', role: 'member' } })
    await expectCleanRejection(await get(''), { status: 403 })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test.each([
    ['a page of text', '?page=abc'],
    ['a limit of text', '?limit=many'],
  ])('answers %s without a server error', async (_label, query) => {
    expect((await get(query)).status).toBeLessThan(500)
  })
})

describe('GET /api/superadmin/teams — query parameters', () => {
  const get = paging(superadminTeams as never, '/api/superadmin/teams')
  test.each([
    ['a page of text', '?page=abc'],
    ['a limit of text', '?limit=many'],
  ])('answers %s without a server error', async (_label, query) => {
    expect((await get(query)).status).toBeLessThan(500)
  })
  test('a type that is neither user nor system lists everything', async () => {
    expect((await get('?type=other')).status).toBe(200)
  })
})

describe('GET /api/superadmin/subscriptions — query parameters', () => {
  const get = (query: string) => superadminSubscriptions(makeReq('GET', `/api/superadmin/subscriptions${query}`) as never)

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters', '?status=active&status=canceled'],
    ['a status, plan and interval that do not exist', '?status=lost&plan=none&interval=weekly'],
  ])('answers %s with a normal 200', async (_label, query) => {
    expect((await get(query)).status).toBe(200)
  })

  test.each([
    ['a page of zero', '?page=0'],
    ['a negative page', '?page=-3'],
    ['a page of text', '?page=abc'],
    ['a negative limit', '?limit=-10'],
    ['a limit of text', '?limit=many'],
  ])('answers %s without a server error', async (_label, query) => {
    expect((await get(query)).status).toBeLessThan(500)
  })

  test('caps the limit (the other list endpoints stop at 100)', async () => {
    await get('?limit=1000000')
    const call = (mocks.queryWithRLS.mock.calls as Array<[string, unknown[]]>).find(([sql]) => /LIMIT \$\d+ OFFSET/.test(sql))!
    expect(call[1].some(p => typeof p === 'number' && p > 100)).toBe(false)
  })
})

describe('/api/superadmin/users/[userId]', () => {
  const ctx = (userId: string) => idParams({ userId })
  const patch = (body: Body, userId = 'user-7') => superadminUserAction(makeReq('PATCH', `/api/superadmin/users/${userId}`, body), ctx(userId) as never)

  describe('PATCH — bodies', () => {
    beforeEach(() => { mocks.queryWithRLS.mockResolvedValue([{ id: 'user-7', role: 'member' }]) })
    describeMalformedBodies(patch, {})
  })

  describe('PATCH — values', () => {
    beforeEach(() => { mocks.queryWithRLS.mockResolvedValue([{ id: 'user-7', role: 'member' }]) })
    describeRejectedValues(patch, [
      ['an empty object', {}],
      ['an action that does not exist', { action: 'promote' }],
      ['an action given a number', { action: 5 }],
      ['an action given an array', { action: ['suspend'] }],
      ['a role change with no role', { action: 'change-role' }],
      ['a role change to a role that does not exist', { action: 'change-role', role: 'emperor' }],
      ['a role change to a role given a number', { action: 'change-role', role: 7 }],
      ['a role change to a role given an array', { action: 'change-role', role: ['member'] }],
    ], {})

    test('an action on the caller own account is answered 400 and nothing is written', async () => {
      await expectCleanRejection(await patch(asJson({ action: 'suspend' }), 'admin-1'), { status: 400 })
      noWrites()
    })
  })

  describe('ids that match nothing (user ids are text)', () => {
    beforeEach(() => { mocks.queryWithRLS.mockResolvedValue([]) })
    test.each([['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)], ['non-ASCII text', 'usuaria-日本語']])('PATCH %s is answered 404 and changes nothing', async (_label, id) => {
      await expectCleanRejection(await patch(asJson({ action: 'suspend' }), id), { status: 404 })
      noWrites()
    })
    test.each([['GET', superadminUser], ['DELETE', superadminDeleteUser]] as const)('%s of an unknown id is answered 404', async (_label, handler) => {
      const response = await handler(makeReq('GET', '/api/superadmin/users/x'), ctx('not-a-uuid') as never)
      expect(response.status).toBe(404)
    })
  })
})

describe('GET /api/superadmin/teams/[teamId]', () => {
  test.each([['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)]])('a team id of %s that matches nothing is answered 404', async (_label, teamId) => {
    mocks.queryWithRLS.mockResolvedValue([])
    const response = await superadminTeam(makeReq('GET', `/api/superadmin/teams/${teamId}`), idParams({ teamId }) as never)
    expect(response.status).toBe(404)
  })
})

describe('GET /api/devtools/tests/[...path]', () => {
  const get = (path: string[]) => devtoolsTestFile(makeReq('GET', '/api/devtools/tests/x'), { params: Promise.resolve({ path }) } as never)
  beforeEach(() => { mockSession.mockResolvedValue({ user: { id: 'dev-1', role: 'developer' } }) })

  test.each([
    ['no segments', []],
    ['a segment holding a slash', ['a/b.cy.ts']],
  ])('%s is answered 400 and no file is read', async (_label, path) => {
    const fs = jest.requireMock('fs/promises') as { readFile: jest.Mock }
    await expectCleanRejection(await get(path), { status: 400 })
    expect(fs.readFile).not.toHaveBeenCalled()
  })

  test('a file that does not exist is answered 404', async () => {
    await expectCleanRejection(await get(['no-such-file.bdd.md']), { status: 404 })
  })

  test('a segment that is empty or an over-long string is answered without a server error', async () => {
    for (const path of [[''], ['x'.repeat(5000)]]) expect((await get(path)).status).toBeLessThan(500)
  })
})

describe('GET /api/v1/devtools/docs', () => {
  const get = (query: string) => devtoolsDocs(new NextRequest(`http://localhost/api/v1/devtools/docs${query}`))

  test.each([
    ['no path', ''],
    ['an empty path', '?path='],
    ['a path outside every allowed pattern', '?path=README.md'],
    ['a path that is not markdown', '?path=api/things/docs.txt'],
    ['an over-long path', `?path=${'a/'.repeat(5000)}docs.md`],
    ['a path with a backslash', '?path=api%5Cthings%5Cdocs.md'],
  ])('%s is answered 400 and no file is read', async (_label, query) => {
    const fs = jest.requireMock('fs/promises') as { readFile: jest.Mock }
    await expectCleanRejection(await get(query), { status: 400 })
    expect(fs.readFile).not.toHaveBeenCalled()
  })

  test('repeated path parameters read the first and are answered without a server error', async () => {
    expect((await get('?path=api/things/docs.md&path=api/other/docs.md')).status).toBeLessThan(500)
  })
})

describe('/api/v1/devtools/scheduled-actions', () => {
  const list = (query: string) => listScheduled(new NextRequest(`http://localhost/api/v1/devtools/scheduled-actions${query}`))

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['a status that does not exist', '?status=lost'],
    ['repeated parameters', '?status=failed&status=pending'],
  ])('GET answers %s with a normal 200', async (_label, query) => {
    mocks.queryWithRLS.mockResolvedValue([{ count: '0' }])
    expect((await list(query)).status).toBe(200)
  })

  test.each([
    ['a page of zero', '?page=0'],
    ['a negative page', '?page=-2'],
    ['a page of text', '?page=abc'],
    ['a negative limit', '?limit=-5'],
    ['a limit of text', '?limit=many'],
  ])('GET answers %s without a server error', async (_label, query) => {
    mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejectsPaging(sql, params); return [{ count: '0' }] })
    expect((await list(query)).status).toBeLessThan(500)
  })

  for (const [name, handler, url] of [
    ['POST retry', retryScheduled, '/api/v1/devtools/scheduled-actions'],
    ['POST run', runScheduled, '/api/v1/devtools/scheduled-actions/run'],
  ] as const) {
    describe(name, () => {
      const invoke = (body: Body) => handler(makeReq('POST', url, body) as never)
      const nothingScheduled = () => { expect(mockSchedule).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled() }

      describe('bodies', () => {
        describeMalformedBodies(invoke, {})
      })

      describeRejectedValues(invoke, [
        ['an empty object', {}],
        ['an action id that is empty', { actionId: '' }],
      ], {})

      test.each([
        ['an action id given a number', { actionId: 5 }],
        ['an action id given an object', { actionId: { id: 'x' } }],
        ['an action id given an array', { actionId: ['x'] }],
      ])('rejects %s with 400 before it queries', async (_label, value) => {
        await expectCleanRejection(await invoke(asJson(value)), { status: 400, code: 'VALIDATION_ERROR' })
        expect(mocks.queryWithRLS).not.toHaveBeenCalled()
      })

      test('an action id that matches nothing is answered 404', async () => {
        mocks.queryWithRLS.mockResolvedValue([])
        await expectCleanRejection(await invoke(asJson({ actionId: 'not-a-uuid' })), { status: 404 })
        nothingScheduled()
      })
    })
  }
})

describe('the cron endpoints (their only input is a secret in a header)', () => {
  const SECRET = 'cron-secret-for-tests'
  beforeEach(() => { process.env.CRON_SECRET = SECRET; mockProcessPending.mockReset(); mockExpireTrials.mockReset() })
  afterAll(() => { delete process.env.CRON_SECRET })

  test.each([
    ['no header', {}],
    ['an empty header', { 'x-cron-secret': '' }],
    ['a header with the wrong value', { 'x-cron-secret': 'nope' }],
    ['a header with a different case of the value', { 'x-cron-secret': SECRET.toUpperCase() }],
    ['the secret in the wrong header', { authorization: `Bearer ${SECRET}` }],
    ['an over-long header', { 'x-cron-secret': 'x'.repeat(8000) }],
  ])('/api/v1/cron/process with %s is answered 401 INVALID_CRON_SECRET and processes nothing', async (_label, headers) => {
    await expectCleanRejection(await cronProcess(makeReq('GET', '/api/v1/cron/process', undefined, headers)), { status: 401, code: 'INVALID_CRON_SECRET' })
    expect(mockProcessPending).not.toHaveBeenCalled()
  })

  test.each([
    ['no header', {}],
    ['the wrong scheme', { authorization: `Basic ${SECRET}` }],
    ['the wrong value', { authorization: 'Bearer nope' }],
    ['the secret in the wrong header', { 'x-cron-secret': SECRET }],
  ])('/api/cron/billing/lifecycle with %s is answered 401 and processes nothing', async (_label, headers) => {
    const response = await cronBillingLifecycle(makeReq('GET', '/api/cron/billing/lifecycle', undefined, headers))
    expect(response.status).toBe(401)
    expect(mockExpireTrials).not.toHaveBeenCalled()
  })

  test('a failed job is reported with a fixed text, and the cause is not in the body', async () => {
    mockExpireTrials.mockRejectedValue(new Error('connection to server at "10.0.0.5", port 5432 failed'))
    const response = await cronBillingLifecycle(makeReq('GET', '/api/cron/billing/lifecycle', undefined, { authorization: `Bearer ${SECRET}` }))
    expect(JSON.stringify(await bodyOf(response))).not.toContain('10.0.0.5')
  })
})
