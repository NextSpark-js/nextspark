/**
 * Unit Tests - ScopeService
 *
 * Tests the ScopeService static methods that provide runtime API scope queries.
 * This service layer abstracts scope-registry access (Data-Only pattern).
 *
 * Test Coverage:
 * - getBaseScopes() - Get base scopes
 * - getRoleScopes() - Get role scopes
 * - getFlagScopes() - Get flag scopes
 * - getAllowedFilters() - Get allowed API filters
 * - getRestrictionRules() - Get restriction rules
 * - getEntityApiPaths() - Get entity API paths
 * - getRoles() - Get all role names
 * - getFlags() - Get all flag names
 * - hasRole() - Check if role exists
 * - hasFlag() - Check if flag exists
 * - getScopeConfig() - Get full scope config
 * - getApiConfig() - Get full API config
 * - Backward compatibility exports
 * - Integration tests for cross-method consistency
 */

import {
  ScopeService,
  getBaseScopes,
  getRoleScopes,
  getFlagScopes,
  getAllowedFilters,
  getRestrictionRules,
  getEntityApiPaths,
} from '@/core/lib/services/scope.service'
import { SCOPE_CONFIG, API_CONFIG } from '@/core/lib/registries/scope-registry'

describe('ScopeService', () => {
  // Known roles from config
  const KNOWN_ROLES = ['superadmin', 'admin', 'manager', 'member']

  // Known flags from config
  const KNOWN_FLAGS = ['beta_tester', 'vip', 'early_adopter', 'power_user']

  // Known restriction flags
  const RESTRICTION_FLAGS = ['restricted', 'limited_access']

  describe('getBaseScopes', () => {
    it('should return base scopes array', () => {
      const scopes = ScopeService.getBaseScopes()

      expect(Array.isArray(scopes)).toBe(true)
    })

    it('should match SCOPE_CONFIG.base', () => {
      const scopes = ScopeService.getBaseScopes()

      expect(scopes).toEqual(SCOPE_CONFIG.base)
    })

    it('should return a new array on each call (immutability)', () => {
      const scopes1 = ScopeService.getBaseScopes()
      const scopes2 = ScopeService.getBaseScopes()

      expect(scopes1).not.toBe(scopes2) // Different references
      expect(scopes1).toEqual(scopes2) // Same content
    })

    it('should not mutate original config when modified', () => {
      const scopes = ScopeService.getBaseScopes()
      const originalLength = SCOPE_CONFIG.base.length

      // Attempt to mutate
      scopes.push('fake:scope')

      // Original should be unchanged
      expect(SCOPE_CONFIG.base.length).toBe(originalLength)
      expect(SCOPE_CONFIG.base).not.toContain('fake:scope')
    })
  })

  describe('getRoleScopes', () => {
    it('should return scopes for superadmin role', () => {
      const scopes = ScopeService.getRoleScopes('superadmin')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('admin:users')
    })

    it('should return scopes for admin role', () => {
      const scopes = ScopeService.getRoleScopes('admin')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('admin:users')
    })

    it('should return empty array for manager role (if empty in config)', () => {
      const scopes = ScopeService.getRoleScopes('manager')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual(SCOPE_CONFIG.roles['manager'])
    })

    it('should return empty array for member role (if empty in config)', () => {
      const scopes = ScopeService.getRoleScopes('member')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual(SCOPE_CONFIG.roles['member'])
    })

    it('should return empty array for invalid role', () => {
      const scopes = ScopeService.getRoleScopes('invalid-role')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual([])
    })

    it('should return empty array for empty string', () => {
      const scopes = ScopeService.getRoleScopes('')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual([])
    })

    it('should be case-sensitive', () => {
      const scopes1 = ScopeService.getRoleScopes('admin')
      const scopes2 = ScopeService.getRoleScopes('ADMIN')

      expect(scopes1).not.toEqual(scopes2)
    })

    it('should return a new array on each call (immutability)', () => {
      const scopes1 = ScopeService.getRoleScopes('admin')
      const scopes2 = ScopeService.getRoleScopes('admin')

      expect(scopes1).not.toBe(scopes2) // Different references
      expect(scopes1).toEqual(scopes2) // Same content
    })
  })

  describe('getFlagScopes', () => {
    it('should return scopes for beta_tester flag', () => {
      const scopes = ScopeService.getFlagScopes('beta_tester')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('beta:features')
    })

    it('should return scopes for vip flag', () => {
      const scopes = ScopeService.getFlagScopes('vip')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('vip:features')
      expect(scopes).toContain('advanced:export')
    })

    it('should return scopes for early_adopter flag', () => {
      const scopes = ScopeService.getFlagScopes('early_adopter')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('early:features')
    })

    it('should return scopes for power_user flag', () => {
      const scopes = ScopeService.getFlagScopes('power_user')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toContain('advanced:features')
      expect(scopes).toContain('bulk:operations')
    })

    it('should return empty array for invalid flag', () => {
      const scopes = ScopeService.getFlagScopes('invalid-flag')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual([])
    })

    it('should return empty array for empty string', () => {
      const scopes = ScopeService.getFlagScopes('')

      expect(Array.isArray(scopes)).toBe(true)
      expect(scopes).toEqual([])
    })

    it('should be case-sensitive', () => {
      const scopes1 = ScopeService.getFlagScopes('vip')
      const scopes2 = ScopeService.getFlagScopes('VIP')

      expect(scopes1).not.toEqual(scopes2)
    })

    it('should return a new array on each call (immutability)', () => {
      const scopes1 = ScopeService.getFlagScopes('vip')
      const scopes2 = ScopeService.getFlagScopes('vip')

      expect(scopes1).not.toBe(scopes2) // Different references
      expect(scopes1).toEqual(scopes2) // Same content
    })
  })

  describe('getAllowedFilters', () => {
    it('should return allowed filters array', () => {
      const filters = ScopeService.getAllowedFilters()

      expect(Array.isArray(filters)).toBe(true)
      expect(filters.length).toBeGreaterThan(0)
    })

    it('should include default filters', () => {
      const filters = ScopeService.getAllowedFilters()

      expect(filters).toContain('status')
      expect(filters).toContain('role')
      expect(filters).toContain('completed')
      expect(filters).toContain('userId')
    })

    it('should match API_CONFIG.filters.allowed', () => {
      const filters = ScopeService.getAllowedFilters()

      expect(filters).toEqual(API_CONFIG.filters.allowed)
    })

    it('should return a new array on each call (immutability)', () => {
      const filters1 = ScopeService.getAllowedFilters()
      const filters2 = ScopeService.getAllowedFilters()

      expect(filters1).not.toBe(filters2) // Different references
      expect(filters1).toEqual(filters2) // Same content
    })

    it('should not mutate original config when modified', () => {
      const filters = ScopeService.getAllowedFilters()
      const originalLength = API_CONFIG.filters.allowed.length

      // Attempt to mutate
      filters.push('fake-filter')

      // Original should be unchanged
      expect(API_CONFIG.filters.allowed.length).toBe(originalLength)
      expect(API_CONFIG.filters.allowed).not.toContain('fake-filter')
    })
  })

  describe('getRestrictionRules', () => {
    it('should return rules for restricted flag', () => {
      const rules = ScopeService.getRestrictionRules('restricted')

      expect(typeof rules).toBe('object')
      expect(rules.remove).toBeDefined()
      expect(rules.remove).toContain('delete')
      expect(rules.remove).toContain('admin')
    })

    it('should return rules for limited_access flag', () => {
      const rules = ScopeService.getRestrictionRules('limited_access')

      expect(typeof rules).toBe('object')
      expect(rules.allow_only).toBeDefined()
      expect(rules.allow_only).toContain('read')
      expect(rules.allow_only).toContain('tasks:write')
    })

    it('should return empty object for invalid flag', () => {
      const rules = ScopeService.getRestrictionRules('invalid-flag')

      expect(typeof rules).toBe('object')
      expect(Object.keys(rules).length).toBe(0)
    })

    it('should return empty object for empty string', () => {
      const rules = ScopeService.getRestrictionRules('')

      expect(typeof rules).toBe('object')
      expect(Object.keys(rules).length).toBe(0)
    })

    it('should match SCOPE_CONFIG.restrictions for known flags', () => {
      for (const flag of RESTRICTION_FLAGS) {
        const rules = ScopeService.getRestrictionRules(flag)
        expect(rules).toEqual(SCOPE_CONFIG.restrictions[flag])
      }
    })
  })

  describe('getEntityApiPaths', () => {
    it('should return entity API paths array', () => {
      const paths = ScopeService.getEntityApiPaths()

      expect(Array.isArray(paths)).toBe(true)
    })

    it('should match API_CONFIG.entityPaths', () => {
      const paths = ScopeService.getEntityApiPaths()

      expect(paths).toEqual(API_CONFIG.entityPaths)
    })

    it('should return a new array on each call (immutability)', () => {
      const paths1 = ScopeService.getEntityApiPaths()
      const paths2 = ScopeService.getEntityApiPaths()

      expect(paths1).not.toBe(paths2) // Different references
      expect(paths1).toEqual(paths2) // Same content
    })

    it('should not mutate original config when modified', () => {
      const paths = ScopeService.getEntityApiPaths()
      const originalLength = API_CONFIG.entityPaths.length

      // Attempt to mutate
      paths.push('/fake/path')

      // Original should be unchanged
      expect(API_CONFIG.entityPaths.length).toBe(originalLength)
      expect(API_CONFIG.entityPaths).not.toContain('/fake/path')
    })
  })

  describe('getRoles', () => {
    it('should return all role names', () => {
      const roles = ScopeService.getRoles()

      expect(Array.isArray(roles)).toBe(true)
      expect(roles.length).toBeGreaterThan(0)
    })

    it('should include known roles', () => {
      const roles = ScopeService.getRoles()

      for (const role of KNOWN_ROLES) {
        expect(roles).toContain(role)
      }
    })

    it('should match Object.keys(SCOPE_CONFIG.roles)', () => {
      const roles = ScopeService.getRoles()

      expect(roles).toEqual(Object.keys(SCOPE_CONFIG.roles))
    })
  })

  describe('getFlags', () => {
    it('should return all flag names', () => {
      const flags = ScopeService.getFlags()

      expect(Array.isArray(flags)).toBe(true)
      expect(flags.length).toBeGreaterThan(0)
    })

    it('should include known flags', () => {
      const flags = ScopeService.getFlags()

      for (const flag of KNOWN_FLAGS) {
        expect(flags).toContain(flag)
      }
    })

    it('should match Object.keys(SCOPE_CONFIG.flags)', () => {
      const flags = ScopeService.getFlags()

      expect(flags).toEqual(Object.keys(SCOPE_CONFIG.flags))
    })
  })

  describe('hasRole', () => {
    it('should return true for existing roles', () => {
      for (const role of KNOWN_ROLES) {
        expect(ScopeService.hasRole(role)).toBe(true)
      }
    })

    it('should return false for non-existing role', () => {
      expect(ScopeService.hasRole('invalid-role')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(ScopeService.hasRole('')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(ScopeService.hasRole('admin')).toBe(true)
      expect(ScopeService.hasRole('ADMIN')).toBe(false)
    })
  })

  describe('hasFlag', () => {
    it('should return true for existing flags', () => {
      for (const flag of KNOWN_FLAGS) {
        expect(ScopeService.hasFlag(flag)).toBe(true)
      }
    })

    it('should return false for non-existing flag', () => {
      expect(ScopeService.hasFlag('invalid-flag')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(ScopeService.hasFlag('')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(ScopeService.hasFlag('vip')).toBe(true)
      expect(ScopeService.hasFlag('VIP')).toBe(false)
    })
  })

  describe('getScopeConfig', () => {
    it('should return the full scope config', () => {
      const config = ScopeService.getScopeConfig()

      expect(config).toBe(SCOPE_CONFIG)
    })

    it('should have all expected properties', () => {
      const config = ScopeService.getScopeConfig()

      expect(config).toHaveProperty('base')
      expect(config).toHaveProperty('roles')
      expect(config).toHaveProperty('flags')
      expect(config).toHaveProperty('restrictions')
    })

    it('should have arrays for base', () => {
      const config = ScopeService.getScopeConfig()

      expect(Array.isArray(config.base)).toBe(true)
    })

    it('should have objects for roles and flags', () => {
      const config = ScopeService.getScopeConfig()

      expect(typeof config.roles).toBe('object')
      expect(typeof config.flags).toBe('object')
    })
  })

  describe('getApiConfig', () => {
    it('should return the full API config', () => {
      const config = ScopeService.getApiConfig()

      expect(config).toBe(API_CONFIG)
    })

    it('should have all expected properties', () => {
      const config = ScopeService.getApiConfig()

      expect(config).toHaveProperty('filters')
      expect(config).toHaveProperty('entityPaths')
    })

    it('should have filters.allowed array', () => {
      const config = ScopeService.getApiConfig()

      expect(config.filters).toHaveProperty('allowed')
      expect(Array.isArray(config.filters.allowed)).toBe(true)
    })

    it('should have entityPaths array', () => {
      const config = ScopeService.getApiConfig()

      expect(Array.isArray(config.entityPaths)).toBe(true)
    })
  })

  describe('Backward Compatibility Exports', () => {
    it('getBaseScopes function should match ScopeService.getBaseScopes', () => {
      expect(getBaseScopes()).toEqual(ScopeService.getBaseScopes())
    })

    it('getRoleScopes function should match ScopeService.getRoleScopes', () => {
      expect(getRoleScopes('admin')).toEqual(ScopeService.getRoleScopes('admin'))
    })

    it('getFlagScopes function should match ScopeService.getFlagScopes', () => {
      expect(getFlagScopes('vip')).toEqual(ScopeService.getFlagScopes('vip'))
    })

    it('getAllowedFilters function should match ScopeService.getAllowedFilters', () => {
      expect(getAllowedFilters()).toEqual(ScopeService.getAllowedFilters())
    })

    it('getRestrictionRules function should match ScopeService.getRestrictionRules', () => {
      expect(getRestrictionRules('restricted')).toEqual(ScopeService.getRestrictionRules('restricted'))
    })

    it('getEntityApiPaths function should match ScopeService.getEntityApiPaths', () => {
      expect(getEntityApiPaths()).toEqual(ScopeService.getEntityApiPaths())
    })
  })

  describe('Integration Tests - Cross-method consistency', () => {
    it('all roles from getRoles() should return scopes via getRoleScopes()', () => {
      const roles = ScopeService.getRoles()

      for (const role of roles) {
        const scopes = ScopeService.getRoleScopes(role)
        expect(Array.isArray(scopes)).toBe(true)
        // Scopes should match what's in config
        expect(scopes).toEqual(SCOPE_CONFIG.roles[role] || [])
      }
    })

    it('all flags from getFlags() should return scopes via getFlagScopes()', () => {
      const flags = ScopeService.getFlags()

      for (const flag of flags) {
        const scopes = ScopeService.getFlagScopes(flag)
        expect(Array.isArray(scopes)).toBe(true)
        // Scopes should match what's in config
        expect(scopes).toEqual(SCOPE_CONFIG.flags[flag] || [])
      }
    })

    it('hasRole should be consistent with getRoles', () => {
      const roles = ScopeService.getRoles()

      for (const role of roles) {
        expect(ScopeService.hasRole(role)).toBe(true)
      }

      expect(ScopeService.hasRole('nonexistent')).toBe(false)
    })

    it('hasFlag should be consistent with getFlags', () => {
      const flags = ScopeService.getFlags()

      for (const flag of flags) {
        expect(ScopeService.hasFlag(flag)).toBe(true)
      }

      expect(ScopeService.hasFlag('nonexistent')).toBe(false)
    })

    it('getScopeConfig and getApiConfig should contain all data accessible via other methods', () => {
      const scopeConfig = ScopeService.getScopeConfig()
      const apiConfig = ScopeService.getApiConfig()

      // Verify base scopes
      expect(ScopeService.getBaseScopes()).toEqual(scopeConfig.base)

      // Verify roles
      expect(ScopeService.getRoles()).toEqual(Object.keys(scopeConfig.roles))

      // Verify flags
      expect(ScopeService.getFlags()).toEqual(Object.keys(scopeConfig.flags))

      // Verify filters
      expect(ScopeService.getAllowedFilters()).toEqual(apiConfig.filters.allowed)

      // Verify entity paths
      expect(ScopeService.getEntityApiPaths()).toEqual(apiConfig.entityPaths)
    })
  })

  describe('Edge Cases', () => {
    it('should handle whitespace-only inputs', () => {
      expect(ScopeService.getRoleScopes('   ')).toEqual([])
      expect(ScopeService.getFlagScopes('   ')).toEqual([])
      expect(ScopeService.hasRole('   ')).toBe(false)
      expect(ScopeService.hasFlag('   ')).toBe(false)
    })

    it('should handle special characters in inputs', () => {
      expect(ScopeService.getRoleScopes('admin@test')).toEqual([])
      expect(ScopeService.getFlagScopes('vip#1')).toEqual([])
      expect(ScopeService.hasRole('role/test')).toBe(false)
      expect(ScopeService.hasFlag('flag.test')).toBe(false)
    })

    it('should handle undefined-like inputs gracefully', () => {
      // These should not throw
      expect(() => ScopeService.getRoleScopes('undefined')).not.toThrow()
      expect(() => ScopeService.getFlagScopes('null')).not.toThrow()
      expect(() => ScopeService.getRestrictionRules('NaN')).not.toThrow()
    })
  })
})
