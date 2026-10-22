/**
 * #346: the pattern usages of an entity closed to external callers (`access.api: false`, `enabled: false`)
 * reach an API key as ids only; a session caller gets the record's fields as before.
 */
import { PatternUsageService } from '@/core/lib/services/pattern-usage.service'
import { queryWithRLS, queryOneWithRLS, queryRows } from '@/core/lib/db'

jest.mock('@/core/lib/db', () => ({ queryWithRLS: jest.fn(), mutateWithRLS: jest.fn(), queryOneWithRLS: jest.fn(), queryRows: jest.fn() }))
jest.mock('@/core/lib/blocks/pattern-resolver', () => ({ extractPatternIds: jest.fn() }))
jest.mock('@/core/lib/entities/registry', () => ({
  entityRegistry: {
    get: (slug: string) => ({
      contacts: { slug: 'contacts', access: { api: false } },
      legacy: { slug: 'legacy', enabled: false },
      pages: { slug: 'pages', access: { api: true } },
    } as Record<string, unknown>)[slug] ?? null,
  },
}))

const mockQuery = queryWithRLS as jest.Mock
const mockQueryOne = queryOneWithRLS as jest.Mock
const mockRows = queryRows as jest.Mock

const usageOf = (entityType: string) => ({ id: 'pu-1', patternId: 'p-1', entityType, entityId: 'e-1', teamId: 't-1', createdAt: 'now' })

function setup(entityType: string) {
  mockQueryOne.mockResolvedValue({ count: '1' })
  mockRows.mockResolvedValue(['title', 'email', 'slug', 'status'].map(column_name => ({ column_name })))
  mockQuery
    .mockResolvedValueOnce([{ entityType, count: '1' }]) // counts
    .mockResolvedValueOnce([usageOf(entityType)]) // usages
    .mockResolvedValueOnce([{ id: 'e-1', title: 'Hidden title', email: 'a@b.c', slug: 'hidden', status: 'draft' }]) // record fields
}

beforeEach(() => jest.resetAllMocks())

describe.each([['contacts', 'access.api: false'], ['legacy', 'enabled: false']])('an entity with %s (%s)', (entityType) => {
  it('is reduced to its type and id for an external caller, and its table is not read', async () => {
    setup(entityType)
    const { usages } = await PatternUsageService.getUsagesWithEntityInfo('p-1', 'u-1', { external: true })
    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatchObject({ entityType, entityId: 'e-1' })
    for (const key of ['entityTitle', 'entityEmail', 'entitySlug', 'entityStatus'] as const) expect(usages[0][key]).toBeUndefined()
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes(`"${entityType}"`))).toBe(false)
  })

  it('keeps its fields for a session caller', async () => {
    setup(entityType)
    const { usages } = await PatternUsageService.getUsagesWithEntityInfo('p-1', 'u-1')
    expect(usages[0].entityTitle).toBe('Hidden title')
    expect(usages[0].entityEmail).toBe('a@b.c')
  })
})

it('an external caller still gets the fields of an entity open to the API', async () => {
  setup('pages')
  const { usages } = await PatternUsageService.getUsagesWithEntityInfo('p-1', 'u-1', { external: true })
  expect(usages[0].entityTitle).toBe('Hidden title')
})
