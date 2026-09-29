/**
 * Client code reads an entity's API path, operations and parent/child relation from the dashboard's own registry
 * (hydrated by the shell), not from the generated registry that imports every entity's config (#203, stage 4).
 */
import { clientEntityRegistry } from '../../../../src/lib/entities/registry.client'
import { getClientEntityApiPath, getClientEntityConfigs, parseClientChildEntity } from '../../../../src/lib/entities/client-entity-meta'
import { toClientEntityConfig } from '../../../../src/lib/entities/client-config'
import type { EntityConfig } from '../../../../src/lib/entities/types'

const entity = (slug: string, extra: Record<string, unknown> = {}) =>
  ({ slug, enabled: true, names: { singular: slug.slice(0, -1), plural: slug }, ui: { dashboard: { showInMenu: true } }, ...extra }) as unknown as EntityConfig

beforeEach(() => {
  clientEntityRegistry.clear()
  clientEntityRegistry.register(entity('tasks'))
  clientEntityRegistry.register(entity('orders'))
  clientEntityRegistry.register(entity('archive', { enabled: false }))
})

describe('getClientEntityApiPath', () => {
  it('is the slug of a registered entity', () => {
    expect(getClientEntityApiPath('tasks')).toBe('tasks')
  })
  it('reaches an entity the registry does not know at its own name', () => {
    expect(getClientEntityApiPath('gadgets')).toBe('gadgets')
  })
  it('has none for a child entity, which is reached through its parent', () => {
    expect(getClientEntityApiPath('orders_item')).toBeNull()
  })
})

describe('parseClientChildEntity', () => {
  it('finds the parent among the registered entities, the longest match first', () => {
    clientEntityRegistry.register(entity('orders_archive'))
    expect(parseClientChildEntity('orders_item')).toEqual({ isChild: true, parentEntity: 'orders', childType: 'items' })
    expect(parseClientChildEntity('orders_archive_row')).toEqual({ isChild: true, parentEntity: 'orders_archive', childType: 'rows' })
  })
  it('is not a child when no registered entity is its parent', () => {
    expect(parseClientChildEntity('tasks')).toEqual({ isChild: false })
    expect(parseClientChildEntity('ghost_item')).toEqual({ isChild: false })
  })
})

describe('getClientEntityConfigs', () => {
  it('lists the registered entities with the operations the generated registry granted', () => {
    expect(getClientEntityConfigs().map(config => [config.name, config.apiPath, config.features.enabled, config.features.canDelete])).toEqual([
      ['tasks', 'tasks', true, true],
      ['orders', 'orders', true, true],
      ['archive', 'archive', false, true],
    ])
  })
  it('is empty before the dashboard shell has hydrated the registry', () => {
    clientEntityRegistry.clear()
    expect(getClientEntityConfigs()).toEqual([])
  })
})

describe('toClientEntityConfig', () => {
  it('builds the client-safe view the builder editor takes, from the config alone', () => {
    const config = toClientEntityConfig(
      entity('posts', { access: { basePath: '/blog' }, builder: { enabled: true, showSlug: true, sidebarFields: ['excerpt'] }, taxonomies: { enabled: true, types: [] } })
    )
    expect(config).toMatchObject({
      name: 'posts',
      apiPath: 'posts',
      displayName: 'post',
      access: { basePath: '/blog' },
      features: { enabled: true, showInMenu: true, canCreate: true },
      builder: { enabled: true, showSlug: true, sidebarFields: ['excerpt'] },
      taxonomies: { enabled: true, types: [] },
    })
  })
  it('follows the registry\'s flags: disabled and hidden are `=== false`, absent means served', () => {
    expect(toClientEntityConfig(entity('a', { enabled: false })).features.enabled).toBe(false)
    expect(toClientEntityConfig(entity('a', { ui: { dashboard: { showInMenu: false } } })).features.showInMenu).toBe(false)
    const bare = toClientEntityConfig({ slug: 'a', names: { singular: 'a', plural: 'as' } } as unknown as EntityConfig)
    expect(bare.features).toMatchObject({ enabled: true, showInMenu: true })
    expect(bare.builder).toBeUndefined()
  })
})
