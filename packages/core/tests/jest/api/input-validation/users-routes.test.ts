/**
 * S192 — input validation of /api/v1/users (GET, POST) and /api/v1/users/[id] (GET, PATCH, DELETE).
 */

import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, SUPERADMIN, allWrites } from './__helpers__/route-harness'
import { GET as listUsers, POST as createUser } from '@/app/api/v1/users/route'
import { GET as getUser, PATCH as patchUser, DELETE as deleteUser } from '@/app/api/v1/users/[id]/route'

const { mocks } = routeHarness
const NOT_FOUND_ROW = null
const VALID_USER = { email: 'ana@example.test', firstName: 'Ana', lastName: 'Pérez', country: 'AR' }

beforeEach(() => routeHarness.reset())

describe('POST /api/v1/users — bodies', () => {
  const invoke = (body: Parameters<typeof makeReq>[2]) => createUser(makeReq('POST', '/api/v1/users', body), undefined as never)
  describeMalformedBodies(invoke)
})

describe('POST /api/v1/users — values', () => {
  const invoke = (body: Parameters<typeof makeReq>[2]) => createUser(makeReq('POST', '/api/v1/users', body), undefined as never)
  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['an email that is not an email', { ...VALID_USER, email: 'not-an-email' }],
    ['an email given a number', { ...VALID_USER, email: 42 }],
    ['an email given an object', { ...VALID_USER, email: { a: 1 } }],
    ['a first name given null', { ...VALID_USER, firstName: null }],
    ['a first name that is empty', { ...VALID_USER, firstName: '' }],
    ['a last name given an array', { ...VALID_USER, lastName: ['Pérez'] }],
    ['a country of one character', { ...VALID_USER, country: 'A' }],
    ['an image that is not a URL', { ...VALID_USER, image: 'not a url' }],
    ['a role outside the assignable roles', { ...VALID_USER, role: 'owner-of-everything' }],
    ['a role given a number', { ...VALID_USER, role: 7 }],
    ['language given an object', { ...VALID_USER, language: { code: 'es' } }],
  ], { code: 'VALIDATION_ERROR' })

  test('extra fields are ignored and never written', async () => {
    const response = await invoke(asJson({ ...VALID_USER, id: 'forced-id', emailVerified: false, password: 'x', colour: 'brown' }))
    // accepted (the schema strips them) or refused; either way the extra values never reach a statement
    expect(response.status).toBeLessThan(500)
    for (const [, params] of allWrites()) {
      expect(params).not.toContain('forced-id')
      expect(params).not.toContain('x')
      expect(params).not.toContain('brown')
    }
  })

  test.each([
    ['accented Latin', 'María José', 'Núñez-Ñandú'],
    ['CJK', '太郎', '山田'],
    ['right-to-left', 'محمد', 'الأحمد'],
    ['emoji and combining marks', 'Renée 🐕‍🦺', 'Özil'],
  ])('stores %s names unchanged', async (_label, firstName, lastName) => {
    mocks.mutateWithRLS.mockImplementation(async (_sql: string, params: unknown[]) => ({
      rows: [{ id: params[0], email: params[1], firstName: params[2], lastName: params[3] }], rowCount: 1,
    }))
    const response = await invoke(asJson({ ...VALID_USER, firstName, lastName })) as unknown as { status: number; json(): Promise<{ data: { firstName: string; lastName: string } }> }
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.firstName).toBe(firstName)
    expect(body.data.lastName).toBe(lastName)
  })
})

