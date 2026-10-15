/**
 * S192 — input validation of the generic entity handlers (/api/v1/[entity] and /api/v1/[entity]/[id]).
 *
 * Ordinary malformed data, as a buggy client sends it: a missing or non-JSON body, the wrong top-level
 * shape, wrong field types, strings over the declared limit, ids that are not UUIDs, unknown or repeated
 * query parameters, pagination out of range, extra fields. Each must come back 4xx with a stable code,
 * nothing internal in the body, and no write reaching the data layer.
 *
 * `test.failing` marks a case that today misbehaves; the finding is in the S192 report.
 */

import { harness, makeRequest, SESSION_AUTH, PETS_ENTITY } from '../entity/__helpers__/generic-handler-harness'
import {
  handleGenericList,
  handleGenericCreate,
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
} from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'
import { expectCleanRejection, writesFrom, jsonReaderFor, MALFORMED_BODIES, type BodyKind } from './__helpers__/clean-rejection'

const { mocks } = harness
const TEAM_HEADERS = { 'x-team-id': 'team-1' }
const NAME_MAX = 100

const PETS: EntityConfig = {
  ...PETS_ENTITY,
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: NAME_MAX, display: { label: 'Name' }, api: { readOnly: false } },
    { name: 'status', type: 'select', display: { label: 'Status' }, options: [{ value: 'active', label: 'Active' }, { value: 'adopted', label: 'Adopted' }], api: { readOnly: false } },
    { name: 'age', type: 'number', display: { label: 'Age' }, api: { readOnly: false } },
    { name: 'vaccinated', type: 'boolean', display: { label: 'Vaccinated' }, api: { readOnly: false } },
    { name: 'adoptedAt', type: 'datetime', display: { label: 'Adopted at' }, api: { readOnly: false } },
    { name: 'hashtags', type: 'tags', display: { label: 'Hashtags' }, api: { readOnly: false } },
  ],
} as unknown as EntityConfig

const VALID_ID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
type Res = { status: number; body: Record<string, unknown>; json(): Promise<Record<string, unknown>> }
type Ctx = { params: Promise<{ entity: string; id: string }> }

const ctx = (id: string): Ctx => ({ params: Promise.resolve({ entity: 'pets', id }) })

/** A request whose `json()` behaves like the platform's for the given body class. */
function requestWith(method: string, url: string, body?: BodyKind) {
  const request = makeRequest({ method, url, headers: TEAM_HEADERS })
  if (body) (request as unknown as { json: () => Promise<unknown> }).json = jsonReaderFor(body)
  return request
}
const jsonBody = (value: unknown): BodyKind => ({ kind: 'json', value })

const post = (body: BodyKind) => handleGenericCreate(requestWith('POST', 'http://localhost/api/v1/pets', body)) as unknown as Promise<Res>
const patch = (body: BodyKind, id = VALID_ID) =>
  handleGenericUpdate(requestWith('PATCH', `http://localhost/api/v1/pets/${id}`, body), ctx(id)) as unknown as Promise<Res>
const list = (query: string) => handleGenericList(requestWith('GET', `http://localhost/api/v1/pets${query}`)) as unknown as Promise<Res>

/** What Postgres does when it is handed a value that is not a uuid / a number it cannot read. */
function pgRejects(sql: string, params: unknown[] = [], badId?: string) {
  if (badId !== undefined && params.includes(badId)) {
    throw Object.assign(new Error(`invalid input syntax for type uuid: "${badId}"`), { code: '22P02' })
  }
  if (params.some(p => typeof p === 'number' && !Number.isFinite(p))) {
    throw Object.assign(new Error('invalid input syntax for type bigint: "NaN"'), { code: '22P02' })
  }
}

beforeEach(() => {
  harness.reset()
  // the handlers log every rejection; the output is not the subject here
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: PETS, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  // Real schemas, not the permissive harness stub: the validation is the subject.
  const { generateEntitySchemas } = jest.requireActual('@/core/lib/entities/schema-generator') as typeof import('@/core/lib/entities/schema-generator')
  mocks.generateEntitySchemas.mockImplementation(generateEntitySchemas)
  mocks.mutateWithRLS.mockImplementation(async (_sql: string, params: unknown[] = []) => ({ rows: [{ id: VALID_ID, name: params[0] }], rowCount: 1 }))
})

const noWrites = () => expect(writesFrom(mocks.mutateWithRLS)).toEqual([])

