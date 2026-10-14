/**
 * #227: an entity slug may have an underscore. The generic handlers use the slug (not a hyphenated form of it)
 * for the API-key scope and the permission key, and the entity's `tableName` for the table.
 */

import { harness, makeRequest, SESSION_AUTH, API_KEY_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericCreate, handleGenericList } from '@/core/lib/api/entity/generic-handler'
import { resolveApiKeyScopeFailure } from '@/core/lib/api/auth/scope-policy'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

const TEAM_HEADERS = { 'x-team-id': 'team-1' }
const MEMBERS = {
  slug: 'campaign_members',
  tableName: 'members_table',
  access: { api: true },
  fields: [{ name: 'name', type: 'text', api: { readOnly: false } }],
} as unknown as EntityConfig

type Res = { status: number; body: { code?: string } }

beforeEach(() => {
  harness.reset()
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: MEMBERS, entityName: 'campaign_members' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH('user-1'))
})

describe('an entity whose slug has an underscore, through the generic handlers', () => {
  it('lists from its table, asks for the campaign_members:read scope and the campaign_members.list permission', async () => {
    const response = await handleGenericList(makeRequest({ url: 'http://localhost/api/v1/campaign_members', headers: TEAM_HEADERS })) as unknown as Res

    expect(response.status).toBe(200)
    expect(mocks.authenticateRequest).toHaveBeenCalledWith(expect.anything(), { requiredScope: 'campaign_members:read' })
    expect(mocks.checkPermission).toHaveBeenCalledWith('user-1', 'team-1', 'campaign_members.list')
    const [sql] = mocks.queryWithRLS.mock.calls[0] as [string]
    expect(sql).toContain('FROM "members_table"')
    expect(sql).not.toContain('campaign_members')
  })

  it('creates into its table, asking for campaign_members:write and campaign_members.create', async () => {
    mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'm-1', name: 'Ana' }], rowCount: 1 })
    const response = await handleGenericCreate(makeRequest({ method: 'POST', url: 'http://localhost/api/v1/campaign_members', headers: TEAM_HEADERS, body: { name: 'Ana' } })) as unknown as Res

    expect(mocks.authenticateRequest).toHaveBeenCalledWith(expect.anything(), { requiredScope: 'campaign_members:write' })
    expect(mocks.checkPermission).toHaveBeenCalledWith('user-1', 'team-1', 'campaign_members.create')
    expect(mocks.mutateWithRLS.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "members_table"'))).toBe(true)
    expect(response.status).toBe(201)
  })

  it('denies the list when the role lacks campaign_members.list', async () => {
    mocks.checkPermission.mockImplementation(async (_user: string, _team: string, permission: string) => permission !== 'campaign_members.list')

    const response = await handleGenericList(makeRequest({ url: 'http://localhost/api/v1/campaign_members', headers: TEAM_HEADERS })) as unknown as Res

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('PERMISSION_DENIED')
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
  })
})

describe('API key scopes name the slug exactly', () => {
  const options = { requiredScope: 'campaign_members:read' }
  const route = 'GET /api/v1/campaign_members'

  it('accepts a key holding campaign_members:read', () => {
    expect(resolveApiKeyScopeFailure(API_KEY_AUTH(['campaign_members:read']).scopes, options, route)).toBeNull()
  })

  it('refuses a key that holds the hyphenated spelling, which is a different entity', () => {
    expect(resolveApiKeyScopeFailure(API_KEY_AUTH(['campaign-members:read']).scopes, options, route)).not.toBeNull()
  })
})
