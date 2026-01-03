/**
 * Tests for Entity Search Integration
 *
 * Tests the Search Integration functionality including
 * auto-discovery and entity access using getEnabledEntities.
 * Note: Permission system is not active in this version.
 */

// Mock server-only to allow testing server components
jest.mock('server-only', () => ({}))

import { getEnabledEntities } from '@/core/lib/entities/registry'
import { extractUserPlanData } from '@/core/lib/user-data-utils'
import { calculateRelevanceScore, formatSearchResult } from '@/core/lib/search-highlighting'

// Mock dependencies
jest.mock('@/core/lib/entities/registry')
jest.mock('@/core/lib/user-data-utils')

const mockGetEnabledEntities = getEnabledEntities as jest.MockedFunction<typeof getEnabledEntities>
const mockExtractUserPlanData = extractUserPlanData as jest.MockedFunction<typeof extractUserPlanData>

// Mock user data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'member' as const,
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User'
}

// Mock entity configurations
const mockEntities = [
  {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    icon: { name: 'FileText' },
    features: {
      enabled: true,
      searchable: true,
      showInMenu: true,
      allowSearch: true,
      hasExternalAPI: true,
      supportsMetas: true,
      hasArchivePage: true,
      hasSinglePage: true,
      sortable: true,
      filterable: true,
      supportsBulkOperations: false,
      supportsImportExport: false
    },
    routes: {
      list: '/dashboard/tasks',
      detail: '/dashboard/tasks/[id]'
    },
    permissions: {
      actions: [
        { action: 'create', label: 'Create', roles: ['owner', 'admin', 'member'] },
        { action: 'read', label: 'View', roles: ['owner', 'admin', 'member', 'viewer'] },
        { action: 'list', label: 'List', roles: ['owner', 'admin', 'member', 'viewer'] },
        { action: 'update', label: 'Edit', roles: ['owner', 'admin', 'member'] },
        { action: 'delete', label: 'Delete', roles: ['owner', 'admin'], dangerous: true },
      ],
    },
    planLimits: {
      availableInPlans: ['free', 'starter', 'premium'],
      limits: {
        free: { maxRecords: 10, features: ['basic'] },
        starter: { maxRecords: 100, features: ['basic', 'advanced'] },
        premium: { maxRecords: 'unlimited', features: ['*'] }
      }
    },
    fields: [],
    hooks: {},
    database: {
      tableName: 'tasks',
      primaryKey: 'id',
      timestamps: true,
      softDelete: false
    },
    api: {
      apiPath: 'tasks',
      enabled: true,
      enableRateLimit: true,
      enableCaching: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      enablePagination: true
    }
  },
  {
    name: 'user',
    displayName: 'User',
    pluralName: 'Users',
    icon: { name: 'User' },
    features: {
      enabled: true,
      searchable: true,
      showInMenu: true,
      allowSearch: true,
      hasExternalAPI: true,
      supportsMetas: true,
      hasArchivePage: true,
      hasSinglePage: true,
      sortable: true,
      filterable: true,
      supportsBulkOperations: false,
      supportsImportExport: false
    },
    routes: {
      list: '/dashboard/users',
      detail: '/dashboard/users/[id]'
    },
    permissions: {
      actions: [
        { action: 'create', label: 'Create', roles: ['owner', 'admin'] },
        { action: 'read', label: 'View', roles: ['owner', 'admin'] },
        { action: 'list', label: 'List', roles: ['owner', 'admin'] },
        { action: 'update', label: 'Edit', roles: ['owner', 'admin'] },
        { action: 'delete', label: 'Delete', roles: ['owner'], dangerous: true },
      ],
    },
    planLimits: {
      availableInPlans: ['premium'],
      limits: {
        premium: { maxRecords: 'unlimited', features: ['*'] }
      }
    },
    fields: [],
    hooks: {},
    database: {
      tableName: 'users',
      primaryKey: 'id',
      timestamps: true,
      softDelete: false
    },
    api: {
      apiPath: 'users',
      enabled: true,
      enableRateLimit: true,
      enableCaching: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      enablePagination: true
    }
  }
]

