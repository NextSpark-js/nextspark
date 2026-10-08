/**
 * Moving a record into or out of `published` needs `<slug>.publish` when the entity declares that action (the
 * starter declares `posts.publish` for owner and admin only). Create with status published, and an update that
 * publishes or unpublishes, check it on top of `<slug>.create` / `<slug>.update`, for session and API-key auth.
 * Entities that do not declare `publish` keep their behaviour. `posts.publish` is declared in the permissions
 * registry mock; `pets` declares nothing.
 */

import { harness, makeRequest, SESSION_AUTH, API_KEY_AUTH, type MockResponse } from './__helpers__/generic-handler-harness'
import { handleGenericCreate, handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness
const TEAM_HEADERS = { 'x-team-id': 'team-1' }

const POSTS_ENTITY = {
  slug: 'posts',
  tableName: 'posts',
  fields: [
    { name: 'title', type: 'text', api: { readOnly: false } },
    { name: 'status', type: 'select', api: { readOnly: false } },
  ],
  access: { api: true },
} as unknown as EntityConfig

/** member: create/update but not publish; admin: all three. */
function grantAs(role: 'member' | 'admin') {
  mocks.checkPermission.mockImplementation(async (_userId: string, _teamId: string, permission: string) =>
    role === 'admin' || permission !== 'posts.publish')
}

function storedStatus(status: string | null) {
  mocks.queryWithRLS.mockImplementation(async (sql: string) =>
    sql.startsWith('SELECT "status" FROM "posts"') ? (status === null ? [] : [{ status }]) : [])
}

const create = (body: Record<string, unknown>) =>
  handleGenericCreate(makeRequest({ method: 'POST', url: 'http://localhost/api/v1/posts', headers: TEAM_HEADERS, body })) as unknown as Promise<MockResponse>

const patch = (body: Record<string, unknown>) =>
  handleGenericUpdate(
    makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/posts/post-1', headers: TEAM_HEADERS, body }),
    { params: Promise.resolve({ entity: 'posts', id: 'post-1' }) }
  ) as unknown as Promise<MockResponse>

const writes = () => mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => /INSERT INTO "posts"|UPDATE "posts"/.test(sql))

beforeEach(() => {
  harness.reset()
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: POSTS_ENTITY, entityName: 'posts' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'post-1', title: 't', status: 'draft' }] })
})

describe('create', () => {
  it('a member creating a published post gets 403 and nothing is written', async () => {
    grantAs('member')
    const response = await create({ title: 't', status: 'published' })
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('PERMISSION_DENIED')
    expect(mocks.checkPermission).toHaveBeenCalledWith('session-user-1', 'team-1', 'posts.publish')
    expect(writes()).toHaveLength(0)
  })

  it('a member can still create a draft (no publish check)', async () => {
    grantAs('member')
    const response = await create({ title: 't', status: 'draft' })
    expect(response.status).toBe(201)
    expect(mocks.checkPermission).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'posts.publish')
  })

  it('an admin creates a published post', async () => {
    grantAs('admin')
    expect((await create({ title: 't', status: 'published' })).status).toBe(201)
  })

  it('an API key whose owner lacks posts.publish gets 403', async () => {
    grantAs('member')
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['posts:write']))
    const response = await create({ title: 't', status: 'published' })
    expect(response.status).toBe(403)
    expect(mocks.checkPermission).toHaveBeenCalledWith('key-owner-1', 'team-1', 'posts.publish')
  })

  it('an entity that does not declare publish is unaffected', async () => {
    grantAs('member')
    mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: { ...POSTS_ENTITY, slug: 'pets', tableName: 'pets' }, entityName: 'pets' })
    expect((await create({ title: 't', status: 'published' })).status).toBe(201)
  })
})

