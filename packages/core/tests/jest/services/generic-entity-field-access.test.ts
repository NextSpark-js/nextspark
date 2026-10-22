/**
 * #325 for server actions: GenericEntityService applies `access.fieldVisibility` and `ownershipFilter.fieldGuards`
 * as the REST handler does, and an entity that declares neither runs no role lookup.
 */

import { GenericEntityService } from '@/core/lib/services/generic-entity.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { entityRegistry } from '@/core/lib/entities/registry'

jest.mock('@/core/lib/db', () => ({ queryOneWithRLS: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn(), getTransactionClient: jest.fn() }))
jest.mock('@/core/lib/entities/registry', () => ({ entityRegistry: { get: jest.fn() }, getAllEntityConfigs: jest.fn(() => []) }))
jest.mock('@/core/lib/entities/entity-hooks', () => ({
  beforeEntityCreate: async (_slug: string, data: unknown) => data,
  afterEntityCreate: async () => undefined,
  beforeEntityUpdate: async (_slug: string, _id: string, data: unknown) => data,
  afterEntityUpdate: async () => undefined,
  beforeEntityDelete: async () => true,
  afterEntityDelete: async () => undefined,
}))

const mockQueryOne = queryOneWithRLS as jest.Mock
const mockQuery = queryWithRLS as jest.Mock
const mockMutate = mutateWithRLS as jest.Mock
const mockGet = entityRegistry.get as jest.Mock

const field = (name: string) => ({ name, type: 'text', api: { searchable: true } })
const entity = (access: Record<string, unknown>) => ({
  slug: 'pets', tableName: 'pets', enabled: true,
  fields: [field('name'), field('secret')],
  access: { api: true, ...access },
})
const VISIBILITY = { fieldVisibility: [{ roles: ['member'], hideFields: ['secret'] }] }
const GUARDS = { ownershipFilter: { roles: ['nobody'], field: 'ownerId', fieldGuards: [{ roles: ['member'], denyFields: ['secret'] }] } }
const ROW = { id: 'pet-1', userId: 'u1', teamId: 'team-1', name: 'Rex', secret: 'hidden-value' }
const VISIBLE = { id: 'pet-1', userId: 'u1', teamId: 'team-1', name: 'Rex' }

const use = (access: Record<string, unknown>, role: string | null) => {
  mockGet.mockReturnValue(entity(access))
  mockQueryOne.mockImplementation(async (sql: string) => (sql.includes('FROM "team_members"') ? (role ? { role } : null) : { ...ROW }))
}
const roleLookups = () => mockQueryOne.mock.calls.filter(([sql]: [string]) => sql.includes('FROM "team_members"'))

beforeEach(() => {
  jest.clearAllMocks()
  mockQuery.mockResolvedValue([{ ...ROW }])
  mockMutate.mockResolvedValue({ rows: [{ ...ROW }], rowCount: 1 })
})

describe('GenericEntityService fieldVisibility', () => {
  it.each([
    ['getById', () => GenericEntityService.getById('pets', 'pet-1', 'u1', 'team-1')],
    ['list', async () => (await GenericEntityService.list('pets', 'u1', { teamId: 'team-1' })).data[0]],
    ['create', () => GenericEntityService.create('pets', 'u1', 'team-1', { name: 'Rex' })],
    ['update', () => GenericEntityService.update('pets', 'pet-1', 'u1', { name: 'Rex' }, 'team-1')],
  ])('%s: a hidden field is absent for the role and present for another role', async (_op, run) => {
    use(VISIBILITY, 'member')
    expect(await run()).toEqual(VISIBLE)
    use(VISIBILITY, 'owner')
    expect(await run()).toEqual(ROW)
  })

  it('getById without a team reads the role in the record\'s own team', async () => {
    use(VISIBILITY, 'member')
    expect(await GenericEntityService.getById('pets', 'pet-1', 'u1')).toEqual(VISIBLE)
    expect(roleLookups()[0][1]).toEqual(['team-1', 'u1'])
  })

  it('list and count treat a hidden field as unknown when filtering, sorting or searching', async () => {
    use(VISIBILITY, 'member')
    await expect(GenericEntityService.list('pets', 'u1', { teamId: 'team-1', where: { secret: 'x' } })).rejects.toThrow('Invalid filter field: "secret"')
    await expect(GenericEntityService.count('pets', 'u1', { teamId: 'team-1', secret: 'x' })).rejects.toThrow('Invalid filter field: "secret"')

    await GenericEntityService.list('pets', 'u1', { teamId: 'team-1', orderBy: 'secret', search: 'x' })
    const sql = mockQuery.mock.calls.map(([q]: [string]) => q).join('\n')
    expect(sql).not.toContain('ORDER BY secret')
    expect(sql).not.toMatch(/secret ILIKE/)

    mockQuery.mockClear()
    use(VISIBILITY, 'owner')
    await GenericEntityService.list('pets', 'u1', { teamId: 'team-1', where: { secret: 'x' }, orderBy: 'secret', search: 'x' })
    const ownerSql = mockQuery.mock.calls.map(([q]: [string]) => q).join('\n')
    expect(ownerSql).toContain('ORDER BY secret')
    expect(ownerSql).toMatch(/secret ILIKE/)
  })
})

describe('GenericEntityService fieldGuards', () => {
  it('create denies a guarded field for the role, writing nothing, and allows it for another role', async () => {
    use(GUARDS, 'member')
    await expect(GenericEntityService.create('pets', 'u1', 'team-1', { name: 'Rex', secret: 's' })).rejects.toThrow(/not allowed to modify field\(s\): secret/)
    expect(mockMutate).not.toHaveBeenCalled()
    await expect(GenericEntityService.create('pets', 'u1', 'team-1', { name: 'Rex' })).resolves.toBeDefined()

    use(GUARDS, 'owner')
    await expect(GenericEntityService.create('pets', 'u1', 'team-1', { name: 'Rex', secret: 's' })).resolves.toBeDefined()
  })

  it('update denies a guarded field for the role', async () => {
    use(GUARDS, 'member')
    await expect(GenericEntityService.update('pets', 'pet-1', 'u1', { secret: 's' }, 'team-1')).rejects.toThrow(/not allowed to modify/)
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('GenericEntityService without the options', () => {
  it('returns every field and runs no role lookup', async () => {
    use({}, 'member')
    expect(await GenericEntityService.getById('pets', 'pet-1', 'u1', 'team-1')).toEqual(ROW)
    expect((await GenericEntityService.list('pets', 'u1', { teamId: 'team-1' })).data[0]).toEqual(ROW)
    await GenericEntityService.create('pets', 'u1', 'team-1', { name: 'Rex', secret: 's' })
    await GenericEntityService.update('pets', 'pet-1', 'u1', { secret: 's' }, 'team-1')
    expect(roleLookups()).toHaveLength(0)
  })
})
