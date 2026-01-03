// Mock dual-auth to avoid loading better-auth (ESM issues with @noble/ciphers)
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  hasRequiredScope: jest.fn((authResult: { type: string; scopes?: string[] }, requiredScope: string) => {
    if (authResult.type === 'session') return true
    if (authResult.scopes?.includes(requiredScope)) return true
    if (authResult.scopes?.includes('*')) return true
    if (authResult.scopes?.includes('admin:all')) return true
    return false
  })
}))

// Mock server-only
jest.mock('server-only', () => ({}))

import { isSuperAdmin, hasAdminPermission } from '@/core/lib/api/auth/permissions'
import type { DualAuthResult } from '@/core/lib/api/auth/dual-auth'

describe('Admin API Authentication', () => {
  describe('isSuperAdmin', () => {
    it('should return true for session with superadmin role', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'session',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['all']
      }
      expect(isSuperAdmin(authResult)).toBe(true)
    })

    it('should return false for session with member role', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'session',
        user: { id: '1', role: 'member', email: 'user@test.com' },
        scopes: ['all']
      }
      expect(isSuperAdmin(authResult)).toBe(false)
    })

    it('should return true for API key from superadmin', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['users:read']
      }
      expect(isSuperAdmin(authResult)).toBe(true)
    })

    it('should return false for API key from normal user', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'member', email: 'user@test.com' },
        scopes: ['users:read']
      }
      expect(isSuperAdmin(authResult)).toBe(false)
    })

    it('should return false for failed authentication', () => {
      const authResult: DualAuthResult = {
        success: false,
        type: 'none',
        user: null
      }
      expect(isSuperAdmin(authResult)).toBe(false)
    })

    it('should return false for member role', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'session',
        user: { id: '1', role: 'member', email: 'member@test.com' },
        scopes: ['all']
      }
      expect(isSuperAdmin(authResult)).toBe(false)
    })
  })

  describe('hasAdminPermission', () => {
    it('should allow superadmin session without scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'session',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['all']
      }
      expect(hasAdminPermission(authResult)).toBe(true)
    })

    it('should reject normal user session', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'session',
        user: { id: '1', role: 'member', email: 'user@test.com' },
        scopes: ['all']
      }
      expect(hasAdminPermission(authResult)).toBe(false)
    })

    it('should allow superadmin API key with correct scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['users:read']
      }
      expect(hasAdminPermission(authResult, 'users:read')).toBe(true)
    })

    it('should reject normal user API key even with scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'member', email: 'user@test.com' },
        scopes: ['users:read']
      }
      expect(hasAdminPermission(authResult, 'users:read')).toBe(false)
    })

    it('should reject superadmin API key without required scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['tasks:read']
      }
      expect(hasAdminPermission(authResult, 'users:read')).toBe(false)
    })

    it('should allow superadmin API key with wildcard scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['*']
      }
      expect(hasAdminPermission(authResult, 'users:read')).toBe(true)
    })

    it('should allow superadmin API key with admin:all scope', () => {
      const authResult: DualAuthResult = {
        success: true,
        type: 'api-key',
        user: { id: '1', role: 'superadmin', email: 'admin@test.com' },
        scopes: ['admin:all']
      }
      expect(hasAdminPermission(authResult, 'users:read')).toBe(true)
    })

    it('should reject failed authentication', () => {
      const authResult: DualAuthResult = {
        success: false,
        type: 'none',
        user: null
      }
      expect(hasAdminPermission(authResult)).toBe(false)
    })
  })
})
