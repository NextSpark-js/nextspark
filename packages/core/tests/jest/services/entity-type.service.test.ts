/**
 * Unit Tests - EntityTypeService
 *
 * Tests the EntityTypeService static methods that provide runtime entity type queries.
 * This service layer abstracts entity-types registry access (Data-Only pattern).
 *
 * Test Coverage:
 * - isEntityType() - Type guard for entity vs system types
 * - getAllNames() - Get all entity names
 * - getPriority() - Get search priority for types
 * - getSystemTypes() - Get system types array
 * - getMetadata() - Get registry metadata
 * - getCount() - Get total entity count
 * - Backward compatibility exports
 * - Integration tests for cross-method consistency
 */

import {
  EntityTypeService,
  isEntityType,
  getAllEntityNames,
  getSearchTypePriority,
} from '@/core/lib/services/entity-type.service'
import {
  SEARCH_TYPE_PRIORITIES,
  ENTITY_METADATA,
} from '@/core/lib/registries/entity-types'
import type { EntityName, SearchResultType, SystemSearchType } from '@/core/lib/registries/entity-types'

describe('EntityTypeService', () => {
  // Known system types for testing
  const SYSTEM_TYPES: SystemSearchType[] = ['task', 'page', 'setting', 'entity']

  describe('isEntityType', () => {
    it('should return true for valid entity types', () => {
      const entityNames = EntityTypeService.getAllNames()

      entityNames.forEach((name) => {
        expect(EntityTypeService.isEntityType(name)).toBe(true)
      })
    })

    it('should return false for system types', () => {
      SYSTEM_TYPES.forEach((systemType) => {
        expect(EntityTypeService.isEntityType(systemType)).toBe(false)
      })
    })

    it('should return true for known entities from registry', () => {
      // Test specific known entities
      expect(EntityTypeService.isEntityType('customers')).toBe(true)
      expect(EntityTypeService.isEntityType('pages')).toBe(true)
      expect(EntityTypeService.isEntityType('posts')).toBe(true)
      expect(EntityTypeService.isEntityType('tasks')).toBe(true)
    })

    it('should return false for task system type', () => {
      expect(EntityTypeService.isEntityType('task')).toBe(false)
    })

    it('should return false for page system type', () => {
      expect(EntityTypeService.isEntityType('page')).toBe(false)
    })

    it('should return false for setting system type', () => {
      expect(EntityTypeService.isEntityType('setting')).toBe(false)
    })

    it('should return false for entity system type', () => {
      expect(EntityTypeService.isEntityType('entity')).toBe(false)
    })

    it('should handle unknown types as entity types', () => {
      // Unknown types are treated as entities (not in system types list)
      expect(EntityTypeService.isEntityType('unknown-type' as SearchResultType)).toBe(true)
    })
  })

  describe('getAllNames', () => {
    it('should return all entity names', () => {
      const names = EntityTypeService.getAllNames()

      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBeGreaterThan(0)
    })

    it('should return array with correct length matching metadata', () => {
      const names = EntityTypeService.getAllNames()

      expect(names.length).toBe(ENTITY_METADATA.totalEntities)
    })

    it('should include known entities', () => {
      const names = EntityTypeService.getAllNames()

      expect(names).toContain('customers')
      expect(names).toContain('pages')
      expect(names).toContain('posts')
      expect(names).toContain('tasks')
    })

    it('should not include system types', () => {
      const names = EntityTypeService.getAllNames()

      SYSTEM_TYPES.forEach((systemType) => {
        expect(names).not.toContain(systemType)
      })
    })

    it('should return a new array on each call (immutability)', () => {
      const names1 = EntityTypeService.getAllNames()
      const names2 = EntityTypeService.getAllNames()

      expect(names1).not.toBe(names2) // Different references
      expect(names1).toEqual(names2) // Same content
    })

    it('should not mutate original metadata when modified', () => {
      const names = EntityTypeService.getAllNames()
      const originalLength = ENTITY_METADATA.entityNames.length

      // Attempt to mutate
      names.push('fake-entity' as EntityName)

      // Original should be unchanged
      expect(ENTITY_METADATA.entityNames.length).toBe(originalLength)
      expect(ENTITY_METADATA.entityNames).not.toContain('fake-entity')
    })
  })

  describe('getPriority', () => {
    it('should return priority for valid entity types', () => {
      const entityNames = EntityTypeService.getAllNames()

      entityNames.forEach((name) => {
        const priority = EntityTypeService.getPriority(name)
        expect(typeof priority).toBe('number')
        expect(priority).toBeGreaterThan(0)
      })
    })

    it('should return priority for system types', () => {
      expect(EntityTypeService.getPriority('task')).toBe(1)
      expect(EntityTypeService.getPriority('setting')).toBe(3)
      expect(EntityTypeService.getPriority('page')).toBe(5)
      expect(EntityTypeService.getPriority('entity')).toBe(7)
    })

    it('should return 0 for unknown types', () => {
      expect(EntityTypeService.getPriority('unknown' as SearchResultType)).toBe(0)
      expect(EntityTypeService.getPriority('' as SearchResultType)).toBe(0)
    })

    it('should return higher priority for entities than system types', () => {
      const entityNames = EntityTypeService.getAllNames()
      const maxSystemPriority = Math.max(
        ...SYSTEM_TYPES.map((t) => EntityTypeService.getPriority(t))
      )

      entityNames.forEach((name) => {
        const entityPriority = EntityTypeService.getPriority(name)
        expect(entityPriority).toBeGreaterThan(maxSystemPriority)
      })
    })

    it('should match SEARCH_TYPE_PRIORITIES data', () => {
      Object.entries(SEARCH_TYPE_PRIORITIES).forEach(([type, priority]) => {
        expect(EntityTypeService.getPriority(type as SearchResultType)).toBe(priority)
      })
    })

    it('should handle all defined priorities', () => {
      // Ensure all priorities from the constant are accessible
      const allTypes = Object.keys(SEARCH_TYPE_PRIORITIES) as SearchResultType[]

      allTypes.forEach((type) => {
        const priority = EntityTypeService.getPriority(type)
        expect(priority).toBe(SEARCH_TYPE_PRIORITIES[type])
      })
    })
  })

  describe('getSystemTypes', () => {
    it('should return array of system types', () => {
      const systemTypes = EntityTypeService.getSystemTypes()

      expect(Array.isArray(systemTypes)).toBe(true)
      expect(systemTypes.length).toBe(4)
    })

    it('should include all known system types', () => {
      const systemTypes = EntityTypeService.getSystemTypes()

      expect(systemTypes).toContain('task')
      expect(systemTypes).toContain('page')
      expect(systemTypes).toContain('setting')
      expect(systemTypes).toContain('entity')
    })

    it('should not include entity types', () => {
      const systemTypes = EntityTypeService.getSystemTypes()
      const entityNames = EntityTypeService.getAllNames()

      entityNames.forEach((name) => {
        expect(systemTypes).not.toContain(name)
      })
    })

    it('should return readonly array', () => {
      const systemTypes = EntityTypeService.getSystemTypes()

      // TypeScript would prevent mutation, but we verify it's the same reference
      expect(systemTypes).toBe(EntityTypeService.getSystemTypes())
    })
  })

  describe('getMetadata', () => {
    it('should return metadata object', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
    })

    it('should include totalEntities', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(metadata.totalEntities).toBeDefined()
      expect(typeof metadata.totalEntities).toBe('number')
      expect(metadata.totalEntities).toBeGreaterThan(0)
    })

    it('should include entityNames array', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(Array.isArray(metadata.entityNames)).toBe(true)
      expect(metadata.entityNames.length).toBe(metadata.totalEntities)
    })

    it('should include generatedAt timestamp', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(metadata.generatedAt).toBeDefined()
      expect(typeof metadata.generatedAt).toBe('string')
      // Should be a valid ISO date string
      expect(() => new Date(metadata.generatedAt)).not.toThrow()
    })

    it('should include source', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(metadata.source).toBe('build-registry.mjs')
    })

    it('should match ENTITY_METADATA constant', () => {
      const metadata = EntityTypeService.getMetadata()

      expect(metadata).toBe(ENTITY_METADATA)
    })
  })

  describe('getCount', () => {
    it('should return total entity count', () => {
      const count = EntityTypeService.getCount()

      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThan(0)
    })

    it('should match metadata totalEntities', () => {
      const count = EntityTypeService.getCount()

      expect(count).toBe(ENTITY_METADATA.totalEntities)
    })

    it('should match getAllNames length', () => {
      const count = EntityTypeService.getCount()
      const names = EntityTypeService.getAllNames()

      expect(count).toBe(names.length)
    })
  })

  describe('Backward Compatibility Exports', () => {
    describe('isEntityType function export', () => {
      it('should be an alias for EntityTypeService.isEntityType', () => {
        expect(isEntityType('customers')).toBe(EntityTypeService.isEntityType('customers'))
        expect(isEntityType('page')).toBe(EntityTypeService.isEntityType('page'))
      })

      it('should work with all entity types', () => {
        const names = EntityTypeService.getAllNames()
        names.forEach((name) => {
          expect(isEntityType(name)).toBe(true)
        })
      })

      it('should work with all system types', () => {
        SYSTEM_TYPES.forEach((type) => {
          expect(isEntityType(type)).toBe(false)
        })
      })
    })

    describe('getAllEntityNames function export', () => {
      it('should be an alias for EntityTypeService.getAllNames', () => {
        const fromExport = getAllEntityNames()
        const fromService = EntityTypeService.getAllNames()

        expect(fromExport).toEqual(fromService)
      })

      it('should return all entity names', () => {
        const names = getAllEntityNames()

        expect(names).toContain('customers')
        expect(names).toContain('pages')
        expect(names).toContain('posts')
        expect(names).toContain('tasks')
      })
    })

    describe('getSearchTypePriority function export', () => {
      it('should be an alias for EntityTypeService.getPriority', () => {
        expect(getSearchTypePriority('customers')).toBe(EntityTypeService.getPriority('customers'))
        expect(getSearchTypePriority('page')).toBe(EntityTypeService.getPriority('page'))
        expect(getSearchTypePriority('unknown' as SearchResultType)).toBe(
          EntityTypeService.getPriority('unknown' as SearchResultType)
        )
      })

      it('should return correct priorities', () => {
        expect(getSearchTypePriority('task')).toBe(1)
        expect(getSearchTypePriority('page')).toBe(5)
      })
    })
  })

  describe('Integration - Cross-method consistency', () => {
    it('getAllNames results should all pass isEntityType', () => {
      const names = EntityTypeService.getAllNames()

      names.forEach((name) => {
        expect(EntityTypeService.isEntityType(name)).toBe(true)
      })
    })

    it('all entity names should have priority > 0', () => {
      const names = EntityTypeService.getAllNames()

      names.forEach((name) => {
        expect(EntityTypeService.getPriority(name)).toBeGreaterThan(0)
      })
    })

    it('system types should not pass isEntityType', () => {
      const systemTypes = EntityTypeService.getSystemTypes()

      systemTypes.forEach((type) => {
        expect(EntityTypeService.isEntityType(type)).toBe(false)
      })
    })

    it('system types should have priority > 0', () => {
      const systemTypes = EntityTypeService.getSystemTypes()

      systemTypes.forEach((type) => {
        expect(EntityTypeService.getPriority(type)).toBeGreaterThan(0)
      })
    })

    it('getCount should equal getAllNames length', () => {
      expect(EntityTypeService.getCount()).toBe(EntityTypeService.getAllNames().length)
    })

    it('metadata entityNames should match getAllNames', () => {
      const metadata = EntityTypeService.getMetadata()
      const names = EntityTypeService.getAllNames()

      expect(metadata.entityNames).toEqual(names)
    })

    it('total types (entities + system) should match SEARCH_TYPE_PRIORITIES keys', () => {
      const entityNames = EntityTypeService.getAllNames()
      const systemTypes = EntityTypeService.getSystemTypes()
      const allTypes = [...entityNames, ...systemTypes]
      const priorityKeys = Object.keys(SEARCH_TYPE_PRIORITIES)

      expect(allTypes.length).toBe(priorityKeys.length)
      allTypes.forEach((type) => {
        expect(priorityKeys).toContain(type)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string gracefully', () => {
      expect(EntityTypeService.getPriority('' as SearchResultType)).toBe(0)
      expect(EntityTypeService.isEntityType('' as SearchResultType)).toBe(true) // Not in system types
    })

    it('should handle whitespace-only string', () => {
      expect(EntityTypeService.getPriority('   ' as SearchResultType)).toBe(0)
    })

    it('should handle special characters in type', () => {
      expect(EntityTypeService.getPriority('test-type' as SearchResultType)).toBe(0)
      expect(EntityTypeService.getPriority('test_type' as SearchResultType)).toBe(0)
    })

    it('should be case-sensitive', () => {
      // Uppercase versions should not match
      expect(EntityTypeService.getPriority('CUSTOMERS' as SearchResultType)).toBe(0)
      expect(EntityTypeService.getPriority('Page' as SearchResultType)).toBe(0)
      expect(EntityTypeService.isEntityType('PAGE' as SearchResultType)).toBe(true) // Not in system types
    })
  })
})