describe('POST /api/v1/[entity] — malformed bodies', () => {
  // A JSON null makes the handler destructure null and answer 500 (S192 finding F1).
  const KNOWN_DEFECTS = new Set(['a JSON null'])

  describe.each(MALFORMED_BODIES)('%s', (label, body) => {
    const run = async () => {
      const response = await post(body)
      await expectCleanRejection(response, { status: 400 })
      noWrites()
    }
    if (KNOWN_DEFECTS.has(label)) test.failing('is rejected with 400 and writes nothing', run)
    else test('is rejected with 400 and writes nothing', run)
  })
})

describe('POST /api/v1/[entity] — field values', () => {
  const REJECTED: Array<[string, Record<string, unknown>]> = [
    ['a required text field that is missing', { status: 'active' }],
    ['a required text field that is an empty string', { name: '' }],
    ['a required text field that is null', { name: null }],
    ['a text field given an object', { name: { first: 'Rex' } }],
    ['a text field given an array', { name: ['Rex'] }],
    ['a text field given a boolean', { name: true }],
    ['a text field over its declared maximum', { name: 'x'.repeat(NAME_MAX + 1) }],
    ['a text field far over its declared maximum', { name: 'x'.repeat(200_000) }],
    ['a select field with a value that is not an option', { name: 'Rex', status: 'archived' }],
    ['a select field given an object', { name: 'Rex', status: { value: 'active' } }],
    ['a number field given non-numeric text', { name: 'Rex', age: 'old' }],
    ['a number field given an object', { name: 'Rex', age: { years: 3 } }],
    ['a number field given an array', { name: 'Rex', age: [3] }],
    ['a boolean field given text', { name: 'Rex', vaccinated: 'yes' }],
    ['a boolean field given a number', { name: 'Rex', vaccinated: 1 }],
    ['a datetime field that is not a date', { name: 'Rex', adoptedAt: 'tomorrow' }],
    ['a datetime field given a number', { name: 'Rex', adoptedAt: 20260101 }],
    ['a tags field given an object', { name: 'Rex', hashtags: { a: 1 } }],
    ['a tags field given numbers', { name: 'Rex', hashtags: [1, 2] }],
    ['a tags field given nested arrays', { name: 'Rex', hashtags: [['a']] }],
    ['a field the entity does not declare', { name: 'Rex', colour: 'brown' }],
    ['an extra field next to valid ones', { name: 'Rex', id: VALID_ID, teamId: 'other-team', userId: 'someone-else', extra: 1 }],
  ]

  test.each(REJECTED)('rejects %s with 400 VALIDATION_ERROR and writes nothing', async (_label, payload) => {
    const response = await post(jsonBody(payload))
    await expectCleanRejection(response, { status: 400, code: 'VALIDATION_ERROR' })
    noWrites()
  })

  // Trimming happens after the required-check, so a whitespace-only value passes as present (finding F4).
  test.failing('rejects a required text field that is only whitespace with 400 VALIDATION_ERROR', async () => {
    const response = await post(jsonBody({ name: '   ' }))
    await expectCleanRejection(response, { status: 400, code: 'VALIDATION_ERROR' })
    noWrites()
  })

  test.failing('rejects a text value containing a NUL character with 400 (the database cannot store it)', async () => {
    const response = await post(jsonBody({ name: 'Rex\u0000Jr' }))
    await expectCleanRejection(response, { status: 400 })
    noWrites()
  })

  test('never writes handler-managed columns taken from the body', async () => {
    mocks.mutateWithRLS.mockClear()
    await post(jsonBody({ name: 'Rex', teamId: 'other-team', userId: 'someone-else', id: 'forced' }))
    // either refused as unknown fields, or accepted with the system columns ignored; never written from the body
    for (const [, params] of writesFrom(mocks.mutateWithRLS)) {
      expect(params).not.toContain('other-team')
      expect(params).not.toContain('someone-else')
      expect(params).not.toContain('forced')
    }
  })

  const UNICODE: Array<[string, string]> = [
    ['accented Latin and CJK', 'Ünïcödé 日本語 ñandú'],
    ['an emoji ZWJ sequence', 'Rex 🐕‍🦺 👩‍👩‍👧'],
    ['right-to-left text', 'ريكس الكلب'],
    ['combining marks', 'Renée'],
    ['astral-plane characters', '𝔘𝔫𝔦𝔠𝔬𝔡𝔢 𠀀'],
  ]

  test.each(UNICODE)('stores and returns %s unchanged', async (_label, name) => {
    // a stand-in table: the row read back is whatever the INSERT wrote, column by column
    mocks.queryWithRLS.mockImplementation(async (sql: string) => {
      const insert = writesFrom(mocks.mutateWithRLS).find(([text]) => text.includes('INSERT INTO "pets"'))
      if (!insert || !sql.includes('WHERE t.id = $1')) return []
      const columns = /\(([^)]*)\)\s*VALUES/.exec(insert[0])![1].split(',').map(c => c.trim().replace(/"/g, ''))
      return [Object.fromEntries(columns.map((column, index) => [column, insert[1][index]]))]
    })
    const response = await post(jsonBody({ name })) as Res
    expect(response.status).toBe(201)
    const [insert] = writesFrom(mocks.mutateWithRLS)
    expect(insert[0]).toContain('INSERT INTO')
    expect(insert[1]).toContain(name)
    expect((response.body.data as { name: string }).name).toBe(name)
  })
})

describe('POST /api/v1/[entity] — an entity with no required field', () => {
  beforeEach(() => {
    const optional = { ...PETS, fields: (PETS.fields as Array<{ name: string }>).map(field => ({ ...field, required: false })) } as unknown as EntityConfig
    mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: optional, entityName: 'pets' })
  })

  // A bare number, string or boolean is not an object; today it is read as an empty object and a blank row is created (finding F1).
  test.failing.each([
    ['a JSON number', 42],
    ['a JSON boolean', true],
  ])('rejects %s in place of an object with 400 and writes nothing', async (_label, value) => {
    const response = await post(jsonBody(value))
    await expectCleanRejection(response, { status: 400 })
    noWrites()
  })
})

