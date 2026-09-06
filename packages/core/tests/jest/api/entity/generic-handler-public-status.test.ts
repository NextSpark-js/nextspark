/**
 * Regression coverage for #171: an unauthenticated request to a public
 * entity (`access.public: true`) leaked rows in every status — including
 * `draft` — because the userId ownership filter only ever applied
 * `if (userId && ...)`, and `userId` is always `null` for anonymous access.
 * The `status=published` the docs/comments assumed the caller would send was
 * never actually enforced server-side, so a client could omit it (or send
 * `status=draft`) and see everything, across every user and team.
 */

import { harness, makeRequest, listUrl, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericList, handleGenericRead } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

const PUBLIC_PAGES_ENTITY: EntityConfig = {
  ...PETS_ENTITY,
  slug: 'pages',
  tableName: 'pages',
  fields: [
    { name: 'title', type: 'text', api: { readOnly: false } } as never,
    { name: 'status', type: 'select', api: { readOnly: false } } as never,
  ],
  access: { api: true, public: true, shared: true },
} as unknown as EntityConfig

const ANONYMOUS = { success: false, type: 'none', user: null }

function useEntity(entity: EntityConfig) {
  mocks.resolveEntityFromUrl.mockResolvedValue({
    isValidEntity: true, entityConfig: entity, entityName: entity.slug, hasCustomOverride: false,
  })
}

function listSql(): [string, unknown[]] {
  const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pages"'))
  expect(call).toBeDefined()
  return call as [string, unknown[]]
}

beforeEach(() => {
  harness.reset()
  useEntity(PUBLIC_PAGES_ENTITY)
  mocks.authenticateRequest.mockResolvedValue(ANONYMOUS)
})

describe('handleGenericList — #171 forces published-only for anonymous public access', () => {
  it('adds status = published even when the caller sends no status filter at all', async () => {
    const response = await handleGenericList(makeRequest({ url: listUrl({}, 'pages') })) as unknown as { status: number }

    expect(response.status).toBe(200)
    const [sql] = listSql()
    expect(sql).toContain(`t."status" = 'published'`)
  })

  it('still adds the forced constraint when the caller explicitly asks for status=draft (fails closed, 0 rows)', async () => {
    const response = await handleGenericList(
      makeRequest({ url: listUrl({ status: 'draft' }, 'pages') })
    ) as unknown as { status: number }

    expect(response.status).toBe(200)
    const [sql] = listSql()
    // Both conditions land in the query; Postgres can never satisfy both, so
    // this returns 0 rows rather than leaking drafts — a caller can't launder
    // draft access through the same filter that's supposed to request it.
    expect(sql).toContain(`"status" = $`)
    expect(sql).toContain(`t."status" = 'published'`)
  })

  it('does NOT force the constraint for an authenticated request (normal team-scoped access)', async () => {
    mocks.authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'user-1', email: 'u@test.com', role: 'user' } })

    const response = await handleGenericList(
      makeRequest({ url: listUrl({}, 'pages'), headers: { 'x-team-id': 'team-1' } })
    ) as unknown as { status: number }

    expect(response.status).toBe(200)
    const [sql] = listSql()
    expect(sql).not.toContain(`t."status" = 'published'`)
  })

  it('does NOT force the constraint on a non-public entity (no access.public)', async () => {
    useEntity(PETS_ENTITY)
    mocks.authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'user-1', email: 'u@test.com', role: 'user' } })

    const response = await handleGenericList(
      makeRequest({ url: listUrl({}, 'pets'), headers: { 'x-team-id': 'team-1' } })
    ) as unknown as { status: number }

    expect(response.status).toBe(200)
    const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"'))
    expect(call?.[0]).not.toContain(`"status" = 'published'`)
  })
})

describe('handleGenericRead — #171 forces published-only for anonymous public access', () => {
  const idParams = { params: Promise.resolve({ entity: 'pages', id: 'draft-page-1' }) }

  it('adds status = published to a direct by-id read', async () => {
    mocks.queryWithRLS.mockResolvedValue([{ id: 'draft-page-1', title: 'Secret Draft', status: 'draft' }])

    await handleGenericRead(makeRequest({ url: 'http://localhost/api/v1/pages/draft-page-1' }), idParams)

    const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pages"'))
    expect(call).toBeDefined()
    expect(call?.[0]).toContain(`t."status" = 'published'`)
  })

  it('does NOT force the constraint for an authenticated request', async () => {
    mocks.authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'user-1', email: 'u@test.com', role: 'user' } })
    mocks.queryWithRLS.mockResolvedValue([{ id: 'draft-page-1', title: 'Secret Draft', status: 'draft' }])

    await handleGenericRead(
      makeRequest({ url: 'http://localhost/api/v1/pages/draft-page-1', headers: { 'x-team-id': 'team-1' } }),
      idParams
    )

    const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pages"'))
    expect(call?.[0]).not.toContain(`t."status" = 'published'`)
  })
})
