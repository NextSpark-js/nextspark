/**
 * Regression coverage for #97: silent / misleading failure modes in the
 * generic entity handlers. Each case previously returned a plausible-looking
 * 200 (or an opaque 500) instead of an error the caller could act on:
 *
 *   1. `search` on an entity with no searchable field was a silent no-op
 *   2. custom filters with an unknown key were silently dropped
 *   3. an invalid `sortBy` silently fell back to the default sort
 *   4. equality filters on date/datetime fields could never match
 *   6. CHECK-constraint violations (23514) surfaced as a bare 500
 *
 * (Case 5 — strict create/update schemas — lives in
 *  tests/jest/lib/entities/schema-generator-strict.test.ts.)
 */

import { harness, makeRequest, listUrl, SESSION_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericList, handleGenericCreate, handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

type Res = { status: number; body: { code?: string; error?: string; details?: unknown } }
const TEAM_HEADERS = { 'x-team-id': 'team-1' }

function useEntity(entity: EntityConfig) {
  mocks.resolveEntityFromUrl.mockResolvedValue({
    isValidEntity: true, entityConfig: entity, entityName: entity.slug, hasCustomOverride: false,
  })
}

function listSql(): [string, unknown[]] {
  const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"'))
  expect(call).toBeDefined()
  return call as [string, unknown[]]
}

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
})

describe('handleGenericList — #97 list parameter validation', () => {
  describe('search', () => {
    it('returns 400 SEARCH_NOT_SUPPORTED when the entity has none of name/title/slug/content', async () => {
      useEntity({
        ...PETS_ENTITY,
        fields: PETS_ENTITY.fields.filter(f => f.name !== 'name'),
      } as EntityConfig)

      const response = await handleGenericList(makeRequest({ url: listUrl({ search: 'rex' }), headers: TEAM_HEADERS })) as unknown as Res

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('SEARCH_NOT_SUPPORTED')
      expect(mocks.queryWithRLS).not.toHaveBeenCalled()
    })

    it('still applies search when a searchable field exists', async () => {
      const response = await handleGenericList(makeRequest({ url: listUrl({ search: 'rex' }), headers: TEAM_HEADERS })) as unknown as Res

      expect(response.status).toBe(200)
      const [sql, params] = listSql()
      expect(sql).toContain('t.name ILIKE $')
      expect(params).toContain('%rex%')
    })
  })

  describe('custom filters', () => {
    it('returns 400 INVALID_FILTER naming the unknown key(s) instead of silently dropping them', async () => {
      const response = await handleGenericList(
        makeRequest({ url: listUrl({ statuz: 'active', colour: 'brown', status: 'active' }), headers: TEAM_HEADERS })
      ) as unknown as Res

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('INVALID_FILTER')
      expect(response.body.error).toContain('statuz')
      expect(response.body.error).toContain('colour')
      expect(response.body.details).toEqual(expect.objectContaining({ invalidKeys: ['statuz', 'colour'] }))
      expect(mocks.queryWithRLS).not.toHaveBeenCalled()
    })

    it('keeps accepting known handler params that are not entity fields', async () => {
      const response = await handleGenericList(
        makeRequest({
          url: listUrl({ page: '2', limit: '5', sortBy: 'name', sortOrder: 'asc', metas: 'all', child: 'all', userFiltered: 'true', status: 'active' }),
          headers: TEAM_HEADERS,
        })
      ) as unknown as Res

      expect(response.status).toBe(200)
      const [sql, params] = listSql()
      expect(sql).toContain('t."status" = $')
      expect(params).toContain('active')
    })

    it('keeps accepting the legacy client params existing callers send (includeMeta, userId, sort, order)', async () => {
      // EntityApiClient.list sends includeMeta/userId; PublicEntityGrid sends sort/order.
      const response = await handleGenericList(
        makeRequest({
          url: listUrl({ includeMeta: 'true', userId: 'session-user-1', sort: 'name', order: 'asc' }),
          headers: TEAM_HEADERS,
        })
      ) as unknown as Res

      expect(response.status).toBe(200)
      const [sql] = listSql()
      // sort/order are honoured as aliases of sortBy/sortOrder
      expect(sql).toContain('ORDER BY t."name" ASC')
    })

    it('accepts taxonomy filter params only for taxonomy-enabled entities', async () => {
      // Not enabled → categoryId is just an unknown key
      const rejected = await handleGenericList(makeRequest({ url: listUrl({ categoryId: 'cat-1' }), headers: TEAM_HEADERS })) as unknown as Res
      expect(rejected.status).toBe(400)
      expect(rejected.body.code).toBe('INVALID_FILTER')

      // Enabled → routed to the taxonomy EXISTS filter
      useEntity({
        ...PETS_ENTITY,
        taxonomies: { enabled: true, types: [{ type: 'category', field: 'categories' }] },
      } as unknown as EntityConfig)
      const accepted = await handleGenericList(makeRequest({ url: listUrl({ categoryId: 'cat-1' }), headers: TEAM_HEADERS })) as unknown as Res
      expect(accepted.status).toBe(200)
      const [sql, params] = listSql()
      expect(sql).toContain('etr."taxonomyId" = $')
      expect(params).toContain('cat-1')
    })
  })

  describe('sortBy', () => {
    it('returns 400 INVALID_SORT_FIELD for a field that is neither an entity field nor a base column', async () => {
      const response = await handleGenericList(makeRequest({ url: listUrl({ sortBy: 'nope' }), headers: TEAM_HEADERS })) as unknown as Res

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('INVALID_SORT_FIELD')
      expect(response.body.error).toContain('nope')
      expect(mocks.queryWithRLS).not.toHaveBeenCalled()
    })

    it('sorts by a valid entity field or base column', async () => {
      await handleGenericList(makeRequest({ url: listUrl({ sortBy: 'name', sortOrder: 'asc' }), headers: TEAM_HEADERS }))
      expect(listSql()[0]).toContain('ORDER BY t."name" ASC')

      mocks.queryWithRLS.mockClear()
      await handleGenericList(makeRequest({ url: listUrl({ sortBy: 'updatedAt' }), headers: TEAM_HEADERS }))
      expect(listSql()[0]).toContain('ORDER BY t."updatedAt" DESC')
    })
  })

  describe('date / datetime equality filters', () => {
    it('expands a bare YYYY-MM-DD equality filter on a datetime field into a whole-day range', async () => {
      const response = await handleGenericList(
        makeRequest({ url: listUrl({ adoptedAt: '2026-01-15' }), headers: TEAM_HEADERS })
      ) as unknown as Res

      expect(response.status).toBe(200)
      const [sql, params] = listSql()
      // No bare equality against the timestamptz column
      expect(sql).not.toMatch(/t\."adoptedAt" = \$/)
      // Lower bound inclusive, upper bound exclusive (next day)
      expect(sql).toMatch(/t\."adoptedAt" >= \$\d+::date AND t\."adoptedAt" < \$\d+::date \+ 1/)
      expect(params.filter(p => p === '2026-01-15')).toHaveLength(2)
    })

    it('ORs multiple day values on the same datetime field', async () => {
      await handleGenericList(makeRequest({ url: listUrl({ adoptedAt: '2026-01-15,2026-01-16' }), headers: TEAM_HEADERS }))

      const [sql, params] = listSql()
      expect(sql.match(/t\."adoptedAt" >= \$\d+::date/g)).toHaveLength(2)
      expect(params).toEqual(expect.arrayContaining(['2026-01-15', '2026-01-16']))
    })

    it('keeps exact equality when the value carries a time component', async () => {
      await handleGenericList(makeRequest({ url: listUrl({ adoptedAt: '2026-01-15T10:30:00Z' }), headers: TEAM_HEADERS }))

      const [sql, params] = listSql()
      expect(sql).toMatch(/t\."adoptedAt" = \$/)
      expect(params).toContain('2026-01-15T10:30:00Z')
    })

    it('leaves non-date fields on plain equality', async () => {
      await handleGenericList(makeRequest({ url: listUrl({ status: '2026-01-15' }), headers: TEAM_HEADERS }))

      const [sql] = listSql()
      expect(sql).toMatch(/t\."status" = \$/)
      expect(sql).not.toContain('::date')
    })
  })
})