describe('PATCH /api/v1/[entity]/[id] — malformed bodies and values', () => {
  const KNOWN_DEFECTS = new Set(['a JSON null'])

  describe.each(MALFORMED_BODIES)('%s', (label, body) => {
    const run = async () => {
      const response = await patch(body)
      await expectCleanRejection(response, { status: 400 })
      noWrites()
    }
    if (KNOWN_DEFECTS.has(label)) test.failing('is rejected with 400 and writes nothing', run)
    else test('is rejected with 400 and writes nothing', run)
  })

  test.each([
    ['a text field given an object', { name: { first: 'Rex' } }],
    ['a text field over its declared maximum', { name: 'x'.repeat(NAME_MAX + 1) }],
    ['a number field given non-numeric text', { age: 'old' }],
    ['a select field with a value that is not an option', { status: 'archived' }],
    ['a field the entity does not declare', { colour: 'brown' }],
  ])('rejects %s with 400 VALIDATION_ERROR and writes nothing', async (_label, payload) => {
    const response = await patch(jsonBody(payload))
    await expectCleanRejection(response, { status: 400, code: 'VALIDATION_ERROR' })
    noWrites()
  })

  test('an empty object changes nothing and says so with 400', async () => {
    const response = await patch(jsonBody({}))
    await expectCleanRejection(response, { status: 400 })
    noWrites()
  })

  test('stores and returns unusual Unicode unchanged', async () => {
    const name = 'Rex 🐕‍🦺 日本語 ريكس'
    const response = await patch(jsonBody({ name })) as Res
    expect(response.status).toBe(200)
    const [update] = writesFrom(mocks.mutateWithRLS)
    expect(update[1]).toContain(name)
  })
})

