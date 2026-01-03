/**
 * Unit Tests - NamespaceService
 *
 * Tests the NamespaceService static methods that provide runtime i18n namespace queries.
 * This service layer abstracts namespace-registry access (Data-Only pattern).
 *
 * Test Coverage:
 * - getCoreNamespaces() - Get core namespace names
 * - getEntityNamespaces() - Get entity namespace names
 * - getOptimizedNamespaces() - Get namespaces for a strategy
 * - detectRouteStrategy() - Detect strategy from pathname
 * - getEntityPaths() - Get entity paths
 * - getStrategies() - Get all strategies
 * - hasStrategy() - Check if strategy exists
 * - getConfig() - Get full configuration
 * - Backward compatibility exports
 * - Integration tests for cross-method consistency
 */

import {
  NamespaceService,
  getCoreNamespaces,
  getEntityNamespaces,
  getOptimizedNamespaces,
  detectRouteStrategy,
  getEntityNamespacePaths,
} from '@/core/lib/services/namespace.service'
import { NAMESPACE_CONFIG } from '@/core/lib/registries/namespace-registry'
import type { RouteStrategy } from '@/core/lib/services/namespace.service'

describe('NamespaceService', () => {
  // Known route strategies
  const KNOWN_STRATEGIES: RouteStrategy[] = [
    'DASHBOARD_AUTHENTICATED',
    'AUTH_ONLY',
    'PUBLIC_INITIAL',
    'SUPERADMIN',
    'UNKNOWN_FALLBACK',
  ]

  describe('getCoreNamespaces', () => {
    it('should return core namespaces array', () => {
      const namespaces = NamespaceService.getCoreNamespaces()

      expect(Array.isArray(namespaces)).toBe(true)
      expect(namespaces.length).toBeGreaterThan(0)
    })

    it('should include required namespaces', () => {
      const namespaces = NamespaceService.getCoreNamespaces()

      expect(namespaces).toContain('common')
      expect(namespaces).toContain('dashboard')
      expect(namespaces).toContain('settings')
      expect(namespaces).toContain('auth')
    })

    it('should match NAMESPACE_CONFIG.core', () => {
      const namespaces = NamespaceService.getCoreNamespaces()

      expect(namespaces).toEqual(NAMESPACE_CONFIG.core)
    })

    it('should return a new array on each call (immutability)', () => {
      const namespaces1 = NamespaceService.getCoreNamespaces()
      const namespaces2 = NamespaceService.getCoreNamespaces()

      expect(namespaces1).not.toBe(namespaces2) // Different references
      expect(namespaces1).toEqual(namespaces2) // Same content
    })

    it('should not mutate original config when modified', () => {
      const namespaces = NamespaceService.getCoreNamespaces()
      const originalLength = NAMESPACE_CONFIG.core.length

      // Attempt to mutate
      namespaces.push('fake-namespace')

      // Original should be unchanged
      expect(NAMESPACE_CONFIG.core.length).toBe(originalLength)
      expect(NAMESPACE_CONFIG.core).not.toContain('fake-namespace')
    })
  })

  describe('getEntityNamespaces', () => {
    it('should return entity namespaces array', () => {
      const namespaces = NamespaceService.getEntityNamespaces()

      expect(Array.isArray(namespaces)).toBe(true)
    })

    it('should match NAMESPACE_CONFIG.entities', () => {
      const namespaces = NamespaceService.getEntityNamespaces()

      expect(namespaces).toEqual(NAMESPACE_CONFIG.entities)
    })

    it('should return empty array if no entities configured', () => {
      const namespaces = NamespaceService.getEntityNamespaces()

      // Current config has empty entities
      if (NAMESPACE_CONFIG.entities.length === 0) {
        expect(namespaces).toEqual([])
      }
    })

    it('should return a new array on each call (immutability)', () => {
      const namespaces1 = NamespaceService.getEntityNamespaces()
      const namespaces2 = NamespaceService.getEntityNamespaces()

      expect(namespaces1).not.toBe(namespaces2)
      expect(namespaces1).toEqual(namespaces2)
    })
  })

  describe('getOptimizedNamespaces', () => {
    it('should return config for DASHBOARD_AUTHENTICATED', () => {
      const config = NamespaceService.getOptimizedNamespaces('DASHBOARD_AUTHENTICATED')

      expect(config).toBeDefined()
      expect(config.strategy).toBe('DASHBOARD_AUTHENTICATED')
      expect(Array.isArray(config.core)).toBe(true)
      expect(Array.isArray(config.entities)).toBe(true)
    })

    it('should return config for AUTH_ONLY', () => {
      const config = NamespaceService.getOptimizedNamespaces('AUTH_ONLY')

      expect(config.strategy).toBe('AUTH_ONLY')
      expect(config.core).toContain('auth')
      expect(config.core).toContain('common')
    })

    it('should return config for PUBLIC_INITIAL', () => {
      const config = NamespaceService.getOptimizedNamespaces('PUBLIC_INITIAL')

      expect(config.strategy).toBe('PUBLIC_INITIAL')
      expect(config.core).toContain('common')
      expect(config.core).toContain('public')
    })

    it('should return config for SUPERADMIN', () => {
      const config = NamespaceService.getOptimizedNamespaces('SUPERADMIN')

      expect(config.strategy).toBe('SUPERADMIN')
      expect(config.core).toContain('superadmin')
    })

    it('should return config for UNKNOWN_FALLBACK', () => {
      const config = NamespaceService.getOptimizedNamespaces('UNKNOWN_FALLBACK')

      expect(config.strategy).toBe('UNKNOWN_FALLBACK')
      expect(config.core).toContain('common')
    })

    it('should fallback to UNKNOWN_FALLBACK for invalid strategy', () => {
      const config = NamespaceService.getOptimizedNamespaces('INVALID_STRATEGY')

      expect(config.strategy).toBe('UNKNOWN_FALLBACK')
    })

    it('should fallback for empty string strategy', () => {
      const config = NamespaceService.getOptimizedNamespaces('')

      expect(config.strategy).toBe('UNKNOWN_FALLBACK')
    })

    it('should handle all known strategies', () => {
      KNOWN_STRATEGIES.forEach((strategy) => {
        const config = NamespaceService.getOptimizedNamespaces(strategy)
        expect(config.strategy).toBe(strategy)
      })
    })
  })

  describe('detectRouteStrategy', () => {
    describe('DASHBOARD_AUTHENTICATED routes', () => {
      it('should detect /dashboard', () => {
        expect(NamespaceService.detectRouteStrategy('/dashboard')).toBe('DASHBOARD_AUTHENTICATED')
      })

      it('should detect /dashboard/tasks', () => {
        expect(NamespaceService.detectRouteStrategy('/dashboard/tasks')).toBe(
          'DASHBOARD_AUTHENTICATED'
        )
      })

      it('should detect /dashboard/settings/profile', () => {
        expect(NamespaceService.detectRouteStrategy('/dashboard/settings/profile')).toBe(
          'DASHBOARD_AUTHENTICATED'
        )
      })

      it('should detect any /dashboard/* path', () => {
        expect(NamespaceService.detectRouteStrategy('/dashboard/any/nested/path')).toBe(
          'DASHBOARD_AUTHENTICATED'
        )
      })
    })

    describe('AUTH_ONLY routes', () => {
      it('should detect /auth', () => {
        expect(NamespaceService.detectRouteStrategy('/auth')).toBe('AUTH_ONLY')
      })

      it('should detect /auth/callback', () => {
        expect(NamespaceService.detectRouteStrategy('/auth/callback')).toBe('AUTH_ONLY')
      })

      it('should detect /login', () => {
        expect(NamespaceService.detectRouteStrategy('/login')).toBe('AUTH_ONLY')
      })

      it('should detect /signup', () => {
        expect(NamespaceService.detectRouteStrategy('/signup')).toBe('AUTH_ONLY')
      })

      it('should detect /forgot-password', () => {
        expect(NamespaceService.detectRouteStrategy('/forgot-password')).toBe('AUTH_ONLY')
      })

      it('should detect /reset-password', () => {
        expect(NamespaceService.detectRouteStrategy('/reset-password')).toBe('AUTH_ONLY')
      })

      it('should detect /verify-email', () => {
        expect(NamespaceService.detectRouteStrategy('/verify-email')).toBe('AUTH_ONLY')
      })
    })

    describe('PUBLIC_INITIAL routes', () => {
      it('should detect /', () => {
        expect(NamespaceService.detectRouteStrategy('/')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /pricing', () => {
        expect(NamespaceService.detectRouteStrategy('/pricing')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /pricing/enterprise', () => {
        expect(NamespaceService.detectRouteStrategy('/pricing/enterprise')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /docs', () => {
        expect(NamespaceService.detectRouteStrategy('/docs')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /docs/getting-started', () => {
        expect(NamespaceService.detectRouteStrategy('/docs/getting-started')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /support', () => {
        expect(NamespaceService.detectRouteStrategy('/support')).toBe('PUBLIC_INITIAL')
      })

      it('should detect /features', () => {
        expect(NamespaceService.detectRouteStrategy('/features')).toBe('PUBLIC_INITIAL')
      })

      it('should detect entity paths when configured', () => {
        // Test the entityPaths.some() branch by temporarily modifying the config
        const originalEntityPaths = [...NAMESPACE_CONFIG.entityPaths]

        // Add a test entity path
        NAMESPACE_CONFIG.entityPaths.push('/products')

        try {
          // Should detect as PUBLIC_INITIAL when pathname starts with an entity path
          expect(NamespaceService.detectRouteStrategy('/products')).toBe('PUBLIC_INITIAL')
          expect(NamespaceService.detectRouteStrategy('/products/123')).toBe('PUBLIC_INITIAL')
          expect(NamespaceService.detectRouteStrategy('/products/category/electronics')).toBe('PUBLIC_INITIAL')
        } finally {
          // Restore original state
          NAMESPACE_CONFIG.entityPaths.length = 0
          NAMESPACE_CONFIG.entityPaths.push(...originalEntityPaths)
        }
      })
    })

    describe('SUPERADMIN routes', () => {
      it('should detect /superadmin', () => {
        expect(NamespaceService.detectRouteStrategy('/superadmin')).toBe('SUPERADMIN')
      })

      it('should detect /superadmin/users', () => {
        expect(NamespaceService.detectRouteStrategy('/superadmin/users')).toBe('SUPERADMIN')
      })

      it('should detect /superadmin/teams', () => {
        expect(NamespaceService.detectRouteStrategy('/superadmin/teams')).toBe('SUPERADMIN')
      })
    })

    describe('UNKNOWN_FALLBACK routes', () => {
      it('should fallback for unknown routes', () => {
        expect(NamespaceService.detectRouteStrategy('/unknown')).toBe('UNKNOWN_FALLBACK')
      })

      it('should fallback for /about', () => {
        expect(NamespaceService.detectRouteStrategy('/about')).toBe('UNKNOWN_FALLBACK')
      })

      it('should fallback for /contact', () => {
        expect(NamespaceService.detectRouteStrategy('/contact')).toBe('UNKNOWN_FALLBACK')
      })

      it('should fallback for random paths', () => {
        expect(NamespaceService.detectRouteStrategy('/random/path')).toBe('UNKNOWN_FALLBACK')
      })
    })

    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(NamespaceService.detectRouteStrategy('')).toBe('UNKNOWN_FALLBACK')
      })

      it('should be case-sensitive', () => {
        // Uppercase should not match
        expect(NamespaceService.detectRouteStrategy('/DASHBOARD')).toBe('UNKNOWN_FALLBACK')
        expect(NamespaceService.detectRouteStrategy('/LOGIN')).toBe('UNKNOWN_FALLBACK')
      })

      it('should handle paths without leading slash', () => {
        // These won't match startsWith patterns correctly
        expect(NamespaceService.detectRouteStrategy('dashboard')).toBe('UNKNOWN_FALLBACK')
      })
    })
  })

  describe('getEntityPaths', () => {
    it('should return entity paths array', () => {
      const paths = NamespaceService.getEntityPaths()

      expect(Array.isArray(paths)).toBe(true)
    })

    it('should match NAMESPACE_CONFIG.entityPaths', () => {
      const paths = NamespaceService.getEntityPaths()

      expect(paths).toEqual(NAMESPACE_CONFIG.entityPaths)
    })

    it('should return a new array on each call (immutability)', () => {
      const paths1 = NamespaceService.getEntityPaths()
      const paths2 = NamespaceService.getEntityPaths()

      expect(paths1).not.toBe(paths2)
      expect(paths1).toEqual(paths2)
    })
  })

  describe('getStrategies', () => {
    it('should return all strategy names', () => {
      const strategies = NamespaceService.getStrategies()

      expect(Array.isArray(strategies)).toBe(true)
      expect(strategies.length).toBe(5)
    })

    it('should include all known strategies', () => {
      const strategies = NamespaceService.getStrategies()

      KNOWN_STRATEGIES.forEach((strategy) => {
        expect(strategies).toContain(strategy)
      })
    })

    it('should match NAMESPACE_CONFIG.routes keys', () => {
      const strategies = NamespaceService.getStrategies()
      const configKeys = Object.keys(NAMESPACE_CONFIG.routes)

      expect(strategies).toEqual(configKeys)
    })
  })

  describe('hasStrategy', () => {
    it('should return true for valid strategies', () => {
      KNOWN_STRATEGIES.forEach((strategy) => {
        expect(NamespaceService.hasStrategy(strategy)).toBe(true)
      })
    })

    it('should return false for invalid strategies', () => {
      expect(NamespaceService.hasStrategy('INVALID')).toBe(false)
      expect(NamespaceService.hasStrategy('')).toBe(false)
      expect(NamespaceService.hasStrategy('dashboard')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(NamespaceService.hasStrategy('dashboard_authenticated')).toBe(false)
      expect(NamespaceService.hasStrategy('Dashboard_Authenticated')).toBe(false)
    })
  })

  describe('getConfig', () => {
    it('should return full namespace configuration', () => {
      const config = NamespaceService.getConfig()

      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    it('should include core property', () => {
      const config = NamespaceService.getConfig()

      expect(Array.isArray(config.core)).toBe(true)
    })

    it('should include entities property', () => {
      const config = NamespaceService.getConfig()

      expect(Array.isArray(config.entities)).toBe(true)
    })

    it('should include routes property', () => {
      const config = NamespaceService.getConfig()

      expect(typeof config.routes).toBe('object')
    })

    it('should include entityPaths property', () => {
      const config = NamespaceService.getConfig()

      expect(Array.isArray(config.entityPaths)).toBe(true)
    })

    it('should match NAMESPACE_CONFIG', () => {
      const config = NamespaceService.getConfig()

      expect(config).toBe(NAMESPACE_CONFIG)
    })
  })

  describe('Backward Compatibility Exports', () => {
    describe('getCoreNamespaces function export', () => {
      it('should be an alias for NamespaceService.getCoreNamespaces', () => {
        const fromExport = getCoreNamespaces()
        const fromService = NamespaceService.getCoreNamespaces()

        expect(fromExport).toEqual(fromService)
      })
    })

    describe('getEntityNamespaces function export', () => {
      it('should be an alias for NamespaceService.getEntityNamespaces', () => {
        const fromExport = getEntityNamespaces()
        const fromService = NamespaceService.getEntityNamespaces()

        expect(fromExport).toEqual(fromService)
      })
    })

    describe('getOptimizedNamespaces function export', () => {
      it('should be an alias for NamespaceService.getOptimizedNamespaces', () => {
        const fromExport = getOptimizedNamespaces('DASHBOARD_AUTHENTICATED')
        const fromService = NamespaceService.getOptimizedNamespaces('DASHBOARD_AUTHENTICATED')

        expect(fromExport).toEqual(fromService)
      })
    })

    describe('detectRouteStrategy function export', () => {
      it('should be an alias for NamespaceService.detectRouteStrategy', () => {
        expect(detectRouteStrategy('/dashboard')).toBe(
          NamespaceService.detectRouteStrategy('/dashboard')
        )
        expect(detectRouteStrategy('/login')).toBe(NamespaceService.detectRouteStrategy('/login'))
      })
    })

    describe('getEntityNamespacePaths function export', () => {
      it('should be an alias for NamespaceService.getEntityPaths', () => {
        const fromExport = getEntityNamespacePaths()
        const fromService = NamespaceService.getEntityPaths()

        expect(fromExport).toEqual(fromService)
      })
    })
  })

  describe('Integration - Cross-method consistency', () => {
    it('detectRouteStrategy + getOptimizedNamespaces should be consistent', () => {
      const testPaths = ['/dashboard', '/login', '/', '/superadmin', '/unknown']

      testPaths.forEach((path) => {
        const strategy = NamespaceService.detectRouteStrategy(path)
        const config = NamespaceService.getOptimizedNamespaces(strategy)

        expect(config.strategy).toBe(strategy)
      })
    })

    it('all strategies from getStrategies should exist in hasStrategy', () => {
      const strategies = NamespaceService.getStrategies()

      strategies.forEach((strategy) => {
        expect(NamespaceService.hasStrategy(strategy)).toBe(true)
      })
    })

    it('all strategies should have valid config in getOptimizedNamespaces', () => {
      const strategies = NamespaceService.getStrategies()

      strategies.forEach((strategy) => {
        const config = NamespaceService.getOptimizedNamespaces(strategy)
        expect(config).toBeDefined()
        expect(config.strategy).toBe(strategy)
        expect(Array.isArray(config.core)).toBe(true)
        expect(Array.isArray(config.entities)).toBe(true)
      })
    })

    it('getCoreNamespaces should match getConfig().core', () => {
      const fromMethod = NamespaceService.getCoreNamespaces()
      const fromConfig = NamespaceService.getConfig().core

      expect(fromMethod).toEqual(fromConfig)
    })

    it('getEntityNamespaces should match getConfig().entities', () => {
      const fromMethod = NamespaceService.getEntityNamespaces()
      const fromConfig = NamespaceService.getConfig().entities

      expect(fromMethod).toEqual(fromConfig)
    })

    it('getEntityPaths should match getConfig().entityPaths', () => {
      const fromMethod = NamespaceService.getEntityPaths()
      const fromConfig = NamespaceService.getConfig().entityPaths

      expect(fromMethod).toEqual(fromConfig)
    })
  })
})
