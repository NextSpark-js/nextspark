/**
 * #325: `access.fieldVisibility` hides fields from a team role in list, read, create and update responses (and
 * those fields cannot be used to filter, sort, search or list distinct values), and `ownershipFilter.fieldGuards`
 * deny a role the fields it may not send on create as well as on update. An entity that declares neither behaves
 * as before, down to the queries it runs.
 */

import { harness, makeRequest, listUrl, SESSION_AUTH, API_KEY_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericList, handleGenericRead, handleGenericCreate, handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness
type Res = { status: number; body: { code?: string; error?: string; data?: unknown } }

const field = (name: string) => ({ name, type: 'text', api: { readOnly: false } })
const ENTITY = (access: Record<string, unknown>) => ({
  slug: 'pets',
  tableName: 'pets',
  fields: [field('name'), field('secret'), field('notes')],
  access: { api: true, ...access },
}) as unknown as EntityConfig

const VISIBILITY = { fieldVisibility: [{ roles: ['member'], hideFields: ['secret'] }] }
const GUARDS = { ownershipFilter: { roles: ['nobody'], field: 'ownerId', fieldGuards: [{ roles: ['member'], denyFields: ['secret'] }] } }
const ROW = { id: 'pet-1', name: 'Rex', secret: 'hidden-value', notes: 'n' }
const HEADERS = { 'x-team-id': 'team-1' }

const use = (entity: EntityConfig, role: string | null) => {
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: entity, entityName: 'pets' })
  mocks.queryOneWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM "team_members"')) return { id: 'm1' }
    if (sql.includes('SELECT role FROM "team_members"')) return role ? { role } : null
    return { ...ROW }
  })
}
const roleLookups = () => mocks.queryOneWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('SELECT role FROM "team_members"'))
const entityWrites = () => mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))
const listSql = () => (mocks.queryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"')) as [string])[0]

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.queryWithRLS.mockResolvedValue([{ ...ROW }])
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ ...ROW }] })
})

const list = (params: Record<string, string> = {}) =>
  handleGenericList(makeRequest({ url: listUrl(params), headers: HEADERS })) as unknown as Promise<Res>
const read = () =>
  handleGenericRead(makeRequest({ url: 'http://localhost/api/v1/pets/pet-1', headers: HEADERS }), { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }) as unknown as Promise<Res>
const create = (body: Record<string, unknown>) =>
  handleGenericCreate(makeRequest({ method: 'POST', headers: HEADERS, body })) as unknown as Promise<Res>
const update = (body: Record<string, unknown>) =>
  handleGenericUpdate(
    makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/pets/pet-1', headers: HEADERS, body }),
    { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }
  ) as unknown as Promise<Res>

describe('fieldVisibility on responses', () => {
  it.each([
    ['list', async () => (await list()).body.data, (data: unknown) => (data as unknown[])[0]],
    ['read', async () => (await read()).body.data, (data: unknown) => data],
    ['create', async () => (await create({ name: 'Rex' })).body.data, (data: unknown) => data],
    ['update', async () => (await update({ name: 'Rex' })).body.data, (data: unknown) => data],
  ])('%s: a hidden field is absent for the role and present for another role', async (_op, run, pick) => {
    use(ENTITY(VISIBILITY), 'member')
    expect(pick(await run())).toEqual({ id: 'pet-1', name: 'Rex', notes: 'n' })

    use(ENTITY(VISIBILITY), 'owner')
    expect(pick(await run())).toEqual(ROW)
  })

  it('also applies to an API key, which is keyed on the real team role', async () => {
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']))
    use(ENTITY(VISIBILITY), 'member')
    expect((await read()).body.data).not.toHaveProperty('secret')
  })

  it('is applied after the read hooks, so a hook cannot bring the field back', async () => {
    use(ENTITY(VISIBILITY), 'member')
    mocks.afterEntityRead.mockImplementation(async (_slug: string, results: unknown) =>
      (results as Record<string, unknown>[]).map(row => ({ ...row, secret: 'from-hook' })))
    expect((await read()).body.data).not.toHaveProperty('secret')
  })

  it.each([
    ['filtering by it', { secret: 'x' }, 'INVALID_FILTER'],
    ['sorting by it', { sortBy: 'secret' }, 'INVALID_SORT_FIELD'],
    ['searching with it', { search: 'x', searchField: 'secret' }, 'INVALID_SEARCH_FIELD'],
    ['listing its distinct values', { distinct: 'true', fields: 'secret' }, 'INVALID_FIELD'],
  ])('rejects %s for the role, as for a field that does not exist', async (_what, params, code) => {
    use(ENTITY(VISIBILITY), 'member')
    const denied = await list(params)
    expect(denied.status).toBe(400)
    expect(denied.body.code).toBe(code)

    mocks.queryWithRLS.mockClear()
    use(ENTITY(VISIBILITY), 'owner')
    expect((await list(params)).status).toBe(200)
  })

  it('does not select a hidden field a `fields` projection asks for', async () => {
    use(ENTITY(VISIBILITY), 'member')
    await list({ fields: 'name,secret' })
    expect(listSql()).toContain('t.name')
    expect(listSql()).not.toContain('secret')
  })
})

describe('fieldVisibility and publicFields', () => {
  const PUBLIC = ENTITY({ public: true, publicFields: ['name', 'secret'], ...VISIBILITY })

  it('a public request gets publicFields only, and a member of the team gets the whole record minus the hidden fields', async () => {
    use(PUBLIC, 'member')
    mocks.authenticateRequest.mockResolvedValue({ success: false, type: 'none', user: null })
    expect((await read()).body.data).toEqual({ name: 'Rex', secret: 'hidden-value' })
    expect(roleLookups()).toHaveLength(0)

    mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
    expect((await read()).body.data).toEqual({ id: 'pet-1', name: 'Rex', notes: 'n' })
  })
})

describe('fieldGuards on create and update', () => {
  it('create: denies a guarded field for the role, writing nothing, and allows it for another role', async () => {
    use(ENTITY(GUARDS), 'member')
    const denied = await create({ name: 'Rex', secret: 's' })
    expect(denied.status).toBe(403)
    expect(denied.body.code).toBe('FIELD_MODIFICATION_DENIED')
    expect(denied.body.error).toContain('secret')
    expect(entityWrites()).toHaveLength(0)

    expect((await create({ name: 'Rex' })).status).toBe(201)

    use(ENTITY(GUARDS), 'owner')
    expect((await create({ name: 'Rex', secret: 's' })).status).toBe(201)
  })

  it('create: applies to an API key as well', async () => {
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']))
    use(ENTITY(GUARDS), 'member')
    expect((await create({ secret: 's' })).status).toBe(403)
    expect(entityWrites()).toHaveLength(0)
  })

  it('update: still denies a guarded field', async () => {
    use(ENTITY(GUARDS), 'member')
    expect((await update({ secret: 's' })).status).toBe(403)
    expect(entityWrites()).toHaveLength(0)
  })
})

describe('entities without the options', () => {
  it('return every field and run no role lookup', async () => {
    use(PETS_ENTITY, 'member')
    expect((await list()).body.data).toEqual([ROW])
    expect((await read()).body.data).toEqual(ROW)
    expect((await create({ name: 'Rex', secret: 's' })).status).toBe(201)
    expect(roleLookups()).toHaveLength(0)
  })
})
