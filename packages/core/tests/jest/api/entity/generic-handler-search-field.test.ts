/**
 * #249: `GET /api/v1/{entity}?search=…&searchField=…`. A relation select asks for its titleField (the label a person
 * types) next to the default search fields (name, title, slug, content). The field name is compared with an allowlist
 * built from the entity's own config before it is written into SQL; a name outside it is a 400, never a query.
 */

import { harness, makeRequest, listUrl, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericList, searchFieldAllowlist } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

type Res = { status: number; body: { code?: string; error?: string; details?: { allowedKeys?: string[]; invalidKeys?: string[] } } }
const TEAM_HEADERS = { 'x-team-id': 'team-1' }

const field = (name: string, type: string, api: Record<string, unknown> = { readOnly: false }) => ({ name, type, api }) as never

/** A contacts-like entity: its visible label is `callName`, not one of name/title/slug/content. */
const CONTACTS = {
  slug: 'contacts',
  tableName: 'contacts',
  access: { api: true },
  fields: [
    field('callName', 'text'),
    field('slug', 'text'),
    field('content', 'textarea'),
    field('email', 'email'),
    field('status', 'select'),
    field('age', 'number'),
    field('joinedAt', 'datetime'),
    field('internalNote', 'text', { readOnly: false, searchable: false }),
  ],
} as unknown as EntityConfig

function use(entity: EntityConfig) {
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: entity, entityName: entity.slug })
}
const list = (params: Record<string, string>) =>
  handleGenericList(makeRequest({ url: listUrl(params, 'contacts'), headers: TEAM_HEADERS })) as unknown as Promise<Res>
const listSql = (): [string, unknown[]] => {
  const call = mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "contacts"'))
  expect(call).toBeDefined()
  return call as [string, unknown[]]
}

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  use(CONTACTS)
})

describe('searchFieldAllowlist', () => {
  it('is the entity\'s text fields that are not marked unsearchable, and the default search fields it declares', () => {
    expect(searchFieldAllowlist(CONTACTS)).toEqual(['callName', 'slug', 'content', 'email'])
  })
})

describe('handleGenericList — ?searchField=', () => {
  it('searches the field next to the default ones, so a hit on slug or content is still returned', async () => {
    const response = await list({ search: 'ana', searchField: 'callName' })

    expect(response.status).toBe(200)
    const [sql, params] = listSql()
    expect(sql).toContain('(t."slug" ILIKE $')
    expect(sql).toContain('t."content" ILIKE $')
    expect(sql).toContain('t."callName" ILIKE $')
    expect(params).toContain('%ana%')
  })

  it('does not search a field the caller did not name, and searches the default ones alone without searchField', async () => {
    await list({ search: 'ana' })

    const [sql] = listSql()
    expect(sql).not.toContain('"callName" ILIKE')
    expect(sql).not.toContain('"email" ILIKE')
  })

  it.each([
    ['a field the entity does not have', 'secretColumn'],
    ['a select field', 'status'],
    ['a number field', 'age'],
    ['a datetime field', 'joinedAt'],
    ['a field marked api.searchable: false', 'internalNote'],
    ['a base column', 'teamId'],
    ['a crafted identifier', `callName", (SELECT string_agg(email, ',') FROM "users") AS "pwned`],
  ])('refuses %s with 400 INVALID_SEARCH_FIELD and never queries', async (_label, searchField) => {
    const response = await list({ search: 'ana', searchField })

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_SEARCH_FIELD')
    expect(response.body.details?.invalidKeys).toEqual([searchField])
    expect(response.body.details?.allowedKeys).toEqual(['callName', 'slug', 'content', 'email'])
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  it('refuses a field outside the allowlist even without a search term', async () => {
    const response = await list({ searchField: 'status' })

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_SEARCH_FIELD')
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })

  it('without a search term the field adds no condition', async () => {
    const response = await list({ searchField: 'callName' })

    expect(response.status).toBe(200)
    expect(listSql()[0]).not.toContain('ILIKE')
  })

  it('an entity with none of the default search fields can be searched by the field it names', async () => {
    use({ ...CONTACTS, fields: [field('callName', 'text')] } as unknown as EntityConfig)

    const searched = await list({ search: 'ana', searchField: 'callName' })
    expect(searched.status).toBe(200)
    expect(listSql()[0]).toContain('t."callName" ILIKE $')

    mocks.queryWithRLS.mockClear()
    const plain = await list({ search: 'ana' })
    expect(plain.status).toBe(400)
    expect(plain.body.code).toBe('SEARCH_NOT_SUPPORTED')
  })
})
