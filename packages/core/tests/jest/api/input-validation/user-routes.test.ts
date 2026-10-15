/**
 * S192 — input validation of the signed-in user's routes:
 *   /api/user/profile (PATCH), /api/user/plan-flags (GET, PATCH, POST), /api/v1/users/[id]/meta/[key] (PUT, GET).
 * The /api/user/* routes answer `{ error: '<fixed text>' }` without a `code` field (finding F11).
 */

import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, SUPERADMIN } from './__helpers__/route-harness'

const mockSession = jest.fn()
jest.mock('@/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: (...a: unknown[]) => mockSession(...a) }))
const mockMerge = jest.fn()
jest.mock('@/core/lib/services/meta.service', () => ({
  MetaService: { mergeEntityMetaGroups: (...a: unknown[]) => mockMerge(...a), getEntityMetas: jest.fn() },
  MetaValueTooLargeError: class MetaValueTooLargeError extends Error {},
}))
const mockUpdatePlan = jest.fn()
const mockUpdateFlags = jest.fn()
jest.mock('@/core/lib/user-data', () => ({
  getUserPlanAndFlags: async () => ({ plan: 'free', flags: [], cached: false }),
  updateUserPlan: (...a: unknown[]) => mockUpdatePlan(...a),
  updateUserFlags: (...a: unknown[]) => mockUpdateFlags(...a),
}))
const mockUpdateUserMeta = jest.fn()
jest.mock('@/core/lib/services', () => ({
  UserService: { getUserMeta: jest.fn(), updateUserMeta: (...a: unknown[]) => mockUpdateUserMeta(...a), deleteUserMeta: jest.fn() },
}))

import { PATCH as patchProfile } from '@/app/api/user/profile/route'
import { GET as getPlanFlags, PATCH as patchPlanFlags, POST as bulkPlanFlags } from '@/app/api/user/plan-flags/route'
import { PUT as putMeta, GET as getMeta } from '@/app/api/v1/users/[id]/meta/[key]/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const VALID_PROFILE = { firstName: 'Ana', lastName: 'Pérez', country: 'AR', timezone: 'UTC', language: 'es' }

beforeEach(() => {
  routeHarness.reset()
  mockSession.mockResolvedValue({ user: { id: 'user-1', email: 'user@test.com', role: 'member' } })
  mockUpdatePlan.mockResolvedValue(true)
  mockUpdateFlags.mockResolvedValue(true)
  mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'user-1' }], rowCount: 1 })
})

describe('PATCH /api/user/profile', () => {
  const invoke = (body: Body) => patchProfile(makeReq('PATCH', '/api/user/profile', body), undefined as never)

  describe('bodies', () => {
    // an unreadable body and a JSON null are thrown or destructured unguarded (500); a bare number or boolean reads as an empty update and answers 200 (finding F8)
    describeMalformedBodies(invoke, { codeless: true, defects: ['a missing body', 'an empty body', 'a body that is not JSON', 'a JSON null', 'a JSON number', 'a JSON boolean'] })
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a first name of one character', { ...VALID_PROFILE, firstName: 'A' }],
      ['a first name given a number', { ...VALID_PROFILE, firstName: 5 }],
      ['a first name given an object', { ...VALID_PROFILE, firstName: { a: 1 } }],
      ['a last name given null', { ...VALID_PROFILE, lastName: null }],
      ['a country that is empty', { ...VALID_PROFILE, country: '' }],
      ['a timezone given an array', { ...VALID_PROFILE, timezone: ['UTC'] }],
      ['only some of the profile fields', { firstName: 'Ana' }],
    ], { codeless: true })

    test.each([['accented Latin', 'María José', 'Núñez'], ['CJK', '太郎', '山田'], ['right-to-left', 'محمد', 'الأحمد'], ['emoji', 'Ana 🐕‍🦺', 'Pérez 🚀']])('stores a %s name unchanged', async (_label, firstName, lastName) => {
      const response = await invoke(asJson({ ...VALID_PROFILE, firstName, lastName }))
      expect(response.status).toBe(200)
      const [, params] = mocks.mutateWithRLS.mock.calls[0] as [string, unknown[]]
      expect(params.slice(0, 2)).toEqual([firstName, lastName])
    })
  })
})