describe('handleGenericCreate / handleGenericUpdate — #97 CHECK constraint violations', () => {
  function pgError(code: string, extra: Record<string, unknown> = {}) {
    return Object.assign(new Error('db error'), { code, ...extra })
  }

  it('maps a 23514 on INSERT to 422 CHECK_CONSTRAINT_VIOLATION naming the constraint', async () => {
    mocks.mutateWithRLS.mockRejectedValue(pgError('23514', { constraint: 'pets_week_start_monday', table: 'pets' }))

    const response = await handleGenericCreate(makeRequest({
      method: 'POST', url: 'http://localhost/api/v1/pets', headers: TEAM_HEADERS, body: { name: 'Rex' },
    })) as unknown as Res

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('CHECK_CONSTRAINT_VIOLATION')
    expect(response.body.error).toContain('pets_week_start_monday')
    expect(response.body.details).toEqual(expect.objectContaining({ constraint: 'pets_week_start_monday' }))
  })

  it('maps a 23514 on UPDATE the same way', async () => {
    mocks.mutateWithRLS.mockRejectedValue(pgError('23514', { constraint: 'pets_status_check' }))

    const response = await handleGenericUpdate(
      makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/pets/pet-1', headers: TEAM_HEADERS, body: { status: 'bogus' } }),
      { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }
    ) as unknown as Res

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('CHECK_CONSTRAINT_VIOLATION')
    expect(response.body.details).toEqual(expect.objectContaining({ constraint: 'pets_status_check' }))
  })

  it('maps a 23503 on INSERT (dangling reference) to 422 FOREIGN_KEY_VIOLATION', async () => {
    mocks.mutateWithRLS.mockRejectedValue(pgError('23503', { constraint: 'pets_ownerId_fkey', detail: 'Key (ownerId)=(x) is not present in table "users".' }))

    const response = await handleGenericCreate(makeRequest({
      method: 'POST', url: 'http://localhost/api/v1/pets', headers: TEAM_HEADERS, body: { name: 'Rex', ownerId: 'x' },
    })) as unknown as Res

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('FOREIGN_KEY_VIOLATION')
    expect(response.body.details).toEqual(expect.objectContaining({ constraint: 'pets_ownerId_fkey' }))
  })

  it('regression: 23505 still maps to 409 UNIQUE_CONSTRAINT_VIOLATION and unknown errors stay 500', async () => {
    mocks.mutateWithRLS.mockRejectedValueOnce(pgError('23505', { constraint: 'pets_name_key' }))
    const conflict = await handleGenericCreate(makeRequest({
      method: 'POST', url: 'http://localhost/api/v1/pets', headers: TEAM_HEADERS, body: { name: 'Rex' },
    })) as unknown as Res
    expect(conflict.status).toBe(409)
    expect(conflict.body.code).toBe('UNIQUE_CONSTRAINT_VIOLATION')

    mocks.mutateWithRLS.mockRejectedValueOnce(new Error('connection reset'))
    const boom = await handleGenericCreate(makeRequest({
      method: 'POST', url: 'http://localhost/api/v1/pets', headers: TEAM_HEADERS, body: { name: 'Rex' },
    })) as unknown as Res
    expect(boom.status).toBe(500)
  })
})
