/**
 * A record links only taxonomies of its own team, or without a team: the relation INSERT selects the taxonomy by
 * id, type and team, so the id of another team's category links nothing.
 */

import { harness, makeRequest, SESSION_AUTH, type MockResponse } from './__helpers__/generic-handler-harness'
import { handleGenericCreate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

const POSTS_ENTITY = {
  slug: 'posts',
  tableName: 'posts',
  fields: [{ name: 'title', type: 'text', api: { readOnly: false } }],
  taxonomies: { enabled: true, types: [{ type: 'post_category', field: 'categories' }] },
  access: { api: true },
} as unknown as EntityConfig

beforeEach(() => {
  harness.reset()
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: POSTS_ENTITY, entityName: 'posts' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'post-1', title: 't' }] })
  mocks.queryWithRLS.mockResolvedValue([{ id: 'post-1', title: 't' }])
})

it('links categories through a SELECT bound to the record\'s team', async () => {
  const response = await handleGenericCreate(makeRequest({
    method: 'POST',
    url: 'http://localhost/api/v1/posts',
    headers: { 'x-team-id': 'team-1' },
    body: { title: 't', categories: ['cat-own', 'cat-other-team'] },
  })) as unknown as MockResponse
  expect(response.status).toBe(201)
  const links = mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO entity_taxonomy_relations'))
  expect(links).toHaveLength(2)
  for (const [sql, params] of links) {
    expect(sql).toContain('("teamId" IS NULL OR "teamId" = $6)')
    expect(params[4]).toBe('post_category')
    expect(params[5]).toBe('team-1')
  }
})
