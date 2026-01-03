/**
 * Meta System Adapter Tests
 *
 * Tests for the MetaSystemAdapter class that provides meta configuration
 * derived from the modern entity registry.
 */

// Mock server-only to allow testing server components
jest.mock('server-only', () => ({}))

// Mock entity registry with test data
jest.mock('@/core/lib/entities/registry', () => ({
  getEntityConfig: (name: string) => {
    const configs: Record<string, unknown> = {
      users: {
        slug: 'users',
        enabled: true,
        names: { singular: 'User', plural: 'Users' },
        access: { public: false, api: true, metadata: true, shared: false },
      },
      tasks: {
        slug: 'tasks',
        enabled: true,
        names: { singular: 'Task', plural: 'Tasks' },
        access: { public: false, api: true, metadata: true, shared: false },
      },
      products: {
        slug: 'products',
        enabled: true,
        names: { singular: 'Product', plural: 'Products' },
        access: { public: false, api: true, metadata: false, shared: false },
      },
    }
    return configs[name]
  },
  getAllEntityConfigs: () => [
    {
      slug: 'users',
      enabled: true,
      names: { singular: 'User', plural: 'Users' },
      access: { public: false, api: true, metadata: true, shared: false },
    },
    {
      slug: 'tasks',
      enabled: true,
      names: { singular: 'Task', plural: 'Tasks' },
      access: { public: false, api: true, metadata: true, shared: false },
    },
    {
      slug: 'products',
      enabled: true,
      names: { singular: 'Product', plural: 'Products' },
      access: { public: false, api: true, metadata: false, shared: false },
    },
  ],
}))

import { MetaSystemAdapter, metaSystemAdapter } from '@/core/lib/entities/meta-adapter'
import type { EntityConfig } from '@/core/lib/entities/types'
import { Users } from 'lucide-react'

// Mock entity configuration for testing
const mockEntityConfig: EntityConfig = {
  slug: 'users',
  enabled: true,
  names: {
    singular: 'User',
    plural: 'Users',
  },
  icon: Users,
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: false,
  },
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: false,
    },
    public: {
      hasArchivePage: true,
      hasSinglePage: true,
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: false,
      importExport: false,
    },
  },
  fields: [],
  permissions: {
    actions: [
      { action: 'create', label: 'Create', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View', roles: ['owner', 'admin'] },
      { action: 'list', label: 'List', roles: ['owner', 'admin'] },
      { action: 'update', label: 'Edit', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete', roles: ['owner', 'admin'], dangerous: true },
    ],
  },
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: async () => ({ users: { singular: 'User', plural: 'Users' } }),
      es: async () => ({ users: { singular: 'Usuario', plural: 'Usuarios' } }),
    },
  },
  hooks: {},
}

