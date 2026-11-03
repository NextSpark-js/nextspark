/**
 * #376: registering an entity whose `access.api` has an unknown operation fails with a clear message.
 */

import { EntityRegistry } from '@/core/lib/entities/registry'
import type { EntityConfig } from '@/core/lib/entities/types'

jest.mock('server-only', () => ({}), { virtual: true })

const entity = (api: unknown) => ({
  slug: 'pets', enabled: true, names: { singular: 'Pet', plural: 'Pets' }, icon: {},
  access: { public: false, api, metadata: false, shared: false }, fields: [],
}) as unknown as EntityConfig

describe('EntityRegistry.register with access.api', () => {
  it('rejects an unknown operation', () => {
    expect(() => new EntityRegistry().register(entity({ reed: true }))).toThrow(/unknown operation "reed"/)
  })

  it.each([[true], [false], [{ read: true }], [undefined]])('accepts %j', api => {
    expect(() => new EntityRegistry().register(entity(api))).not.toThrow()
  })
})
