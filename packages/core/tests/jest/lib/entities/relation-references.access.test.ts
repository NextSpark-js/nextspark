/**
 * #388: an API key cannot probe the ids of an entity whose `access.api` object has no `read`
 * (as it already cannot for `access.api: false`, #346). A session caller is unaffected.
 */
import { findInvalidRelationField } from '@/core/lib/entities/relation-references'
import { queryWithRLS } from '@/core/lib/db'
import { getAllEntityConfigs } from '@/core/lib/entities/registry'
import type { EntityField } from '@/core/lib/entities/types'

jest.mock('@/core/lib/db', () => ({ queryWithRLS: jest.fn() }))
jest.mock('@/core/lib/entities/registry', () => ({ getAllEntityConfigs: jest.fn() }))

const ID = '11111111-1111-4111-8111-111111111111'
const fields = [{ name: 'contactId', type: 'relation', relation: { entity: 'contacts' } }] as unknown as EntityField[]
const data = { contactId: ID }

function target(api: unknown) {
  ;(getAllEntityConfigs as jest.Mock).mockReturnValue([{ slug: 'contacts', access: { api } }])
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(queryWithRLS as jest.Mock).mockResolvedValue([{ id: ID }])
})

it('rejects an id of an entity without read for an external caller, without querying its table', async () => {
  target({ create: true })
  expect(await findInvalidRelationField(fields, data, 'u-1', { external: true })).toBe('contactId')
  expect(queryWithRLS).not.toHaveBeenCalled()
})

it('accepts it for a session caller', async () => {
  target({ create: true })
  expect(await findInvalidRelationField(fields, data, 'u-1')).toBeNull()
})

it('accepts an entity with read for an external caller', async () => {
  target({ read: true })
  expect(await findInvalidRelationField(fields, data, 'u-1', { external: true })).toBeNull()
})