describe('MetaSystemAdapter', () => {
  let adapter: MetaSystemAdapter

  beforeEach(() => {
    adapter = new MetaSystemAdapter()
  })

  describe('getMetaConfig', () => {
    test('should return meta config for entity with metadata support', () => {
      const metaConfig = adapter.getMetaConfig('users')

      expect(metaConfig).toEqual({
        tableName: 'users',
        metaTableName: 'users_metas',
        idColumn: 'entityId',
        apiPath: '/api/v1/users',
      })
    })

    test('should return null for entity without metadata support', () => {
      const metaConfig = adapter.getMetaConfig('products')
      expect(metaConfig).toBeNull()
    })

    test('should return null for nonexistent entity', () => {
      const metaConfig = adapter.getMetaConfig('nonexistent')
      expect(metaConfig).toBeNull()
    })

    test('should fallback for user entity (core entity)', () => {
      // Even without registry, user/users should return config
      const metaConfig = adapter.getMetaConfig('user')

      expect(metaConfig).toEqual({
        tableName: 'users',
        metaTableName: 'users_metas',
        idColumn: 'userId',
        apiPath: '/api/v1/users',
      })
    })
  })

  describe('supportsMetadata', () => {
    test('should return true for entity with metadata access', () => {
      expect(adapter.supportsMetadata('users')).toBe(true)
      expect(adapter.supportsMetadata('tasks')).toBe(true)
    })

    test('should return false for entity without metadata access', () => {
      expect(adapter.supportsMetadata('products')).toBe(false)
    })

    test('should return true for core user entity', () => {
      expect(adapter.supportsMetadata('user')).toBe(true)
      expect(adapter.supportsMetadata('users')).toBe(true)
    })

    test('should return false for nonexistent entity', () => {
      expect(adapter.supportsMetadata('nonexistent')).toBe(false)
    })
  })

  describe('getApiPath', () => {
    test('should return API path for entity with metadata', () => {
      expect(adapter.getApiPath('users')).toBe('/api/v1/users')
      expect(adapter.getApiPath('tasks')).toBe('/api/v1/tasks')
    })

    test('should return null for entity without metadata', () => {
      expect(adapter.getApiPath('products')).toBeNull()
    })

    test('should return null for nonexistent entity', () => {
      expect(adapter.getApiPath('nonexistent')).toBeNull()
    })
  })

  describe('getSupportedEntityTypes', () => {
    test('should return only entities with metadata support', () => {
      const supported = adapter.getSupportedEntityTypes()

      expect(supported).toContain('users')
      expect(supported).toContain('tasks')
      expect(supported).not.toContain('products')
      expect(supported).toHaveLength(2)
    })
  })

  describe('toMetaConfig', () => {
    test('should convert EntityConfig to MetaEntityConfig', () => {
      const metaConfig = adapter.toMetaConfig(mockEntityConfig)

      expect(metaConfig).toEqual({
        entityType: 'users',
        tableName: 'users',
        metaTableName: 'users_metas',
        idColumn: 'entityId',
        apiPath: '/api/v1/users',
      })
    })

    test('should return null for entity without metadata access', () => {
      const noMetadataConfig = {
        ...mockEntityConfig,
        access: { ...mockEntityConfig.access, metadata: false },
      }

      const metaConfig = adapter.toMetaConfig(noMetadataConfig)
      expect(metaConfig).toBeNull()
    })
  })

  describe('validateCompatibility', () => {
    test('should return compatible for existing entity', () => {
      const validation = adapter.validateCompatibility('users')

      expect(validation.compatible).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    test('should return not compatible for nonexistent entity', () => {
      const validation = adapter.validateCompatibility('nonexistent')

      expect(validation.compatible).toBe(false)
      expect(validation.issues).toContain('Entity "nonexistent" not found in registry')
    })
  })

  describe('generateMigrationReport', () => {
    test('should generate migration report', () => {
      const report = adapter.generateMigrationReport()

      expect(report).toHaveProperty('fullyMigrated')
      expect(report).toHaveProperty('needsMigration')
      expect(report).toHaveProperty('newEntitiesOnly')
      expect(report).toHaveProperty('compatibilityIssues')

      expect(Array.isArray(report.fullyMigrated)).toBe(true)
      expect(Array.isArray(report.needsMigration)).toBe(true)
      expect(report.needsMigration).toHaveLength(0)
      expect(report.compatibilityIssues).toHaveLength(0)
    })

    test('should list all entities as migrated', () => {
      const report = adapter.generateMigrationReport()

      expect(report.fullyMigrated).toContain('users')
      expect(report.fullyMigrated).toContain('tasks')
      expect(report.fullyMigrated).toContain('products')
    })
  })

  describe('Global Adapter Instance', () => {
    test('should provide global adapter instance', () => {
      expect(metaSystemAdapter).toBeInstanceOf(MetaSystemAdapter)
    })

    test('should provide convenience functions', () => {
      const {
        getMetaConfigForEntity,
        checkEntitySupportsMetadata,
        getEntityApiPath,
        validateEntityCompatibility,
      } = require('@/core/lib/entities/meta-adapter')

      expect(getMetaConfigForEntity('users')).toBeDefined()
      expect(checkEntitySupportsMetadata('users')).toBe(true)
      expect(getEntityApiPath('users')).toBe('/api/v1/users')
      expect(validateEntityCompatibility('users')).toHaveProperty('compatible')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid entity type gracefully', () => {
      expect(() => adapter.getMetaConfig('invalid')).not.toThrow()
      expect(() => adapter.supportsMetadata('invalid')).not.toThrow()
      expect(() => adapter.getApiPath('invalid')).not.toThrow()
    })

    test('should handle empty inputs gracefully', () => {
      expect(() => adapter.getMetaConfig('')).not.toThrow()
      expect(() => adapter.supportsMetadata('')).not.toThrow()
      expect(() => adapter.getApiPath('')).not.toThrow()
    })
  })
})
