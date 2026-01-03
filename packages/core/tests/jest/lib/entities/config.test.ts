/**
 * Entity Configuration Manager Tests
 *
 * Tests for the EntityRegistry class covering initialization,
 * registration, validation, and management functionality.
 */

// Mock server-only to allow testing server components
jest.mock('server-only', () => ({}))

import { EntityRegistry } from '@/core/lib/entities/registry'
import type { EntityConfig } from '@/core/lib/entities/types'
import { CheckSquare } from 'lucide-react'

// Mock entity for testing
const mockEntityConfig: EntityConfig = {
  slug: 'test-entity',
  enabled: true,
  names: {
    singular: 'Test Entity',
    plural: 'Test Entities',
  },
  icon: CheckSquare,
  access: {
    public: false,
    api: true,
    metadata: true,
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
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      display: {
        label: 'Title',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
      },
      api: {
        sortable: true,
        searchable: true,
        readOnly: false,
      },
    },
  ],
  permissions: {
    actions: [
      { action: 'create', label: 'Create test entities', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View test entities', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List test entities', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit test entities', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete test entities', roles: ['owner'], dangerous: true },
    ],
  },
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: async () => ({ test: { singular: 'Test Entity', plural: 'Test Entities' } }),
      es: async () => ({ test: { singular: 'Entidad de Prueba', plural: 'Entidades de Prueba' } }),
    },
  },
  hooks: {
    beforeCreate: [
      async () => ({ continue: true }),
    ],
  },
}

