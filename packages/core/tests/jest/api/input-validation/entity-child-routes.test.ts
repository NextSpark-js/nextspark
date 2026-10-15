/**
 * The child-entity routes
 *   /api/v1/[entity]/[id]/child/[childType]            (GET, POST)
 *   /api/v1/[entity]/[id]/child/[childType]/[childId]  (PUT, DELETE)
 *
 * S192 — malformed bodies and ids that match no row come back 4xx with a stable code, nothing internal in the body,
 * and no statement sent to the data layer.
 * S193 — the routes answer like the entity handler on the PARENT record: the caller is authenticated (session or
 * API key with the parent's scope), holds the parent's `<slug>.read` / `<slug>.update` permission in the team, and
 * can read the parent; every value is a bound parameter and every statement runs as the caller.
 */

import { harness, makeRequest, SESSION_AUTH, API_KEY_AUTH, PETS_ENTITY, routeQueryOneWithRLS } from '../entity/__helpers__/generic-handler-harness'
import { expectCleanRejection, jsonReaderFor, MALFORMED_BODIES, type BodyKind } from './__helpers__/clean-rejection'

// the rate-limit wrapper is not the subject: pass the handler through
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/cors-response', () => ({ corsPreflight: jest.fn() }))
jest.mock('@nextsparkjs/registries/entity-registry', () => ({
  ENTITY_REGISTRY: {
    pets: { name: 'pets', config: {}, tableName: 'pets', parent: null, children: ['visits'], depth: 0 },
    visits: {
      name: 'visits',
      tableName: 'pets_visits',
      parent: 'pets',
      children: [],
      depth: 1,
      config: {
        table: 'visits',
        fields: [
          { name: 'note', type: 'text', required: false },
          { name: 'weight', type: 'number', required: false },
          { name: 'title', type: 'text', required: false },
          { name: 'parentId', type: 'text', required: true },
        ],
      },
    },
  },
  ENTITY_METADATA: {},
}), { virtual: true })

import { GET, POST } from '@/app/api/v1/[entity]/[id]/child/[childType]/route'
import { PUT, DELETE } from '@/app/api/v1/[entity]/[id]/child/[childType]/[childId]/route'

const { mocks } = harness
const PARENT_ID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
const CHILD_ID = '9a1c7e22-0b3d-4f6a-8e55-1d2c3b4a5f60'
const USER = 'session-user-1'

type Res = { status: number; body: Record<string, unknown>; json(): Promise<Record<string, unknown>> }
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

const params = (id: string, childId = CHILD_ID) => ({ params: Promise.resolve({ entity: 'pets', id, childType: 'visits', childId }) })

function req(method: Method, path: string, body?: BodyKind, headers: Record<string, string> = { 'x-team-id': 'team-1' }) {
  const request = makeRequest({ method, url: `http://localhost${path}`, headers })
  if (body) (request as unknown as { json: () => Promise<unknown> }).json = jsonReaderFor(body)
  return request
}
const json = (value: unknown): BodyKind => ({ kind: 'json', value })

/** One request to the route that serves `method`, for parent `parentId`. */
function call(method: Method, { parentId = PARENT_ID, childId = CHILD_ID, body, headers }: { parentId?: string; childId?: string; body?: BodyKind; headers?: Record<string, string> } = {}) {
  const base = `/api/v1/pets/${parentId}/child/visits`
  const run = { GET, POST, PUT, DELETE }[method] as unknown as (r: unknown, c: unknown) => Promise<Res>
  const path = method === 'PUT' || method === 'DELETE' ? `${base}/${childId}` : base
  const defaultBody = method === 'POST' || method === 'PUT' ? json({ note: 'ok' }) : undefined
  return run(req(method, path, body ?? defaultBody, headers), params(parentId, childId))
}

/** Statements on the parent or child tables (the team-membership lookup and the audit-log row are not data). */
const dataStatements = () => ([...mocks.queryWithRLS.mock.calls, ...mocks.mutateWithRLS.mock.calls] as Array<[string, unknown[], string]>)
  .filter(([sql]) => !sql.includes('"api_audit_log"'))
const childWrites = () => (mocks.mutateWithRLS.mock.calls as Array<[string, unknown[], string]>).filter(([sql]) => sql.includes('"pets_visits"'))
const childStatements = () => dataStatements().filter(([sql]) => sql.includes('"pets_visits"'))
const noStatements = () => {
  expect(dataStatements()).toEqual([])
  expect(mocks.queryOneWithRLS).not.toHaveBeenCalled()
}

