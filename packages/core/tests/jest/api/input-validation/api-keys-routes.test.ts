/**
 * S192 — input validation of /api/v1/api-keys (GET, POST) and /api/v1/api-keys/[id] (GET, PATCH, DELETE).
 */

import { routeHarness, makeReq, asJson, idParams, noWrites, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, allWrites } from './__helpers__/route-harness'
import { API_KEY_LIMITS, API_SCOPES } from '@/core/lib/api/keys'
import { POST as createKey } from '@/app/api/v1/api-keys/route'
import { PATCH as patchKey, GET as getKey, DELETE as deleteKey } from '@/app/api/v1/api-keys/[id]/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const VALID_SCOPE = Object.keys(API_SCOPES)[0]
const VALID = { name: 'CI key', scopes: [VALID_SCOPE] }

beforeEach(() => {
  routeHarness.reset()
  mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
  mocks.queryWithRLS.mockResolvedValue([{ count: 0 }])
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'key-1', name: 'CI key', scopes: [VALID_SCOPE], keyHash: 'h' }], rowCount: 1 })
})

describe('POST /api/v1/api-keys', () => {
  const invoke = (body: Body) => createKey(makeReq('POST', '/api/v1/api-keys', body), undefined as never)

  describe('bodies', () => {
    describeMalformedBodies(invoke)
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['an empty object', {}],
      ['a name that is empty', { ...VALID, name: '' }],
      ['a name over the documented maximum', { ...VALID, name: 'x'.repeat(API_KEY_LIMITS.maxKeyNameLength + 1) }],
      ['a name far over the documented maximum', { ...VALID, name: 'x'.repeat(500_000) }],
      ['a name given a number', { ...VALID, name: 5 }],
      ['a name given an object', { ...VALID, name: { a: 1 } }],
      ['scopes given text', { ...VALID, scopes: 'entities:read' }],
      ['scopes given an object', { ...VALID, scopes: { 0: 'entities:read' } }],
      ['scopes that are an empty list', { ...VALID, scopes: [] }],
      ['scopes holding numbers', { ...VALID, scopes: [1, 2] }],
      ['scopes holding null', { ...VALID, scopes: [null] }],
      ['an expiry that is not a date', { ...VALID, expiresAt: 'next week' }],
      ['an expiry given a number', { ...VALID, expiresAt: 1893456000 }],
      ['an expiry with no time part', { ...VALID, expiresAt: '2030-01-01' }],
    ], { code: 'VALIDATION_ERROR' })

    test('a scope that does not exist is refused with 400 INVALID_SCOPES and nothing is written', async () => {
      await expectCleanRejection(await invoke(asJson({ ...VALID, scopes: ['nothing:ever'] })), { status: 400, code: 'INVALID_SCOPES' })
      noWrites()
    })

    test('a very long list of scopes is refused without a server error and writes nothing', async () => {
      const response = await invoke(asJson({ ...VALID, scopes: Array.from({ length: 20_000 }, (_, i) => `nothing:${i}`) }))
      await expectCleanRejection(response, { status: 400, code: 'INVALID_SCOPES' })
      noWrites()
    })

    test('extra fields are ignored and never written', async () => {
      await invoke(asJson({ ...VALID, userId: 'someone-else', status: 'inactive', keyHash: 'forged', id: 'forced-id' }))
      for (const [, params] of allWrites()) {
        expect(params).not.toContain('someone-else')
        expect(params).not.toContain('forged')
        expect(params).not.toContain('forced-id')
      }
    })

    test.each([['accented Latin', 'Clave de integración Ñ'], ['CJK', '連携キー'], ['right-to-left', 'مفتاح التكامل'], ['emoji', 'CI 🔑 key']])('stores a %s name unchanged', async (_label, name) => {
      mocks.mutateWithRLS.mockImplementation(async (_sql: string, params: unknown[]) => ({ rows: [{ id: params[0], name: params[3] }], rowCount: 1 }))
      const response = await invoke(asJson({ ...VALID, name })) as unknown as { status: number; json(): Promise<{ data: { name: string } }> }
      expect(response.status).toBe(201)
      expect((await response.json()).data.name).toBe(name)
    })
  })
})

describe('PATCH /api/v1/api-keys/[id]', () => {
  const invoke = (body: Body, id = 'key-1') => patchKey(makeReq('PATCH', `/api/v1/api-keys/${id}`, body), idParams({ id }))

  describe('bodies', () => {
    describeMalformedBodies(invoke)
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a name given a number', { name: 5 }],
      ['a name given an object', { name: { a: 1 } }],
      ['a status that does not exist', { status: 'revoked' }],
      ['a status given a number', { status: 1 }],
    ])

    test('an object with nothing to update says so with 400 NO_FIELDS and writes nothing', async () => {
      await expectCleanRejection(await invoke(asJson({ colour: 'brown', scopes: ['*'] })), { status: 400, code: 'NO_FIELDS' })
      noWrites()
    })

    test.each([
      ['a name over the documented maximum', 'x'.repeat(API_KEY_LIMITS.maxKeyNameLength + 1)],
      ['a name far over the documented maximum', 'x'.repeat(500_000)],
      ['a name that is empty', ''],
    ])('rejects %s with 400 and writes nothing', async (_label, name) => {
      await expectCleanRejection(await invoke(asJson({ name })), { status: 400 })
      noWrites()
    })

    test('a scopes list in the body is never written (scopes cannot be edited)', async () => {
      await invoke(asJson({ name: 'renamed', scopes: ['*'] }))
      for (const [sql, params] of allWrites()) {
        expect(sql).not.toMatch(/SET[^]*scopes[^]*WHERE/)
        expect(JSON.stringify(params)).not.toContain('"*"')
      }
    })
  })

  describe('ids that match nothing (ids are TEXT, so any shape is just unknown)', () => {
    test.each([['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)], ['non-ASCII text', 'clé-日本語']])('PATCH %s is answered 404 API_KEY_NOT_FOUND', async (_label, id) => {
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
      await expectCleanRejection(await invoke(asJson({ name: 'renamed' }), id), { status: 404, code: 'API_KEY_NOT_FOUND' })
    })

    test.each([['GET', getKey], ['DELETE', deleteKey]] as const)('%s of an unknown id is answered 404', async (_label, handler) => {
      mocks.queryOneWithRLS.mockResolvedValue(null)
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
      const response = await handler(makeReq('GET', '/api/v1/api-keys/not-a-uuid'), idParams({ id: 'not-a-uuid' }))
      expect(response.status).toBe(404)
    })

    test('a blank id is answered 400 MISSING_API_KEY_ID', async () => {
      await expectCleanRejection(await invoke(asJson({ name: 'renamed' }), '   '), { status: 400, code: 'MISSING_API_KEY_ID' })
      noWrites()
    })
  })
})
