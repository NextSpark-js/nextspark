/**
 * Mock Entity Registry for Jest tests
 */

export const ENTITY_REGISTRY: Record<string, any> = {
  posts: {
    config: {
      name: 'posts',
      label: 'Posts',
      labelPlural: 'Posts',
      icon: 'FileText',
      slug: 'posts',
      apiSlug: 'posts',
      db: { table: 'posts' },
      fields: [],
      access: { shared: false },
    },
    tableName: 'posts',
    parent: null,
    depth: 0,
    source: 'theme',
    sourceName: 'default',
  },
  users: {
    config: {
      name: 'users',
      label: 'User',
      labelPlural: 'Users',
      icon: 'User',
      slug: 'users',
      apiSlug: 'users',
      db: { table: 'users' },
      fields: [],
      access: { shared: false },
    },
    tableName: 'users',
    parent: null,
    depth: 0,
    source: 'core',
    sourceName: 'core',
  },
}

export const ENTITY_METADATA = {
  generated: new Date().toISOString(),
  totalEntities: Object.keys(ENTITY_REGISTRY).length,
  sources: { theme: 1, core: 1, plugin: 0 },
}

export type EntityName = keyof typeof ENTITY_REGISTRY

export interface EntityRegistryEntry {
  config: any
  tableName: string
  parent: string | null
  depth: number
  source: string
  sourceName: string
}

export const clientMetaSystemAdapter = {
  getEntityMeta: (name: string) => ENTITY_REGISTRY[name]?.config || null,
  getAllEntities: () => Object.values(ENTITY_REGISTRY).map((e: any) => e.config),
}