/** The real entry point's scope enforcement: an API key without the route's scope is refused with 403. */
function apiKeyCaller(scopes: string[]) {
  mocks.authenticateRequest.mockImplementation(async (_request: unknown, options: { requiredScope?: string } = {}) => {
    if (options.requiredScope && !scopes.includes(options.requiredScope) && !scopes.includes('*')) {
      return { ...API_KEY_AUTH(scopes), success: false, error: { code: 'INSUFFICIENT_SCOPE', status: 403, message: 'Insufficient scope' } }
    }
    return API_KEY_AUTH(scopes)
  })
}

beforeEach(() => {
  harness.reset()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: PETS_ENTITY, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH(USER))
  // Real schemas: the validation is the subject
  const { generateEntitySchemas } = jest.requireActual('@/core/lib/entities/schema-generator') as typeof import('@/core/lib/entities/schema-generator')
  mocks.generateEntitySchemas.mockImplementation(generateEntitySchemas)
  // the parent is visible; the child statements return a row
  mocks.queryWithRLS.mockImplementation(async (sql: string) => (sql.includes('FROM "pets" t') ? [{ id: PARENT_ID }] : [{ id: CHILD_ID, note: 'ok' }]))
  mocks.mutateWithRLS.mockImplementation(async () => ({ rows: [{ id: CHILD_ID, note: 'ok' }], rowCount: 1 }))
})

describe('child routes — requests the routes already refuse', () => {
  test('an unknown child type is answered 404 and sends no statement', async () => {
    const response = await (GET as unknown as (r: unknown, c: unknown) => Promise<Res>)(
      req('GET', `/api/v1/pets/${PARENT_ID}/child/owners`),
      { params: Promise.resolve({ entity: 'pets', id: PARENT_ID, childType: 'owners' }) },
    )
    await expectCleanRejection(response, { status: 404 })
    noStatements()
  })

  test('an entity that is not registered is answered 404 and sends no statement', async () => {
    mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: false })
    await expectCleanRejection(await call('POST'), { status: 404 })
    noStatements()
  })
})

describe('POST child — malformed bodies', () => {
  describe.each(MALFORMED_BODIES)('%s', (_label, body) => {
    test('is rejected with 400 and no statement is sent', async () => {
      await expectCleanRejection(await call('POST', { body }), { status: 400, code: /^(VALIDATION_ERROR|INVALID_JSON)$/ })
      noStatements()
    })
  })

  test.each([
    ['a text field given an object', { note: { a: 1 } }],
    ['a number field given non-numeric text', { weight: 'heavy' }],
    ['a field the child entity does not declare', { colour: 'brown' }],
  ])('rejects %s with 400 and sends no statement', async (_label, value) => {
    await expectCleanRejection(await call('POST', { body: json(value) }), { status: 400, code: 'VALIDATION_ERROR' })
    noStatements()
  })

  test('rejects HTML markup in a title field, as the entity handler does, and sends no statement', async () => {
    await expectCleanRejection(await call('POST', { body: json({ title: '<b>x</b>' }) }), { status: 400, code: 'INVALID_FIELD_VALUE' })
    noStatements()
  })

  // The child's generated schema is the entity schema: a text field without a declared maxLength has no limit,
  // exactly as on /api/v1/[entity]. A default cap is a schema-generator change, outside these routes.
  test.failing('rejects a text field far over a sane length with 400 and sends no statement', async () => {
    await expectCleanRejection(await call('POST', { body: json({ note: 'x'.repeat(2_000_000) }) }), { status: 400, code: 'VALIDATION_ERROR' })
    noStatements()
  })
})

describe('PUT child — malformed bodies', () => {
  describe.each(MALFORMED_BODIES)('%s', (_label, body) => {
    test('is rejected with 400 and no statement is sent', async () => {
      await expectCleanRejection(await call('PUT', { body }), { status: 400, code: /^(VALIDATION_ERROR|INVALID_JSON)$/ })
      noStatements()
    })
  })

  test('a row sent back as read (id, parentId, timestamps) updates only the declared fields', async () => {
    const response = await call('PUT', { body: json({ id: CHILD_ID, parentId: 'another-parent', createdAt: 'x', updatedAt: 'y', note: 'changed' }) })
    expect(response.status).toBe(200)
    const [[sql, values]] = childWrites()
    expect(sql).toMatch(/SET "note" = \$3, "updatedAt" = NOW\(\)\s+WHERE "id" = \$1 AND "parentId" = \$2/)
    expect(values).toEqual([CHILD_ID, PARENT_ID, 'changed'])
  })
})