describe('update', () => {
  it('a member publishing a draft gets 403', async () => {
    grantAs('member'); storedStatus('draft')
    const response = await patch({ status: 'published' })
    expect(response.status).toBe(403)
    expect(writes()).toHaveLength(0)
  })

  it('a member unpublishing a published post gets 403', async () => {
    grantAs('member'); storedStatus('published')
    const response = await patch({ status: 'draft' })
    expect(response.status).toBe(403)
    expect(writes()).toHaveLength(0)
  })

  it('a member editing a published post without changing its status is allowed', async () => {
    grantAs('member'); storedStatus('published')
    expect((await patch({ title: 'typo fixed' })).status).toBe(200)
    expect((await patch({ title: 'again', status: 'published' })).status).toBe(200)
    expect(mocks.checkPermission).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'posts.publish')
  })

  it('an admin publishes and unpublishes', async () => {
    grantAs('admin'); storedStatus('draft')
    expect((await patch({ status: 'published' })).status).toBe(200)
    storedStatus('published')
    expect((await patch({ status: 'draft' })).status).toBe(200)
  })

  it('another team\'s id is not found by the status read, so the answer stays the UPDATE\'s 404', async () => {
    grantAs('member'); storedStatus(null)
    mocks.mutateWithRLS.mockResolvedValue({ rows: [] })
    expect((await patch({ status: 'published' })).status).toBe(404)
  })
})

describe('status default on create', () => {
  const withDefault = (defaultValue?: string) => ({
    ...POSTS_ENTITY,
    fields: [POSTS_ENTITY.fields[0], { ...POSTS_ENTITY.fields[1], ...(defaultValue === undefined ? {} : { defaultValue }) }],
  })

  it('a configured default of published counts as publishing', async () => {
    grantAs('member')
    mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: withDefault('published'), entityName: 'posts' })
    expect((await create({ title: 't' })).status).toBe(403)
    expect(writes()).toHaveLength(0)
  })

  describe('without a configured default, the INSERT and the stored-status check share one transaction', () => {
    const billing = jest.requireMock('@nextsparkjs/registries/billing-registry').BILLING_REGISTRY
    const subscriptions = jest.requireMock('@/core/lib/services/subscription.service').SubscriptionService
    beforeEach(() => {
      mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: withDefault(), entityName: 'posts' })
      // The database's own default makes the row published
      mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'post-1', title: 't', status: 'published' }], rowCount: 1 })
      mocks.queryWithRLS.mockResolvedValue([{ id: 'post-1', title: 't', status: 'published' }])
      billing.actionMappings.limits['posts.create'] = 'posts'
      subscriptions.canPerformAction.mockResolvedValue({ allowed: true })
    })
    afterEach(() => { delete billing.actionMappings.limits['posts.create'] })

    it('a member: rolled back (no DELETE, nothing committed), 403, and no usage counted', async () => {
      grantAs('member')
      const response = await create({ title: 't' })
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('PERMISSION_DENIED')
      expect(mocks.txRollback).toHaveBeenCalledTimes(1)
      expect(mocks.txCommit).not.toHaveBeenCalled()
      expect(mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.startsWith('DELETE'))).toHaveLength(0)
      expect(mocks.usageTrack).not.toHaveBeenCalled()
    })

    it('an admin: committed, 201, and the usage is counted after the check', async () => {
      grantAs('admin')
      expect((await create({ title: 't' })).status).toBe(201)
      expect(mocks.txCommit).toHaveBeenCalledTimes(1)
      expect(mocks.txRollback).not.toHaveBeenCalled()
      expect(mocks.usageTrack).toHaveBeenCalledTimes(1)
    })

    it('a row the default made a draft is committed for a member, without a publish check', async () => {
      grantAs('member')
      mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'post-1', title: 't', status: 'draft' }], rowCount: 1 })
      expect((await create({ title: 't' })).status).toBe(201)
      expect(mocks.txCommit).toHaveBeenCalledTimes(1)
      expect(mocks.checkPermission).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'posts.publish')
    })
  })
})

describe('the UPDATE carries the status it was checked against', () => {
  it('adds the status read to the WHERE, even when the status does not change', async () => {
    grantAs('member'); storedStatus('draft')
    expect((await patch({ status: 'draft' })).status).toBe(200)
    const [[sql, params]] = writes() as Array<[string, unknown[]]>
    expect(sql).toMatch(/"status" IS NOT DISTINCT FROM \$\d+/)
    expect(params).toContain('draft')
  })

  it('answers 409 STATUS_CHANGED when an admin published the row in between', async () => {
    grantAs('member')
    let reads = 0
    mocks.queryWithRLS.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT "status" FROM "posts"') ? [{ status: reads++ === 0 ? 'draft' : 'published' }] : [])
    mocks.mutateWithRLS.mockResolvedValue({ rows: [] })
    const response = await patch({ status: 'draft' })
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('STATUS_CHANGED')
  })
})

