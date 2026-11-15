/**
 * #463: GenericEntityService.list searches % and _ literally and sorts empty values last, except on the NOT NULL
 * system columns (a plain `("createdAt" DESC)` index would stop serving the order).
 */
import { GenericEntityService } from '@/core/lib/services/generic-entity.service'
import { queryWithRLS } from '@/core/lib/db'

jest.mock('@/core/lib/db', () => ({ mutateWithRLS: jest.fn(), queryWithRLS: jest.fn(), queryOneWithRLS: jest.fn() }))
jest.mock('@/core/lib/entities/registry', () => ({
  entityRegistry: {
    get: () => ({
      slug: 'contacts',
      tableName: 'contacts',
      access: {},
      fields: [
        { name: 'title', type: 'text', api: { readOnly: false, searchable: true } },
        { name: 'lastContactedAt', type: 'datetime', api: { readOnly: false } },
      ],
    }),
  },
}))

const query = queryWithRLS as jest.Mock
const listSql = () => query.mock.calls.find(([sql]: [string]) => sql.includes('ORDER BY')) as [string, unknown[]]

beforeEach(() => {
  query.mockReset()
  query.mockResolvedValueOnce([{ count: '0' }]).mockResolvedValueOnce([])
})

describe('GenericEntityService.list (#463)', () => {
  it('searches % and _ literally: escaped in the bound term, ESCAPE after the ILIKE', async () => {
    await GenericEntityService.list('contacts', 'user-1', { search: '50%_' })

    const [sql, params] = listSql()
    expect(sql).toMatch(/ILIKE \$\d+ ESCAPE '\\'/)
    expect(params).toContain('%50\\%\\_%')
  })

  it('puts empty values last on a nullable field in both directions', async () => {
    await GenericEntityService.list('contacts', 'user-1', { orderBy: 'lastContactedAt', orderDir: 'desc' })
    expect(listSql()[0]).toContain('ORDER BY "lastContactedAt" DESC NULLS LAST')

    query.mockReset()
    query.mockResolvedValueOnce([{ count: '0' }]).mockResolvedValueOnce([])
    await GenericEntityService.list('contacts', 'user-1', { orderBy: 'lastContactedAt', orderDir: 'asc' })
    expect(listSql()[0]).toContain('ORDER BY "lastContactedAt" ASC NULLS LAST')
  })

  it('leaves NULLS LAST off the NOT NULL createdAt default', async () => {
    await GenericEntityService.list('contacts', 'user-1', {})

    const [sql] = listSql()
    expect(sql).toContain('ORDER BY "createdAt" DESC')
    expect(sql).not.toContain('NULLS')
  })
})
