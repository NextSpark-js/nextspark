import { afterEntityCreate, afterEntityUpdate, afterEntityDelete } from '@/core/lib/entities/entity-hooks'
import { expirePublicEntity } from '@/core/lib/cache/public-entity-cache'

jest.mock('@/core/lib/cache/public-entity-cache', () => ({ expirePublicEntity: jest.fn() }))

const expire = expirePublicEntity as jest.Mock

// Every writer (REST handlers, GenericEntityService, server actions) ends in these hooks.
describe('after-write hooks expire the public pages', () => {
  beforeEach(() => expire.mockClear())

  it('on create, update and delete', async () => {
    await afterEntityCreate('pages', { id: '1' })
    await afterEntityUpdate('pages', '1', { id: '1' }, {})
    await afterEntityDelete('pages', '1')
    expect(expire).toHaveBeenCalledTimes(3)
  })

  it('before the first await, so an un-awaited hook still runs inside the request', () => {
    void afterEntityDelete('pages', '1')
    expect(expire).toHaveBeenCalledTimes(1)
  })
})
