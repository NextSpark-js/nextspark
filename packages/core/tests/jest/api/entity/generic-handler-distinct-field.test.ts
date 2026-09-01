/**
 * Regression coverage for #96: `GET /api/v1/{entity}?fields=X&distinct=true`
 * interpolated the raw `fields` query value as a SQL identifier without
 * validating it against `entityConfig.fields`, unlike the sibling
 * (non-distinct) `?fields=` branch. Any caller with `<slug>:read` could inject
 * arbitrary SQL into the SELECT list.
 *
 * These tests drive real requests through `handleGenericList` and assert on
 * the SQL that reaches the DB layer.
 */

import { harness, makeRequest, listUrl, SESSION_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericList } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

const TEAM_HEADERS = { 'x-team-id': 'team-1' }

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
})

describe('handleGenericList — #96 distinct field name is validated against entityConfig.fields', () => {
  it('rejects a crafted identifier with 400 INVALID_FIELD and never reaches the database', async () => {
    // Closes the quoted identifier and appends a subquery into the SELECT list.
    const payload = `name", (SELECT string_agg(email, ',') FROM "users") AS "pwned`

    const request = makeRequest({ url: listUrl({ fields: payload, distinct: 'true' }), headers: TEAM_HEADERS })
    const response = await handleGenericList(request) as unknown as { status: number; body: { code?: string; error?: string } }

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_FIELD')
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  it('rejects an unknown (but harmless-looking) field name with 400 rather than querying it', async () => {
    const request = makeRequest({ url: listUrl({ fields: 'secretColumn', distinct: 'true' }), headers: TEAM_HEADERS })
    const response = await handleGenericList(request) as unknown as { status: number; body: { code?: string } }

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_FIELD')
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  it('still serves distinct values for a real entity field', async () => {
    mocks.queryWithRLS.mockResolvedValue([{ value: 'draft', label: 'draft', entityType: 'pets' }])

    const request = makeRequest({ url: listUrl({ fields: 'status', distinct: 'true' }), headers: TEAM_HEADERS })
    const response = await handleGenericList(request) as unknown as { status: number }

    expect(response.status).toBe(200)
    const [sql] = mocks.queryWithRLS.mock.calls[0] as [string]
    expect(sql).toContain('DISTINCT "status" as value')
    expect(sql).toContain('ORDER BY "status" ASC')
  })

  it('guards the JSONB (tags) distinct path with the same validation', async () => {
    // `hashtags` IS a field of PETS_ENTITY → JSONB branch runs
    const okRequest = makeRequest({ url: listUrl({ fields: 'hashtags', distinct: 'true' }), headers: TEAM_HEADERS })
    const okResponse = await handleGenericList(okRequest) as unknown as { status: number }
    expect(okResponse.status).toBe(200)
    const [sql] = mocks.queryWithRLS.mock.calls[0] as [string]
    expect(sql).toContain('jsonb_array_elements_text("hashtags")')

    // Same request against an entity WITHOUT a `hashtags` field → rejected,
    // even though the name matches the hard-coded JSONB allow-list.
    mocks.queryWithRLS.mockClear()
    const noTagsEntity = {
      ...PETS_ENTITY,
      fields: PETS_ENTITY.fields.filter(f => f.name !== 'hashtags'),
    } as EntityConfig
    mocks.resolveEntityFromUrl.mockResolvedValue({
      isValidEntity: true, entityConfig: noTagsEntity, entityName: 'pets', hasCustomOverride: false,
    })
    const badRequest = makeRequest({ url: listUrl({ fields: 'hashtags', distinct: 'true' }), headers: TEAM_HEADERS })
    const badResponse = await handleGenericList(badRequest) as unknown as { status: number; body: { code?: string } }
    expect(badResponse.status).toBe(400)
    expect(badResponse.body.code).toBe('INVALID_FIELD')
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  it('regression: the sibling non-distinct ?fields= branch keeps stripping unknown names', async () => {
    const request = makeRequest({ url: listUrl({ fields: 'name,bogus' }), headers: TEAM_HEADERS })
    const response = await handleGenericList(request) as unknown as { status: number }

    expect(response.status).toBe(200)
    const [sql] = mocks.queryWithRLS.mock.calls[0] as [string]
    expect(sql).toContain('t.name')
    expect(sql).not.toContain('bogus')
  })
})