describe('EntityRegistry', () => {
  let configManager: EntityRegistry

  beforeEach(() => {
    configManager = new EntityRegistry()
  })

  afterEach(() => {
    configManager.reset()
  })

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(configManager.isInitialized()).toBe(false)

      await configManager.initialize()

      expect(configManager.isInitialized()).toBe(true)
    })

    test('should not initialize twice', async () => {
      await configManager.initialize()
      expect(configManager.isInitialized()).toBe(true)

      // Second initialization should not throw or cause issues
      await expect(configManager.initialize()).resolves.not.toThrow()
    })
  })

  describe('Entity Registration', () => {
    beforeEach(async () => {
      await configManager.initialize()
    })

    test('should register valid entity configuration', () => {
      expect(() => configManager.register(mockEntityConfig)).not.toThrow()

      const retrieved = configManager.get('test-entity')
      expect(retrieved).toEqual(mockEntityConfig)
    })

    test('should reject invalid entity configurations', () => {
      const invalidConfig = {
        ...mockEntityConfig,
        slug: '', // Invalid empty slug
      }

      expect(() => configManager.register(invalidConfig)).toThrow('Entity slug is required')
    })

    test('should validate all required fields', () => {
      const testCases = [
        {
          config: { ...mockEntityConfig, names: { ...mockEntityConfig.names, singular: '' } },
          error: 'Entity singular name is required'
        },
        {
          config: { ...mockEntityConfig, names: { ...mockEntityConfig.names, plural: '' } },
          error: 'Entity plural name is required'
        },
        {
          config: { ...mockEntityConfig, icon: undefined as any },
          error: 'Icon is required'
        },
        {
          config: { ...mockEntityConfig, enabled: 'not-boolean' as any },
          error: 'enabled must be a boolean'
        },
      ]

      testCases.forEach(({ config, error }) => {
        expect(() => configManager.register(config)).toThrow(error)
      })
    })

    // NOTE: Permissions validation test removed - permissions are now defined
    // centrally in permissions.config.ts, not in EntityConfig.
    // See: core/lib/entities/registry.ts lines 192-193

    // Database, API, routes, and field validations are currently disabled in EntityRegistry
    // TODO: Re-enable these tests when validation is re-implemented
  })

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await configManager.initialize()
      configManager.register(mockEntityConfig)
    })

    test('should retrieve entity configuration', () => {
      const config = configManager.get('test-entity')
      expect(config).toEqual(mockEntityConfig)
      expect(configManager.get('nonexistent')).toBeUndefined()
    })

    test('should get all configurations', () => {
      const allConfigs = configManager.getAll()
      expect(allConfigs).toHaveLength(1)
      expect(allConfigs[0]).toEqual(mockEntityConfig)
    })

    test('should update entity configuration', () => {
      const updates = {
        names: { ...mockEntityConfig.names, singular: 'Updated Test Entity' },
        enabled: false,
      }

      configManager.updateEntity('test-entity', updates)

      const updated = configManager.get('test-entity')
      expect(updated?.names.singular).toBe('Updated Test Entity')
      expect(updated?.enabled).toBe(false)
    })

    test('should reject updates to nonexistent entities', () => {
      const updates = { names: { ...mockEntityConfig.names, singular: 'Updated' } }

      expect(() => configManager.updateEntity('nonexistent', updates)).toThrow('Entity "nonexistent" not found')
    })

    test('should validate updates', () => {
      const invalidUpdates = {
        slug: '', // Invalid empty slug
      }

      expect(() => configManager.updateEntity('test-entity', invalidUpdates)).toThrow('Entity slug is required')
    })

    test('should remove entity configuration', () => {
      expect(configManager.get('test-entity')).toBeDefined()

      configManager.removeEntity('test-entity')

      expect(configManager.get('test-entity')).toBeUndefined()
    })

    test('should reject removal of nonexistent entities', () => {
      expect(() => configManager.removeEntity('nonexistent')).toThrow('Entity "nonexistent" not found')
    })
  })

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await configManager.initialize()
    })

    test('should provide accurate statistics', () => {
      const initialStats = configManager.getStats()
      expect(initialStats.totalEntities).toBe(0)
      expect(initialStats.enabledEntities).toBe(0)

      configManager.register(mockEntityConfig)

      const updatedStats = configManager.getStats()
      expect(updatedStats.totalEntities).toBe(1)
      expect(updatedStats.enabledEntities).toBe(1)
    })

    test('should handle empty statistics correctly', () => {
      const stats = configManager.getStats()
      expect(stats.totalEntities).toBe(0)
      expect(stats.enabledEntities).toBe(0)
    })
  })

  describe('Import/Export', () => {
    beforeEach(async () => {
      await configManager.initialize()
      configManager.register(mockEntityConfig)
    })

    test('should export configurations', () => {
      const exported = configManager.exportConfigs()
      expect(exported).toHaveLength(1)
      expect(exported[0]).toEqual(mockEntityConfig)
    })

    test('should import configurations', () => {
      const newConfig: EntityConfig = {
        ...mockEntityConfig,
        slug: 'imported-entity',
        names: { singular: 'Imported Entity', plural: 'Imported Entities' },
      }

      configManager.importConfigs([newConfig])

      expect(configManager.get('imported-entity')).toEqual(newConfig)
      expect(configManager.getAll()).toHaveLength(2)
    })

    test('should validate imported configurations', () => {
      const invalidConfig = {
        ...mockEntityConfig,
        slug: '', // Invalid
      }

      expect(() => configManager.importConfigs([invalidConfig])).toThrow('Entity slug is required')
    })
  })

  describe('Child Entity Validation', () => {
    test('should validate child entity configuration', async () => {
      await configManager.initialize()

      const configWithChildEntities = {
        ...mockEntityConfig,
        childEntities: {
          comments: {
            table: '', // Invalid empty table name
            fields: [],
            showInParentView: true,
            hasOwnRoutes: false,
            display: {
              title: 'Comments',
              order: 1,
              mode: 'list' as const,
              allowInlineEdit: true,
              collapsible: false,
            },
          },
        },
      }

      expect(() => configManager.register(configWithChildEntities)).toThrow('Child entity "comments" must have a table name')
    })

    test('should require fields array for child entities', async () => {
      await configManager.initialize()

      const configWithInvalidChild = {
        ...mockEntityConfig,
        childEntities: {
          comments: {
            table: 'comments',
            fields: 'invalid', // Should be array
            showInParentView: true,
            hasOwnRoutes: false,
            display: {
              title: 'Comments',
              order: 1,
              mode: 'list' as const,
              allowInlineEdit: true,
              collapsible: false,
            },
          },
        },
      }

      expect(() => configManager.register(configWithInvalidChild as any)).toThrow('Child entity "comments" must have fields array')
    })
  })

  describe('System Reset', () => {
    test('should reset system completely', async () => {
      await configManager.initialize()
      configManager.register(mockEntityConfig)

      expect(configManager.isInitialized()).toBe(true)
      expect(configManager.getAll()).toHaveLength(1)

      configManager.reset()

      expect(configManager.isInitialized()).toBe(false)
      expect(configManager.getAll()).toHaveLength(0)
    })

    test('should allow re-initialization after reset', async () => {
      await configManager.initialize()
      configManager.register(mockEntityConfig)
      configManager.reset()

      await configManager.initialize()
      configManager.register(mockEntityConfig)

      expect(configManager.isInitialized()).toBe(true)
      expect(configManager.get('test-entity')).toEqual(mockEntityConfig)
    })
  })

  describe('Error Handling', () => {
    test('should handle registration before initialization', () => {
      // Should not throw - initialization happens automatically
      expect(() => configManager.register(mockEntityConfig)).not.toThrow()
    })

    test('should handle complex validation scenarios', async () => {
      await configManager.initialize()

      // Test with multiple validation issues
      const complexInvalidConfig = {
        slug: '', // Issue 1: Empty slug
        names: {
          singular: '', // Issue 2: Empty singular name
          plural: '', // Issue 3: Empty plural name
        },
        icon: undefined, // Issue 4: Missing icon
        enabled: 'not-boolean', // Issue 5: Invalid enabled type
        fields: [],
        permissions: {
          read: 'invalid', // Issue 6: Invalid permissions array
          create: [],
          update: [],
          delete: [],
        },
        access: {
          public: false,
          api: true,
          metadata: true,
        },
        ui: {
          dashboard: { showInMenu: false, showInTopbar: false },
          public: { hasArchivePage: false, hasSinglePage: false },
          features: {
            searchable: false,
            sortable: false,
            filterable: false,
            bulkOperations: false,
            importExport: false,
          },
        },
        i18n: {
          fallbackLocale: 'en' as const,
          loaders: {
            en: async () => ({}),
          },
        },
      }

      expect(() => configManager.register(complexInvalidConfig as any)).toThrow()
    })
  })
})