import { GenericEntityService } from '@/core/lib/services/generic-entity.service'
import { expirePublicEntity } from '@/core/lib/cache/public-entity-cache'
import { mutateWithRLS } from '@/core/lib/db'

jest.mock('@/core/lib/cache/public-entity-cache', () => ({ expirePublicEntity: jest.fn() }))
jest.mock('@/core/lib/db', () => ({ mutateWithRLS: jest.fn(), queryWithRLS: jest.fn(), queryOneWithRLS: jest.fn() }))
jest.mock('@/core/lib/entities/registry', () => ({
  entityRegistry: { get: () => ({ slug: 'pages', tableName: 'pages', fields: [], access: { basePath: '/' } }) },
}))

describe('GenericEntityService.deleteMany without hooks', () => {
  it('expires the public pages when rows were deleted', async () => {
    ;(mutateWithRLS as jest.Mock).mockResolvedValue({ rowCount: 2 })
    await GenericEntityService.deleteMany('pages', ['a', 'b'], 'user-1')
    expect(expirePublicEntity).toHaveBeenCalledTimes(1)
  })
})