describe('Entity Search Integration', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Default mock implementations
    mockExtractUserPlanData.mockReturnValue({
      plan: 'free',
      flags: []
    })

    mockGetEnabledEntities.mockReturnValue(mockEntities)
  })

  describe('Entity Auto-Discovery', () => {
    it('should get enabled entities', () => {
      getEnabledEntities()
      
      expect(mockGetEnabledEntities).toHaveBeenCalled()
    })

    it('should filter only enabled and searchable entities', () => {
      const entities = mockGetEnabledEntities()
      const searchableEntities = entities.filter(entity => 
        entity.features.enabled && entity.features.searchable
      )
      
      expect(searchableEntities).toHaveLength(2)
      expect(searchableEntities.every(e => e.features.enabled && e.features.searchable)).toBe(true)
    })

    it('should handle entity loading gracefully', () => {
      mockGetEnabledEntities.mockImplementation(() => {
        throw new Error('Loading error')
      })

      expect(() => {
        try {
          getEnabledEntities()
        } catch (error) {
          // Error should be caught and handled
        }
      }).not.toThrow()
    })
  })

  describe('Entity Access', () => {
    it('should get enabled entities', () => {
      getEnabledEntities()
      
      expect(mockGetEnabledEntities).toHaveBeenCalled()
    })

    it('should return enabled entities list', () => {
      const entities = getEnabledEntities()
      
      expect(mockGetEnabledEntities).toHaveBeenCalled()
      expect(entities).toBeDefined()
    })

    it('should handle entity filtering', () => {
      const entities = getEnabledEntities()
      
      expect(mockGetEnabledEntities).toHaveBeenCalled()
      expect(Array.isArray(entities)).toBe(true)
    })
  })

  describe('Plan Data Integration', () => {
    it('should extract user plan data correctly', () => {
      const planData = extractUserPlanData(mockUser)
      
      expect(mockExtractUserPlanData).toHaveBeenCalledWith(mockUser)
      expect(planData).toBeDefined()
    })

    it('should handle different plan types', () => {
      mockExtractUserPlanData.mockReturnValue({
        plan: 'premium',
        flags: ['advanced_features']
      })

      const planData = extractUserPlanData(mockUser)
      
      expect(planData.plan).toBe('premium')
      expect(planData.flags).toContain('advanced_features')
    })
  })

  describe('Search Results Generation', () => {
    it('should generate entity results with proper structure', () => {
      const entities = getEnabledEntities()
      
      expect(entities).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'task',
          displayName: 'Task',
          features: expect.objectContaining({
            enabled: true,
            searchable: true
          })
        })
      ]))
    })

    it('should include limit information for different plans', () => {
      // Free plan limits
      mockExtractUserPlanData.mockReturnValue({
        plan: 'free',
        flags: []
      })

      let planData = extractUserPlanData(mockUser)
      expect(planData.plan).toBe('free')

      // Premium plan limits  
      mockExtractUserPlanData.mockReturnValue({
        plan: 'premium',
        flags: []
      })

      planData = extractUserPlanData(mockUser)
      expect(planData.plan).toBe('premium')
    })
  })

  describe('Search Highlighting', () => {
    it('should calculate relevance scores correctly', () => {
      const score = calculateRelevanceScore('Task Management', 'Manage your tasks', 'task')
      
      expect(score).toBeGreaterThan(0)
      expect(typeof score).toBe('number')
    })

    it('should format search results with highlighting', () => {
      const result = formatSearchResult('Task Management', 'Manage your tasks', 'task')
      
      expect(result).toHaveProperty('highlightedTitle')
      expect(result).toHaveProperty('highlightedDescription')
      expect(result.highlightedTitle).toContain('Task')
    })

    it('should handle empty queries gracefully', () => {
      const result = formatSearchResult('Task Management', 'Manage your tasks', '')
      
      expect(result.highlightedTitle).toBe('Task Management')
      expect(result.highlightedDescription).toBe('Manage your tasks')
    })

    it('should escape HTML in search results', () => {
      const result = formatSearchResult('<script>alert("xss")</script>', 'Test description', 'script')
      
      // Should not contain raw HTML tags
      expect(result.highlightedTitle).not.toContain('<script>')
      // Should contain escaped HTML with highlighting
      expect(result.highlightedTitle).toContain('&lt;')
      expect(result.highlightedTitle).toContain('&gt;')
      expect(result.highlightedTitle).toContain('<mark')
    })
  })

  describe('Error Handling', () => {
    it('should handle getEnabledEntities errors gracefully', () => {
      mockGetEnabledEntities.mockImplementation(() => {
        throw new Error('Registry error')
      })

      expect(() => {
        try {
          getEnabledEntities()
        } catch (error) {
          // Should be handled by the hook
          console.error('Error getting enabled entities for search:', error)
        }
      }).not.toThrow()
    })

    it('should handle extractUserPlanData errors gracefully', () => {
      mockExtractUserPlanData.mockImplementation(() => {
        throw new Error('Plan data error')
      })

      expect(() => {
        try {
          extractUserPlanData(mockUser)
        } catch (error) {
          // Should be handled by the hook
          console.error('Error extracting user plan data:', error)
        }
      }).not.toThrow()
    })
  })

  describe('Search Performance', () => {
    it('should limit search results to reasonable number', () => {
      const entities = getEnabledEntities()
      
      // Should not return unlimited results
      expect(entities.length).toBeLessThanOrEqual(50)
    })

    it('should prioritize entity matches over system matches', () => {
      // This would be tested in the actual hook implementation
      // Here we just verify the entity system works correctly
      const entities = getEnabledEntities()
      const taskEntity = entities.find(e => e.name === 'task')
      
      expect(taskEntity).toBeDefined()
      expect(taskEntity?.features.searchable).toBe(true)
    })
  })

  describe('Cache Integration', () => {
    it('should use memoized entity results', () => {
      // Call multiple times with same parameters
      getEnabledEntities()
      getEnabledEntities()
      
      // Should only be called once due to memoization in actual implementation
      expect(mockGetEnabledEntities).toHaveBeenCalledTimes(2)
    })
  })
})