describe('GET /api/v1/users — query parameters', () => {
  const list = (query: string) => listUsers(makeReq('GET', `/api/v1/users${query}`), undefined as never)

  test.each([
    ['a search field that is not offered', '?search=ana&searchField=password', 'INVALID_SEARCH_FIELD'],
    ['a search field that is empty-looking', '?search=ana&searchField=%20', 'INVALID_SEARCH_FIELD'],
  ])('rejects %s with 400 %s', async (_label, query, code) => {
    await expectCleanRejection(await list(query), { status: 400, code })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test.each([
    ['unknown parameters', '?colour=brown&x=1'],
    ['repeated parameters', '?role=member&role=superadmin&page=1&page=2'],
    ['a negative page', '?page=-4'],
    ['page zero', '?page=0'],
    ['a limit over the maximum', '?limit=100000'],
    ['a negative limit', '?limit=-1'],
  ])('answers %s with a normal 200', async (_label, query) => {
    mocks.queryWithRLS.mockResolvedValue([{ count: 0 }])
    const response = await list(query)
    expect(response.status).toBe(200)
  })

  test.each([
    ['a page of text', '?page=abc'],
    ['a limit of text', '?limit=many'],
  ])('answers %s without a 500 (the offset is never NaN)', async (_label, query) => {
    mocks.queryWithRLS.mockImplementation(async (_sql: string, params: unknown[] = []) => {
      if (params.some(p => typeof p === 'number' && !Number.isFinite(p))) throw Object.assign(new Error('invalid input syntax for type bigint: "NaN"'), { code: '22P02' })
      return [{ count: 0 }]
    })
    const response = await list(query)
    expect(response.status).toBeLessThan(500)
  })

  test('a very long search string is bound as a parameter', async () => {
    mocks.queryWithRLS.mockResolvedValue([{ count: 0 }])
    const search = 'ñ'.repeat(20_000)
    const response = await list(`?search=${encodeURIComponent(search)}`)
    expect(response.status).toBe(200)
    const [sql, params] = mocks.queryWithRLS.mock.calls[0] as [string, unknown[]]
    expect(sql).not.toContain(search)
    expect(params).toContain(`%${search}%`)
  })
})

describe('/api/v1/users/[id]', () => {
  const ctx = (id: string) => idParams({ id })
  const patch = (body: Parameters<typeof makeReq>[2], id = 'user-1') => patchUser(makeReq('PATCH', `/api/v1/users/${id}`, body), ctx(id))

  describe('PATCH — bodies', () => {
    beforeEach(() => { mocks.queryOneWithRLS.mockResolvedValue({ id: 'user-1', role: 'member' }) })
    describeMalformedBodies(body => patch(body), )
  })

  describe('PATCH — values', () => {
    beforeEach(() => { mocks.queryOneWithRLS.mockResolvedValue({ id: 'user-1', role: 'member' }) })
    describeRejectedValues(body => patch(body), [
      ['a first name given a number', { firstName: 12 }],
      ['a first name given an object', { firstName: { a: 1 } }],
      ['a first name given null', { firstName: null }],
      ['a role outside the assignable roles', { role: 'owner-of-everything' }],
      ['a role given an array', { role: ['member'] }],
      ['language given a number', { language: 3 }],
    ], { code: 'VALIDATION_ERROR' })

    test('an object with nothing to update says so with 400 NO_FIELDS and writes nothing', async () => {
      await expectCleanRejection(await patch(asJson({})), { status: 400, code: 'NO_FIELDS' })
      noWrites()
    })
  })

  describe('an id that is not a UUID (user ids are text, or an email)', () => {
    test.each([['text', 'not-a-uuid'], ['digits', '12345'], ['an over-long string', 'a'.repeat(5000)], ['an email', 'ghost@example.test']])('GET %s is answered 404', async (_label, id) => {
      mocks.queryOneWithRLS.mockResolvedValue(NOT_FOUND_ROW)
      mocks.authenticateRequest.mockResolvedValue(sessionAs(SUPERADMIN))
      await expectCleanRejection(await getUser(makeReq('GET', `/api/v1/users/${id}`), ctx(id)), { status: 404, code: 'USER_NOT_FOUND' })
    })

    test.each([['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)]])('DELETE %s is answered 404 and deletes nothing', async (_label, id) => {
      mocks.queryOneWithRLS.mockResolvedValue(NOT_FOUND_ROW)
      await expectCleanRejection(await deleteUser(makeReq('DELETE', `/api/v1/users/${id}`), ctx(id)), { status: 404, code: 'USER_NOT_FOUND' })
      noWrites()
    })

    test('a member reading someone else is answered 403, not 404', async () => {
      mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
      await expectCleanRejection(await getUser(makeReq('GET', '/api/v1/users/not-a-uuid'), ctx('not-a-uuid')), { status: 403, code: 'FORBIDDEN' })
    })

    test('a blank id is answered 400 MISSING_IDENTIFIER', async () => {
      await expectCleanRejection(await getUser(makeReq('GET', '/api/v1/users/%20'), ctx('   ')), { status: 400, code: 'MISSING_IDENTIFIER' })
    })
  })
})
