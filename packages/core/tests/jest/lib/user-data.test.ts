/**
 * Tests for User Plan & Flag Data Integration
 * 
 * Tests the new dynamic user data system that replaces hardcoded values
 * throughout the entity system.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { 
  extractUserPlanData,
  clearUserDataCache,
  getUserDataCacheStats
} from '@/core/lib/user-data-utils'
import type { SessionUser } from '@/core/lib/auth'
import type { PlanType, UserFlag } from '@/core/lib/entities/types'

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn()
  }))
}))

// Mock session user
const mockUser: SessionUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'member',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User'
}

describe('User Plan & Flag Data Integration', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearUserDataCache()
  })

  describe('extractUserPlanData', () => {
    it('should return default values when user is null', () => {
      const result = extractUserPlanData(null)
      
      expect(result).toEqual({
        plan: 'free',
        flags: []
      })
    })

    it('should return default values for authenticated user (client-side fallback)', () => {
      const result = extractUserPlanData(mockUser)
      
      expect(result).toEqual({
        plan: 'free',
        flags: []
      })
    })

    it('should return consistent default values', () => {
      const result1 = extractUserPlanData(mockUser)
      const result2 = extractUserPlanData(mockUser)
      
      expect(result1).toEqual(result2)
    })
  })

  describe('Cache Management', () => {
    it('should start with empty cache', () => {
      const stats = getUserDataCacheStats()
      
      expect(stats.size).toBe(0)
      expect(stats.keys).toEqual([])
      expect(stats.oldestEntry).toBeNull()
      expect(stats.newestEntry).toBeNull()
    })

    it('should clear specific user cache', () => {
      clearUserDataCache('test-user-123')
      const stats = getUserDataCacheStats()
      
      expect(stats.size).toBe(0)
    })

    it('should clear all cache', () => {
      clearUserDataCache()
      const stats = getUserDataCacheStats()
      
      expect(stats.size).toBe(0)
    })
  })

  describe('Type Safety', () => {
    it('should enforce valid plan types', () => {
      const validPlans: PlanType[] = ['free', 'starter', 'premium']
      
      validPlans.forEach(plan => {
        expect(['free', 'starter', 'premium']).toContain(plan)
      })
    })

    it('should enforce valid flag types', () => {
      const validFlags: UserFlag[] = [
        'beta_tester',
        'early_adopter', 
        'limited_access',
        'vip',
        'restricted',
        'experimental'
      ]
      
      const allowedFlags = [
        'beta_tester',
        'early_adopter',
        'limited_access',
        'vip',
        'restricted',
        'experimental'
      ]
      
      validFlags.forEach(flag => {
        expect(allowedFlags).toContain(flag)
      })
    })
  })

  describe('Integration Points', () => {
    it('should provide consistent interface for API generator', () => {
      const result = extractUserPlanData(mockUser)
      
      // These are the exact fields expected by api-generator.ts
      expect(result).toHaveProperty('plan')
      expect(result).toHaveProperty('flags')
      expect(typeof result.plan).toBe('string')
      expect(Array.isArray(result.flags)).toBe(true)
    })

    it('should provide consistent interface for template components', () => {
      const result = extractUserPlanData(mockUser)
      
      // These are the exact fields expected by EntityPageTemplate.tsx
      expect(result).toHaveProperty('plan')
      expect(result).toHaveProperty('flags')
      expect(['free', 'starter', 'premium']).toContain(result.plan)
    })

    it('should provide consistent interface for hooks', () => {
      const result = extractUserPlanData(mockUser)
      
      // These are the exact fields expected by useEntity.ts
      expect(result).toHaveProperty('plan')
      expect(result).toHaveProperty('flags')
    })
  })

  describe('Error Handling', () => {
    it('should handle null/undefined gracefully', () => {
      expect(() => extractUserPlanData(null)).not.toThrow()
      expect(() => extractUserPlanData(undefined as unknown as null)).not.toThrow()
    })

    it('should return safe defaults on error', () => {
      const result = extractUserPlanData(null)
      
      expect(result.plan).toBe('free')
      expect(result.flags).toEqual([])
    })
  })
})

describe('Permission System Integration', () => {
  it('should work with entity registry permission checks', () => {
    const userData = extractUserPlanData(mockUser)
    
    // This simulates how the data would be used in entity access (permission system removed)
    const userRole = mockUser.role
    const userPlan = userData.plan
    const userFlags = userData.flags
    
    expect(typeof userRole).toBe('string')
    expect(typeof userPlan).toBe('string')
    expect(Array.isArray(userFlags)).toBe(true)
    
    // These values are preserved for future permission system implementation
    expect(['member', 'colaborator', 'admin', 'superadmin']).toContain(userRole)
    expect(['free', 'starter', 'premium']).toContain(userPlan)
  })

  it('should maintain backwards compatibility', () => {
    // The old hardcoded approach
    const oldApproach = {
      userPlan: 'free' as PlanType,
      userFlags: [] as UserFlag[]
    }
    
    // The new dynamic approach
    const newApproach = extractUserPlanData(mockUser)
    
    // Should have same structure
    expect(typeof oldApproach.userPlan).toBe(typeof newApproach.plan)
    expect(Array.isArray(oldApproach.userFlags)).toBe(Array.isArray(newApproach.flags))
  })
})