describe('/api/user/plan-flags', () => {
  const patch = (body: Body) => patchPlanFlags(makeReq('PATCH', '/api/user/plan-flags', body), undefined as never)
  const bulk = (body: Body) => bulkPlanFlags(makeReq('POST', '/api/user/plan-flags', body), undefined as never)
  const nothingUpdated = () => { expect(mockUpdatePlan).not.toHaveBeenCalled(); expect(mockUpdateFlags).not.toHaveBeenCalled() }

  describe('PATCH — bodies', () => {
    describeMalformedBodies(patch, { codeless: true, defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })
  })

  describe('PATCH — values', () => {
    describeRejectedValues(patch, [
      ['a user id that is missing', { plan: 'free' }],
      ['a user id given a number', { userId: 5, plan: 'free' }],
      ['a plan that does not exist', { userId: 'user-1', plan: 'platinum' }],
      ['a plan given a number', { userId: 'user-1', plan: 3 }],
      ['flags given text', { userId: 'user-1', flags: 'vip' }],
      ['flags that do not exist', { userId: 'user-1', flags: ['demigod'] }],
      ['flags given an object', { userId: 'user-1', flags: { vip: true } }],
    ], { codeless: true })

    test('nothing is updated for a body that fails validation', async () => {
      await patch(asJson({ userId: 'user-1', plan: 'platinum' }))
      nothingUpdated()
    })
  })

  describe('POST (bulk) — bodies and limits', () => {
    beforeEach(() => { mockSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@test.com', role: 'superadmin' } }) })
    describeMalformedBodies(bulk, { codeless: true, defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })

    describeRejectedValues(bulk, [
      ['updates missing', {}],
      ['updates given an object', { updates: { userId: 'u1' } }],
      ['updates given text', { updates: 'all' }],
      ['an update without a user id', { updates: [{ plan: 'free' }] }],
      ['an update with a plan that does not exist', { updates: [{ userId: 'u1', plan: 'platinum' }] }],
      ['more than 100 updates', { updates: Array.from({ length: 101 }, (_, index) => ({ userId: `u${index}`, plan: 'free' })) }],
    ], { codeless: true })

    test('exactly 100 updates are processed', async () => {
      const response = await bulk(asJson({ updates: Array.from({ length: 100 }, (_, index) => ({ userId: `u${index}`, plan: 'free' })) }))
      expect(response.status).toBe(200)
      expect(mockUpdatePlan).toHaveBeenCalledTimes(100)
    })

    test('a caller who is not an admin is refused before the body is read', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', email: 'u@test.com', role: 'member' } })
      await expectCleanRejection(await bulk(asJson({ updates: [] })), { status: 403, codeless: true })
      nothingUpdated()
    })
  })

  describe('GET — query parameters', () => {
    test.each([
      ['repeated user ids (the first is read)', '?userId=user-1&userId=user-2'],
      ['an unknown parameter', '?colour=brown'],
      ['an over-long user id', `?userId=${'a'.repeat(5000)}`],
    ])('%s is answered without a server error', async (_label, query) => {
      const response = await getPlanFlags(makeReq('GET', `/api/user/plan-flags${query}`), undefined as never)
      expect(response.status).toBeLessThan(500)
    })
  })
})

describe('/api/v1/users/[id]/meta/[key]', () => {
  const put = (body: Body, key = 'theme', id = 'user-1') => putMeta(makeReq('PUT', `/api/v1/users/${id}/meta/${key}`, body), idParams({ id, key }))

  describe('PUT — bodies', () => {
    // an unreadable body is thrown inside a try whose catch answers 500 and repeats the parser message (finding F8/F12)
    describeMalformedBodies(put, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })
  })

  describe('PUT — values', () => {
    describeRejectedValues(put, [
      ['a data type that does not exist', { value: 1, dataType: 'blob' }],
      ['isPublic given text', { value: 1, isPublic: 'yes' }],
      ['isSearchable given a number', { value: 1, isSearchable: 1 }],
    ], { code: 'VALIDATION_ERROR' })

    test('a value over 1 MB is refused with 400 VALUE_TOO_LARGE and nothing is stored', async () => {
      await expectCleanRejection(await put(asJson({ value: 'x'.repeat(1_048_577) })), { status: 400, code: 'VALUE_TOO_LARGE' })
      expect(mockUpdateUserMeta).not.toHaveBeenCalled()
    })

    test('a key over 100 characters is refused with 400 INVALID_META_KEY and nothing is stored', async () => {
      await expectCleanRejection(await put(asJson({ value: 1 }), 'k'.repeat(101)), { status: 400, code: 'INVALID_META_KEY' })
      expect(mockUpdateUserMeta).not.toHaveBeenCalled()
    })

    test('a blank key is refused with 400 MISSING_META_KEY', async () => {
      await expectCleanRejection(await put(asJson({ value: 1 }), '   '), { status: 400, code: 'MISSING_META_KEY' })
      expect(mockUpdateUserMeta).not.toHaveBeenCalled()
    })

    test('a Unicode value and key are stored and returned unchanged', async () => {
      const value = 'Ünïcödé 日本語 🐕‍🦺 ريكس'
      const response = await put(asJson({ value }), 'prefs') as unknown as { status: number; json(): Promise<{ data: { value: string } }> }
      expect(response.status).toBe(200)
      expect(mockUpdateUserMeta.mock.calls[0][2]).toBe(value)
      expect((await response.json()).data.value).toBe(value)
    })
  })

  test.failing('the server-error body does not repeat internal error text', async () => {
    mocks.authenticateRequest.mockResolvedValue(sessionAs(SUPERADMIN))
    mockUpdateUserMeta.mockRejectedValue(new Error('connection to server at "10.0.0.5", port 5432 failed'))
    const response = await put(asJson({ value: 1 })) as unknown as { json(): Promise<unknown> }
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5')
  })

  test('GET with a key over 100 characters is refused with 400 INVALID_META_KEY', async () => {
    const key = 'k'.repeat(101)
    await expectCleanRejection(await getMeta(makeReq('GET', `/api/v1/users/user-1/meta/${key}`), idParams({ id: 'user-1', key })), { status: 400, code: 'INVALID_META_KEY' })
  })
})
