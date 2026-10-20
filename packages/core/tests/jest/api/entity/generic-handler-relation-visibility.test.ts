/**
 * #343: relation and relation-multi ids must name records the caller can see. A foreign key does not apply row-level
 * security and relation-multi is JSONB, so the handler runs one SELECT per field through the caller's RLS before
 * create, update and child writes. A hidden id and a nonexistent one get the same 400.
 */

import { harness, makeRequest, SESSION_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericCreate, handleGenericUpdate, handleChildCreate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const mockGetAllEntityConfigs = jest.fn()
jest.mock('@/core/lib/entities/registry', () => ({
  getAllEntityConfigs: (...args: unknown[]) => mockGetAllEntityConfigs(...args),
}))
const mockGetChildEntities = jest.fn()
jest.mock('@/core/lib/entities/queries', () => ({
  getChildEntities: (...args: unknown[]) => mockGetChildEntities(...args),
}))

const { mocks } = harness
type Res = { status: number; body: { code?: string; error?: string } }

const CLIENT = { slug: 'clients', tableName: 'clients', fields: [] } as unknown as EntityConfig
const PETS = {
  ...PETS_ENTITY,
  fields: [
    ...PETS_ENTITY.fields,
    { name: 'clientId', type: 'relation', relation: { entity: 'clients' }, api: { readOnly: false } },
    { name: 'friendIds', type: 'relation-multi', relation: { entity: 'clients' }, api: { readOnly: false } },
  ],
} as unknown as EntityConfig
const HEADERS = { 'x-team-id': 'team-1' }

const lookups = () => mocks.queryWithRLS.mock.calls.filter(([sql]: [string]) => sql.startsWith('SELECT id FROM "clients"'))

/** The ids the caller sees in the target table; everything else is hidden. */
function visibleClients(...ids: string[]) {
  mocks.queryWithRLS.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('SELECT id FROM "clients"')) return (params[0] as string[]).filter(id => ids.includes(id)).map(id => ({ id }))
    return [{ id: 'pet-1' }]
  })
}
const writes = () => mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))

beforeEach(() => {
  harness.reset()
  mockGetAllEntityConfigs.mockReturnValue([CLIENT, PETS])
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: PETS, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1' }] })
  visibleClients('c-mine', 'c-mine-2')
})

const create = (body: Record<string, unknown>) =>
  handleGenericCreate(makeRequest({ method: 'POST', url: 'http://localhost/api/v1/pets', headers: HEADERS, body })) as unknown as Promise<Res>
const update = (body: Record<string, unknown>) =>
  handleGenericUpdate(
    makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/pets/pet-1', headers: HEADERS, body }),
    { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }
  ) as unknown as Promise<Res>

describe('relation ids on create', () => {
  it('writes a visible relation and relation-multi ids, one lookup per field', async () => {
    const res = await create({ name: 'Rex', clientId: 'c-mine', friendIds: ['c-mine', 'c-mine-2', 'c-mine'] })
    expect(res.status).toBe(201)
    expect(lookups()).toHaveLength(2)
    expect(lookups()[1][1]).toEqual([['c-mine', 'c-mine-2']])
    expect(writes()).toHaveLength(1)
  })

  it('rejects an id the caller cannot see and one that does not exist with the same 400, writing nothing', async () => {
    visibleClients('c-mine') // c-other exists in another team but is hidden; c-ghost does not exist
    const hidden = await create({ name: 'Rex', clientId: 'c-other' })
    const missing = await create({ name: 'Rex', clientId: 'c-ghost' })
    expect(hidden.status).toBe(400)
    expect(hidden.body.code).toBe('INVALID_REFERENCE')
    expect(missing.body).toEqual(hidden.body)
    expect(writes()).toHaveLength(0)
  })

  it('rejects when one id inside relation-multi is not visible', async () => {
    const res = await create({ name: 'Rex', friendIds: ['c-mine', 'c-other'] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_REFERENCE')
    expect(writes()).toHaveLength(0)
  })

  it('runs no lookup for empty values or when the field is absent', async () => {
    const res = await create({ name: 'Rex', clientId: '', friendIds: [] })
    expect(res.status).toBe(201)
    expect(lookups()).toHaveLength(0)
    expect((await create({ name: 'Rex' })).status).toBe(201)
    expect(lookups()).toHaveLength(0)
  })

  it('treats a malformed id (22P02) as not visible', async () => {
    mocks.queryWithRLS.mockRejectedValue(Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }))
    expect((await create({ name: 'Rex', clientId: 'nope' })).status).toBe(400)
    expect(writes()).toHaveLength(0)
  })
})

describe('relation ids on update', () => {
  it('rejects an invisible id and keeps working for a visible one or a cleared relation', async () => {
    expect((await update({ clientId: 'c-other' })).status).toBe(400)
    expect(writes()).toHaveLength(0)
    expect((await update({ friendIds: ['c-other'] })).status).toBe(400)

    mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1' }], rowCount: 1 })
    expect((await update({ clientId: 'c-mine' })).status).toBe(200)
    expect((await update({ clientId: null })).status).toBe(200)
  })

  it('checks nothing for fields the request does not carry', async () => {
    mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1' }], rowCount: 1 })
    expect((await update({ name: 'Max' })).status).toBe(200)
    expect(lookups()).toHaveLength(0)
  })
})

describe('relation ids on child writes', () => {
  const child = {
    name: 'visits',
    tableName: 'pets_visits',
    config: { fields: [{ name: 'clientId', type: 'relation', relation: { entity: 'clients' } }] },
  }
  const childCreate = (body: Record<string, unknown>) =>
    handleChildCreate(
      makeRequest({ method: 'POST', url: 'http://localhost/api/v1/pets/pet-1/child/visits', headers: HEADERS, body }),
      { params: Promise.resolve({ id: 'pet-1', childType: 'visits' }) } as never
    ) as unknown as Promise<Res>

  beforeEach(() => {
    mockGetChildEntities.mockReturnValue([child])
    mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'v-1' }] })
  })

  it('rejects an invisible id before the INSERT and accepts a visible one', async () => {
    expect((await childCreate({ clientId: 'c-other' })).status).toBe(400)
    expect(writes()).toHaveLength(0)
    expect((await childCreate({ clientId: 'c-mine' })).status).toBe(200)
    expect(writes()).toHaveLength(1)
  })
})

describe('foreign key violations do not echo the database detail', () => {
  it('answers a generic message and keeps the detail out of the body', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.mutateWithRLS.mockRejectedValue(Object.assign(new Error('fk'), {
      code: '23503', constraint: 'pets_clientId_fkey', detail: 'Key (id)=(x) is still referenced from table "secret_table".',
    }))
    const res = await create({ name: 'Rex' })
    expect(JSON.stringify(res.body)).not.toContain('secret_table')
    expect(res.body.code).toBe('FOREIGN_KEY_VIOLATION')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('foreign key violation'), expect.objectContaining({ detail: expect.stringContaining('secret_table') }))
    spy.mockRestore()
  })
})