describe('ids that are not UUIDs', () => {
  // Entity ids are TEXT by convention (`id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`), so an id of any shape
  // is simply a row that does not exist: 404, nothing changed.
  const BAD_IDS: Array<[string, string]> = [
    ['text', 'not-a-uuid'],
    ['digits only', '12345'],
    ['a UUID with a missing group', '3f2b8c1e-5d4a-4b7e-9c10'],
    ['a UUID with extra characters', `${VALID_ID}-x`],
    ['an over-long string', 'a'.repeat(5000)],
    ['whitespace', '%20%20'],
  ]

  describe.each(BAD_IDS)('%s', (_label, badId) => {
    beforeEach(() => {
      mocks.queryWithRLS.mockResolvedValue([])
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
    })

    test('GET answers 404', async () => {
      const response = await handleGenericRead(requestWith('GET', `http://localhost/api/v1/pets/${badId}`), ctx(badId)) as unknown as Res
      await expectCleanRejection(response, { status: 404 })
    })

    test('PATCH answers 404 and changes no row', async () => {
      const response = await patch(jsonBody({ name: 'Rex' }), badId)
      await expectCleanRejection(response, { status: 404 })
    })

    test('DELETE answers 404 and deletes no row', async () => {
      const response = await handleGenericDelete(requestWith('DELETE', `http://localhost/api/v1/pets/${badId}`), ctx(badId)) as unknown as Res
      await expectCleanRejection(response, { status: 404 })
    })
  })

  // An entity whose id column is declared uuid (the CRM template has some) makes the database reject the id; the
  // handlers do not check the shape first, so that rejection is a 500 (finding F2, low).
  describe('on a table whose id column is a uuid type', () => {
    const badId = 'not-a-uuid'
    beforeEach(() => {
      mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejects(sql, params, badId); return [] })
      mocks.mutateWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejects(sql, params, badId); return { rows: [], rowCount: 0 } })
    })

    test.failing('GET answers 4xx', async () => {
      const response = await handleGenericRead(requestWith('GET', `http://localhost/api/v1/pets/${badId}`), ctx(badId)) as unknown as Res
      await expectCleanRejection(response)
    })

    test.failing('PATCH answers 4xx', async () => {
      await expectCleanRejection(await patch(jsonBody({ name: 'Rex' }), badId))
    })

    test.failing('DELETE answers 4xx', async () => {
      const response = await handleGenericDelete(requestWith('DELETE', `http://localhost/api/v1/pets/${badId}`), ctx(badId)) as unknown as Res
      await expectCleanRejection(response)
    })
  })
})

describe('GET /api/v1/[entity] — query parameters', () => {
  test.each([
    ['an unknown parameter', '?colour=brown', 'INVALID_FILTER'],
    ['an unknown parameter next to a valid one', '?status=active&colour=brown', 'INVALID_FILTER'],
    ['a sort field that does not exist', '?sortBy=nope', 'INVALID_SORT_FIELD'],
    ['a sort field given as an empty-looking list', '?sortBy=name,age', 'INVALID_SORT_FIELD'],
    ['a search field that does not exist', '?search=rex&searchField=nope', 'INVALID_SEARCH_FIELD'],
    ['a distinct query on a field that does not exist', '?distinct=true&fields=nope', 'INVALID_FIELD'],
  ])('rejects %s with 400 %s and reads nothing', async (_label, query, code) => {
    const response = await list(query)
    await expectCleanRejection(response, { status: 400, code })
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  test('repeated parameters are read as a list and answered normally', async () => {
    const response = await list('?status=active&status=adopted&limit=5&limit=7')
    expect(response.status).toBe(200)
  })

  test('an empty value for a filter is ignored, not an error', async () => {
    const response = await list('?status=&search=')
    expect(response.status).toBe(200)
  })

  test('a long search string is answered normally and passed as a bound parameter', async () => {
    const search = 'ñ'.repeat(10_000)
    const response = await list(`?search=${encodeURIComponent(search)}`)
    expect(response.status).toBe(200)
    const [sql, params] = mocks.queryWithRLS.mock.calls[0] as [string, unknown[]]
    expect(sql).not.toContain(search)
    expect(params).toContain(`%${search}%`)
  })

  describe('pagination out of range', () => {
    // Every pagination value that reaches the database must be a finite number: NaN is a type error there (finding F3).
    const reachesDatabaseAsNumbers = () => {
      for (const [sql, params] of mocks.queryWithRLS.mock.calls as Array<[string, unknown[]]>) {
        pgRejects(sql, params)
      }
    }

    test.each([
      ['a negative page', '?page=-3'],
      ['page zero', '?page=0'],
      ['a negative limit', '?limit=-10'],
      ['limit zero', '?limit=0'],
      ['a limit above the maximum', '?limit=100000'],
      ['a huge page number', '?page=99999999999'],
    ])('clamps %s to a valid window and answers 200', async (_label, query) => {
      mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejects(sql, params); return [] })
      const response = await list(query)
      expect(response.status).toBe(200)
      reachesDatabaseAsNumbers()
    })

    test.failing.each([
      ['a page that is not a number', '?page=abc'],
      ['a limit that is not a number', '?limit=many'],
    ])('answers %s with 4xx or a clamped 200, never a 500 (the offset becomes NaN)', async (_label, query) => {
      mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[] = []) => { pgRejects(sql, params); return [] })
      const response = await list(query)
      expect(response.status).toBeLessThan(500)
    })
  })
})
