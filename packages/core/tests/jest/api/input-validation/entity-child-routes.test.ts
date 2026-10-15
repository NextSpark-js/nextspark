/**
 * S192 — input validation of the child-entity routes
 *   /api/v1/[entity]/[id]/child/[childType]            (GET, POST)
 *   /api/v1/[entity]/[id]/child/[childType]/[childId]  (PUT, DELETE)
 *
 * Malformed bodies and ids that are not UUIDs must come back 4xx with a stable code, nothing internal in the
 * body, and no statement sent to the data layer. Today these routes read the body unguarded and build their
 * statements from the body, so the body cases are `test.failing` (S192 findings F5-F6).
 */

import { NextRequest } from 'next/server'
import { expectCleanRejection, jsonReaderFor, MALFORMED_BODIES, type BodyKind } from './__helpers__/clean-rejection'

const mockQueryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args) }))

const mockResolve = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/entity/resolver', () => ({ resolveEntityFromUrl: (...args: unknown[]) => mockResolve(...args) }))

const CHILD_CONFIG = {
  slug: 'pet-visits',
  fields: [
    { name: 'note', type: 'text' },
    { name: 'weight', type: 'number' },
    { name: 'tags', type: 'multiselect' },
  ],
}
const mockGetChildEntities = jest.fn()
jest.mock('@nextsparkjs/core/lib/entities/queries', () => ({
  getChildEntities: (...args: unknown[]) => mockGetChildEntities(...args),
  getEntity: (name: string) => (name === 'visits' ? CHILD_CONFIG : undefined),
  setEntityRegistry: jest.fn(),
}))

// the rate-limit wrapper is not the subject: pass the handler through
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/cors-response', () => ({ corsPreflight: jest.fn() }))
jest.mock('@nextsparkjs/registries/entity-registry', () => ({ ENTITY_REGISTRY: {}, ENTITY_METADATA: {} }), { virtual: true })

import { GET, POST } from '@/app/api/v1/[entity]/[id]/child/[childType]/route'
import { PUT, DELETE } from '@/app/api/v1/[entity]/[id]/child/[childType]/[childId]/route'

const PARENT_ID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
const CHILD_ID = '9a1c7e22-0b3d-4f6a-8e55-1d2c3b4a5f60'

const parent = (id: string, childId?: string) => ({ params: Promise.resolve({ entity: 'pets', id, childType: 'visits', childId: childId ?? CHILD_ID }) })

function req(method: string, path: string, body?: BodyKind): NextRequest {
  const request = new NextRequest(`http://localhost${path}`, { method })
  if (body) (request as unknown as { json: () => Promise<unknown> }).json = jsonReaderFor(body)
  return request
}

type Res = { status: number; body: Record<string, unknown>; json(): Promise<Record<string, unknown>> }

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  mockResolve.mockResolvedValue({ isValidEntity: true, entityConfig: { slug: 'pets' }, entityName: 'pets' })
  mockGetChildEntities.mockReturnValue([{ name: 'visits', tableName: 'pet_visits' }])
  mockQueryWithRLS.mockImplementation(async () => [{ id: CHILD_ID }])
})

describe('child routes — requests the routes already refuse', () => {
  test('an unknown child type is answered 404 and sends no statement', async () => {
    mockGetChildEntities.mockReturnValue([])
    const response = await GET(req('GET', `/api/v1/pets/${PARENT_ID}/child/visits`), parent(PARENT_ID)) as unknown as Res
    expect(response.status).toBe(404)
    expect(mockQueryWithRLS).not.toHaveBeenCalled()
  })

  test('an entity that is not registered is answered 404 and sends no statement', async () => {
    mockResolve.mockResolvedValue({ isValidEntity: false })
    const response = await POST(req('POST', `/api/v1/nope/${PARENT_ID}/child/visits`, { kind: 'json', value: {} }), parent(PARENT_ID)) as unknown as Res
    expect(response.status).toBe(404)
    expect(mockQueryWithRLS).not.toHaveBeenCalled()
  })
})

describe('POST child — malformed bodies', () => {
  describe.each(MALFORMED_BODIES)('%s', (_label, body) => {
    test.failing('is rejected with 400 and no statement is sent', async () => {
      const response = await POST(req('POST', `/api/v1/pets/${PARENT_ID}/child/visits`, body), parent(PARENT_ID)) as unknown as Res
      await expectCleanRejection(response, { status: 400 })
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })
  })

  test.failing.each([
    ['a text field given an object', { note: { a: 1 } }],
    ['a number field given non-numeric text', { weight: 'heavy' }],
    ['a field the child entity does not declare', { colour: 'brown' }],
    ['a text field far over a sane length', { note: 'x'.repeat(2_000_000) }],
  ])('rejects %s with 400 and sends no statement', async (_label, value) => {
    const response = await POST(req('POST', `/api/v1/pets/${PARENT_ID}/child/visits`, { kind: 'json', value }), parent(PARENT_ID)) as unknown as Res
    await expectCleanRejection(response, { status: 400, code: 'VALIDATION_ERROR' })
    expect(mockQueryWithRLS).not.toHaveBeenCalled()
  })
})

describe('PUT child — malformed bodies', () => {
  describe.each(MALFORMED_BODIES)('%s', (_label, body) => {
    test.failing('is rejected with 400 and no statement is sent', async () => {
      const response = await PUT(req('PUT', `/api/v1/pets/${PARENT_ID}/child/visits/${CHILD_ID}`, body), parent(PARENT_ID)) as unknown as Res
      await expectCleanRejection(response, { status: 400 })
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })
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
      mockQueryWithRLS.mockResolvedValue([])
      const response = await PUT(req('PUT', `/api/v1/pets/${PARENT_ID}/child/visits/${unknownId}`, { kind: 'json', value: { note: 'ok' } }), parent(PARENT_ID, unknownId)) as unknown as Res
      expect(response.status).toBe(404)
    })

    test('DELETE answers 404 for a child that does not exist', async () => {
      mockQueryWithRLS.mockResolvedValue([])
      const response = await DELETE(req('DELETE', `/api/v1/pets/${PARENT_ID}/child/visits/${unknownId}`), parent(PARENT_ID, unknownId)) as unknown as Res
      expect(response.status).toBe(404)
    })

    // The parent is not looked up. The insert runs against a parent that is not there and the foreign key refuses it,
    // which surfaces as a 500 that repeats the database message (finding F6).
    test.failing('POST for a parent that does not exist answers 4xx with no database text', async () => {
      mockQueryWithRLS.mockRejectedValue(Object.assign(new Error('insert or update on table "pet_visits" violates foreign key constraint "pet_visits_parentId_fkey"'), { code: '23503' }))
      const response = await POST(req('POST', `/api/v1/pets/${unknownId}/child/visits`, { kind: 'json', value: { note: 'ok' } }), parent(unknownId)) as unknown as Res
      await expectCleanRejection(response, { status: 404 })
    })
  })
})

describe('the server error body', () => {
  test.failing('does not repeat internal error text when the data layer fails', async () => {
    mockQueryWithRLS.mockRejectedValue(new Error('connection to server at "10.0.0.5", port 5432 failed'))
    const response = await POST(req('POST', `/api/v1/pets/${PARENT_ID}/child/visits`, { kind: 'json', value: { note: 'ok' } }), parent(PARENT_ID)) as unknown as Res
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5')
  })
})