describe('ids that do not match a row (ids are TEXT, so any shape is just unknown)', () => {
  const UNKNOWN_IDS: Array<[string, string]> = [
    ['text', 'not-a-uuid'],
    ['digits only', '12345'],
    ['an over-long string', 'a'.repeat(5000)],
  ]

  describe.each(UNKNOWN_IDS)('%s', (_label, unknownId) => {
    test('PUT answers 404 for a child that does not exist', async () => {
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
      await expectCleanRejection(await call('PUT', { childId: unknownId }), { status: 404 })
    })

    test('DELETE answers 404 for a child that does not exist', async () => {
      mocks.mutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
      await expectCleanRejection(await call('DELETE', { childId: unknownId }), { status: 404 })
    })

    // F6: the parent is looked up first, so the insert never runs against a parent that is not there
    test('POST for a parent that does not exist answers 404 with no database text and inserts nothing', async () => {
      mocks.queryWithRLS.mockResolvedValue([])
      await expectCleanRejection(await call('POST', { parentId: unknownId }), { status: 404 })
      expect(childWrites()).toEqual([])
    })
  })
})

describe('ids the id column cannot hold (a uuid column given text: Postgres 22P02)', () => {
  const badUuid = () => Object.assign(new Error('invalid input syntax for type uuid: "not-a-uuid"'), { code: '22P02' })

  test('a malformed parent id answers 404, not 500, and no child statement runs', async () => {
    mocks.queryWithRLS.mockRejectedValue(badUuid())
    for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as Method[]) {
      await expectCleanRejection(await call(method, { parentId: 'not-a-uuid' }), { status: 404 })
    }
    expect(childStatements()).toEqual([])
  })

  test.each(['PUT', 'DELETE'] as Method[])('%s with a malformed child id answers 404, not 500', async method => {
    mocks.mutateWithRLS.mockImplementation(async (sql: string) => {
      if (sql.includes('"pets_visits"')) throw badUuid()
      return { rows: [], rowCount: 0 }
    })
    await expectCleanRejection(await call(method, { childId: 'not-a-uuid' }), { status: 404 })
  })

  test('any other database failure is still a 500', async () => {
    mocks.mutateWithRLS.mockRejectedValue(Object.assign(new Error('deadlock detected'), { code: '40P01' }))
    expect((await call('DELETE')).status).toBe(500)
  })
})

describe('the server error body', () => {
  test('does not repeat internal error text when the data layer fails', async () => {
    mocks.mutateWithRLS.mockRejectedValue(new Error('connection to server at "10.0.0.5", port 5432 failed'))
    const response = await call('POST')
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5')
  })
})

