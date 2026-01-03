/**
 * Entity Registry Tests
 *
 * Comprehensive tests for the EntityRegistry class covering core functionality
 * including entity registration, feature-based filtering, and child entities.
 */

// Mock server-only to allow testing server components
jest.mock('server-only', () => ({}))

import { EntityRegistry } from '@/core/lib/entities/registry'
import type { EntityConfig } from '@/core/lib/entities/types'
import { Users, CheckSquare } from 'lucide-react'

// Mock entity configurations for testing - Updated to match current EntityConfig interface
const mockUserEntity: EntityConfig = {
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
  },
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
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
      name: 'id',
      type: 'text',
      required: true,
      display: {
        label: 'ID',
        showInList: true,
        showInDetail: true,
        showInForm: false,
        order: 1,
      },
      api: {
        sortable: true,
        searchable: false,
        readOnly: true,
      },
    },
  ],
  permissions: {
    actions: [
      { action: 'create', label: 'Create users', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View users', roles: ['owner', 'admin'] },
      { action: 'list', label: 'List users', roles: ['owner', 'admin'] },
      { action: 'update', label: 'Edit users', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete users', roles: ['owner', 'admin'], dangerous: true },
    ],
  },
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: async () => ({ users: { singular: 'User', plural: 'Users' } }),
      es: async () => ({ users: { singular: 'Usuario', plural: 'Usuarios' } }),
    },
  },
}

const mockTaskEntity: EntityConfig = {
  slug: 'tasks',
  enabled: true,
  names: {
    singular: 'Task',
    plural: 'Tasks',
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
      showInTopbar: true,
    },
    public: {
      hasArchivePage: true,
      hasSinglePage: true,
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: true,
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
      { action: 'create', label: 'Create tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'list', label: 'List tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', roles: ['owner', 'admin'], dangerous: true },
    ],
  },
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: async () => ({ tasks: { singular: 'Task', plural: 'Tasks' } }),
      es: async () => ({ tasks: { singular: 'Tarea', plural: 'Tareas' } }),
    },
  },
  childEntities: {
    comments: {
      table: 'task_comments',
      fields: [
        {
          name: 'comment',
          type: 'textarea',
          required: true,
        },
      ],
      showInParentView: true,
      hasOwnRoutes: false,
      display: {
        title: 'Comments',
        order: 1,
        mode: 'list',
        allowInlineEdit: true,
        collapsible: false,
      },
    },
  },
}

const mockDisabledEntity: EntityConfig = {
  ...mockTaskEntity,
  slug: 'disabled-entity',
  enabled: false,
  names: {
    singular: 'Disabled Entity',
    plural: 'Disabled Entities',
  },
}

describe('EntityRegistry', () => {
  let registry: EntityRegistry

  beforeEach(() => {
    registry = new EntityRegistry()
    registry.initialize()
  })

  describe('Basic Registry Operations', () => {
    it('should register and retrieve entities', () => {
      registry.register(mockUserEntity)

      const retrieved = registry.get('users')
      expect(retrieved).toBeDefined()
      expect(retrieved?.slug).toBe('users')
      expect(retrieved?.names.singular).toBe('User')
      expect(retrieved?.names.plural).toBe('Users')
    })

    it('should get all entities', () => {
      registry.register(mockUserEntity)
      registry.register(mockTaskEntity)

      const all = registry.getAll()
      expect(all).toHaveLength(2)
      expect(all.map((e) => e.slug)).toContain('users')
      expect(all.map((e) => e.slug)).toContain('tasks')
    })

    it('should get only enabled entities', () => {
      registry.register(mockUserEntity)
      registry.register(mockDisabledEntity)

      const enabled = registry.getEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].slug).toBe('users')
    })

    it('should validate configuration on registration', () => {
      const invalidEntity = {
        // Missing required fields
        slug: '',
        enabled: 'not-a-boolean' as any,
      } as EntityConfig

      expect(() => registry.register(invalidEntity)).toThrow()
    })
  })

  describe('Feature-based Filtering', () => {
    it('should get entities by feature', () => {
      registry.register(mockUserEntity)
      registry.register(mockTaskEntity)

      // Test searchable feature
      const searchableEntities = registry.getByFeature('searchable')
      expect(searchableEntities).toHaveLength(2)

      // Test bulkOperations feature
      const bulkEntities = registry.getByFeature('bulkOperations')
      expect(bulkEntities).toHaveLength(1)
      expect(bulkEntities[0].slug).toBe('tasks')
    })

    it('should return empty array for non-existent feature', () => {
      registry.register(mockUserEntity)

      const entities = registry.getByFeature('nonExistentFeature' as any)
      expect(entities).toEqual([])
    })
  })

  describe('Child Entity Support', () => {
    it('should detect entities with child entities', () => {
      registry.register(mockUserEntity)
      registry.register(mockTaskEntity)

      const entitiesWithChildren = registry.getAll().filter((e) => e.childEntities)
      expect(entitiesWithChildren).toHaveLength(1)
      expect(entitiesWithChildren[0].slug).toBe('tasks')
    })

    it('should get child entities configuration', () => {
      registry.register(mockTaskEntity)

      const taskEntity = registry.get('tasks')
      expect(taskEntity?.childEntities).toBeDefined()
      expect(taskEntity?.childEntities?.comments).toBeDefined()
      expect(taskEntity?.childEntities?.comments.table).toBe('task_comments')
    })

    it('should get specific child entity configuration', () => {
      registry.register(mockTaskEntity)

      const taskEntity = registry.get('tasks')
      const commentsChild = taskEntity?.childEntities?.comments

      expect(commentsChild).toBeDefined()
      expect(commentsChild?.fields).toHaveLength(1)
      expect(commentsChild?.fields[0].name).toBe('comment')
      expect(commentsChild?.display.title).toBe('Comments')
    })
  })
})