describe('access, as the entity handler on the parent record', () => {
  const METHODS: Method[] = ['GET', 'POST', 'PUT', 'DELETE']
  const SCOPE: Record<Method, string> = { GET: 'pets:read', POST: 'pets:write', PUT: 'pets:write', DELETE: 'pets:write' }
  const PERMISSION: Record<Method, string> = { GET: 'pets.read', POST: 'pets.update', PUT: 'pets.update', DELETE: 'pets.update' }

  describe.each(METHODS)('%s', method => {
    test('an anonymous caller gets 401 and no statement is sent', async () => {
      mocks.authenticateRequest.mockResolvedValue({ success: false, type: 'none', user: null })
      await expectCleanRejection(await call(method), { status: 401 })
      noStatements()
    })

    test(`asks for the parent's ${SCOPE[method]} scope`, async () => {
      await call(method)
      expect(mocks.authenticateRequest).toHaveBeenCalledWith(expect.anything(), { requiredScope: SCOPE[method] })
    })

    test('an API key without that scope gets 403 and no statement is sent', async () => {
      apiKeyCaller(['pets:read', 'pets:write'].filter(scope => scope !== SCOPE[method]))
      await expectCleanRejection(await call(method), { status: 403, code: 'INSUFFICIENT_SCOPE' })
      noStatements()
    })

    test('an API key with the scope is served as its owner', async () => {
      apiKeyCaller([SCOPE[method]])
      expect((await call(method)).status).toBe(200)
      for (const [, , userId] of dataStatements()) expect(userId).toBe('key-owner-1')
    })

    test(`a session without ${PERMISSION[method]} in the team gets 403 and nothing is read or written`, async () => {
      mocks.checkPermission.mockImplementation(async (_user: string, _team: string, permission: string) => permission !== PERMISSION[method])
      await expectCleanRejection(await call(method), { status: 403, code: 'PERMISSION_DENIED' })
      expect(mocks.checkPermission).toHaveBeenCalledWith(USER, 'team-1', PERMISSION[method])
      expect(dataStatements()).toEqual([])
    })

    test('a caller who is not a member of the team in x-team-id gets 403', async () => {
      routeQueryOneWithRLS(null, false)
      await expectCleanRejection(await call(method, { headers: { 'x-team-id': 'team-b' } }), { status: 403, code: 'TEAM_ACCESS_DENIED' })
      expect(dataStatements()).toEqual([])
    })

    test("another team's parent (not visible to the caller) gets 404 and no child row is read or written", async () => {
      mocks.queryWithRLS.mockImplementation(async (sql: string) => (sql.includes('FROM "pets" t') ? [] : [{ id: CHILD_ID, note: 'team B secret' }]))
      const response = await call(method)
      const body = await expectCleanRejection(response, { status: 404 })
      expect(JSON.stringify(body)).not.toContain('team B secret')
      expect(childStatements()).toEqual([])
      // the parent lookup is scoped to the caller's team and, for a non-shared entity, to its owner
      const [[sql, values, userId]] = dataStatements()
      expect(sql).toContain('t.id = $1 AND t."teamId" = $2 AND t."userId" = $3')
      expect(values).toEqual([PARENT_ID, 'team-1', USER])
      expect(userId).toBe(USER)
    })

    test('the owner is served, and every statement runs as the caller (never as system)', async () => {
      const response = await call(method)
      expect(response.status).toBe(200)
      expect(childStatements().length).toBe(1)
      for (const [, , userId] of dataStatements()) expect(userId).toBe(USER)
    })
  })

  test('the owner lists the children of the parent', async () => {
    const response = await call('GET')
    expect((await response.json()).data).toEqual([{ id: CHILD_ID, note: 'ok' }])
    const [[sql, values]] = childStatements()
    expect(sql).toMatch(/SELECT \* FROM "pets_visits" WHERE "parentId" = \$1/)
    expect(values).toEqual([PARENT_ID])
  })

  test('a team admin with the bypass reads without the role check, still through the parent lookup', async () => {
    mocks.canBypassTeamContext.mockResolvedValue(true)
    mocks.checkPermission.mockResolvedValue(false)
    expect((await call('GET')).status).toBe(200)
    expect(mocks.checkPermission).not.toHaveBeenCalled()
  })

  test('a write needs a team context even with the bypass', async () => {
    mocks.canBypassTeamContext.mockResolvedValue(true)
    await expectCleanRejection(await call('POST', { headers: {} }), { status: 400, code: 'TEAM_CONTEXT_REQUIRED' })
    expect(dataStatements()).toEqual([])
  })
})

describe('bound parameters', () => {
  const HOSTILE = `x'); DELETE FROM "pets"; --`

  test('POST: no body value or id is written into the statement text; they are in the parameters', async () => {
    const response = await call('POST', { body: json({ note: HOSTILE, weight: 7 }) })
    expect(response.status).toBe(200)
    const [[sql, values, userId]] = childWrites()
    expect(sql).not.toContain(HOSTILE)
    expect(sql).not.toContain(PARENT_ID)
    expect(sql).toMatch(/INSERT INTO "pets_visits" \(id, "parentId", "note", "weight", "createdAt", "updatedAt"\)\s+VALUES \(\$1, \$2, \$3, \$4, NOW\(\), NOW\(\)\)/)
    expect(values).toEqual([expect.any(String), PARENT_ID, HOSTILE, 7])
    expect(userId).toBe(USER)
  })

  test('PUT: the child id, parent id and values are parameters', async () => {
    await call('PUT', { body: json({ note: HOSTILE }) })
    const [[sql, values]] = childWrites()
    expect(sql).not.toContain(HOSTILE)
    expect(sql).not.toContain(CHILD_ID)
    expect(values).toEqual([CHILD_ID, PARENT_ID, HOSTILE])
  })

  test('DELETE and GET: the ids are parameters', async () => {
    await call('DELETE')
    await call('GET', { parentId: `${PARENT_ID}' OR '1'='1` })
    for (const [sql] of dataStatements()) {
      expect(sql).not.toContain(CHILD_ID)
      expect(sql).not.toContain(PARENT_ID)
    }
    expect(childWrites()[0][1]).toEqual([CHILD_ID, PARENT_ID])
  })
})
