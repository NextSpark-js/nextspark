/**
 * Unit Tests - Permission Service
 *
 * Tests the PermissionService static methods that provide runtime
 * permission checking and role-based access control logic.
 *
 * Test Coverage:
 * - PERM_001: hasPermission() for owner role (wildcard)
 * - PERM_002: hasPermission() for other roles
 * - getRolePermissions() returns correct arrays
 * - isValid() validates permission IDs
 * - hasAnyPermission() and hasAllPermissions()
 */

import { PermissionService } from '@/core/lib/services/permission.service'
import type { Permission } from '@/core/lib/permissions/types'

describe('PermissionService', () => {
  describe('hasPermission', () => {
    it('PERM_001: should return true for owner role (owner has all permissions)', () => {
      // Owner has wildcard permission - should have access to everything
      expect(PermissionService.hasPermission('owner', 'customers.create' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('owner', 'customers.delete' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('owner', 'teams.invite' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('owner', 'settings.billing' as Permission)).toBe(true)
    })

    it('PERM_002: should return correct result for admin role', () => {
      // Admin should have most permissions except owner-only ones
      expect(PermissionService.hasPermission('admin', 'customers.create' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('admin', 'customers.read' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('admin', 'teams.invite' as Permission)).toBe(true)

      // Billing is owner-only
      expect(PermissionService.hasPermission('admin', 'settings.billing' as Permission)).toBe(false)
    })

    it('PERM_002: should return correct result for member role', () => {
      // Member should have read permissions
      expect(PermissionService.hasPermission('member', 'customers.read' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('member', 'customers.list' as Permission)).toBe(true)

      // Member should not have create, delete or admin permissions
      expect(PermissionService.hasPermission('member', 'customers.create' as Permission)).toBe(false)
      expect(PermissionService.hasPermission('member', 'customers.delete' as Permission)).toBe(false)
      expect(PermissionService.hasPermission('member', 'teams.invite' as Permission)).toBe(false)
    })

    it('PERM_002: should return correct result for viewer role', () => {
      // Viewer should only have read permissions for pages/posts (not customers)
      expect(PermissionService.hasPermission('viewer', 'pages.read' as Permission)).toBe(true)
      expect(PermissionService.hasPermission('viewer', 'posts.read' as Permission)).toBe(true)

      // Viewer should not have write permissions
      expect(PermissionService.hasPermission('viewer', 'customers.create' as Permission)).toBe(false)
      expect(PermissionService.hasPermission('viewer', 'customers.delete' as Permission)).toBe(false)
      expect(PermissionService.hasPermission('viewer', 'teams.invite' as Permission)).toBe(false)
    })

    it('should return false for non-existent permissions', () => {
      expect(PermissionService.hasPermission('admin', 'fake.permission' as Permission)).toBe(false)
      expect(PermissionService.hasPermission('member', 'nonexistent.action' as Permission)).toBe(false)
    })
  })

  describe('getRolePermissions', () => {
    it('should return all permissions for owner role', () => {
      const permissions = PermissionService.getRolePermissions('owner')

      // Owner should have many permissions
      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions).toContain('customers.create' as Permission)
      expect(permissions).toContain('customers.delete' as Permission)
      expect(permissions).toContain('teams.invite' as Permission)
      expect(permissions).toContain('settings.billing' as Permission)
    })

    it('should return specific permissions for admin role', () => {
      const permissions = PermissionService.getRolePermissions('admin')

      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions).toContain('customers.create' as Permission)
      expect(permissions).toContain('teams.invite' as Permission)

      // Admin should not have billing (owner-only)
      expect(permissions).not.toContain('settings.billing' as Permission)
    })

    it('should return limited permissions for member role', () => {
      const permissions = PermissionService.getRolePermissions('member')

      expect(permissions).toContain('customers.read' as Permission)
      expect(permissions).toContain('customers.list' as Permission)

      // Member should not have create, delete or invite
      expect(permissions).not.toContain('customers.create' as Permission)
      expect(permissions).not.toContain('customers.delete' as Permission)
      expect(permissions).not.toContain('teams.invite' as Permission)
    })

    it('should return only read permissions for viewer role', () => {
      const permissions = PermissionService.getRolePermissions('viewer')

      expect(permissions).toContain('pages.read' as Permission)
      expect(permissions).toContain('posts.read' as Permission)

      // Viewer should not have write permissions
      expect(permissions).not.toContain('customers.create' as Permission)
      expect(permissions).not.toContain('customers.delete' as Permission)
    })

    it('should return empty array for non-existent role', () => {
      const permissions = PermissionService.getRolePermissions('fake-role')

      expect(Array.isArray(permissions)).toBe(true)
      expect(permissions.length).toBe(0)
    })
  })

  describe('isValid', () => {
    it('should return true for valid permission IDs', () => {
      expect(PermissionService.isValid('customers.create' as Permission)).toBe(true)
      expect(PermissionService.isValid('customers.read' as Permission)).toBe(true)
      expect(PermissionService.isValid('teams.invite' as Permission)).toBe(true)
    })

    it('should return false for invalid permission IDs', () => {
      expect(PermissionService.isValid('fake.permission' as Permission)).toBe(false)
      expect(PermissionService.isValid('nonexistent.action' as Permission)).toBe(false)
      expect(PermissionService.isValid('invalid' as Permission)).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if role has at least one permission', () => {
      const permissions: Permission[] = [
        'customers.read' as Permission,
        'customers.delete' as Permission,
      ]

      // Member has read but not delete
      expect(PermissionService.hasAnyPermission('member', permissions)).toBe(true)

      // Viewer has neither (customers permissions)
      expect(PermissionService.hasAnyPermission('viewer', permissions)).toBe(false)
    })

    it('should return true for owner with any permissions', () => {
      const permissions: Permission[] = [
        'settings.billing' as Permission,
        'teams.invite' as Permission,
      ]

      // Owner has all permissions
      expect(PermissionService.hasAnyPermission('owner', permissions)).toBe(true)
    })

    it('should return false if role has none of the permissions', () => {
      const permissions: Permission[] = [
        'teams.invite' as Permission,
        'settings.billing' as Permission,
      ]

      // Member has none of these
      expect(PermissionService.hasAnyPermission('member', permissions)).toBe(false)
    })

    it('should return false for empty permissions array', () => {
      expect(PermissionService.hasAnyPermission('admin', [])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      const permissions: Permission[] = [
        'customers.read' as Permission,
        'customers.list' as Permission,
      ]

      // Member has both
      expect(PermissionService.hasAllPermissions('member', permissions)).toBe(true)

      // Viewer has neither (customers permissions)
      expect(PermissionService.hasAllPermissions('viewer', permissions)).toBe(false)
    })

    it('should return true for owner with all permissions', () => {
      const permissions: Permission[] = [
        'customers.create' as Permission,
        'customers.delete' as Permission,
        'settings.billing' as Permission,
      ]

      // Owner has everything
      expect(PermissionService.hasAllPermissions('owner', permissions)).toBe(true)
    })

    it('should return false if role is missing any permission', () => {
      const permissions: Permission[] = [
        'customers.create' as Permission,
        'teams.invite' as Permission,
      ]

      // Member has create but not invite
      expect(PermissionService.hasAllPermissions('member', permissions)).toBe(false)
    })

    it('should return true for empty permissions array', () => {
      // Vacuous truth: all of zero permissions are satisfied
      expect(PermissionService.hasAllPermissions('viewer', [])).toBe(true)
    })
  })

  describe('getByCategory', () => {
    it('should return permissions in a category', () => {
      // Note: Categories are capitalized in the registry (e.g., 'Customers' not 'customers')
      const customerPerms = PermissionService.getByCategory('Customers')

      expect(Array.isArray(customerPerms)).toBe(true)
      expect(customerPerms.length).toBeGreaterThan(0)

      const permissionIds = customerPerms.map(p => p.id)
      expect(permissionIds).toContain('customers.create' as Permission)
      expect(permissionIds).toContain('customers.read' as Permission)
    })

    it('should return empty array for non-existent category', () => {
      const perms = PermissionService.getByCategory('NonExistent')

      expect(Array.isArray(perms)).toBe(true)
      expect(perms.length).toBe(0)
    })
  })

  describe('getCategories', () => {
    it('should return all active categories', () => {
      const categories = PermissionService.getCategories()

      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      // Note: Categories are capitalized in the registry
      expect(categories).toContain('Customers')
    })
  })

  describe('getMatrix', () => {
    it('should return complete permission matrix', () => {
      const { permissions, matrix, sections } = PermissionService.getMatrix()

      expect(Array.isArray(permissions)).toBe(true)
      expect(permissions.length).toBeGreaterThan(0)
      expect(typeof matrix).toBe('object')
      expect(Array.isArray(sections)).toBe(true)
    })

    it('should return a copy to prevent mutation', () => {
      const matrix1 = PermissionService.getMatrix()
      const matrix2 = PermissionService.getMatrix()

      // Should be different objects (copies)
      expect(matrix1.permissions).not.toBe(matrix2.permissions)
      expect(matrix1.matrix).not.toBe(matrix2.matrix)
      expect(matrix1.sections).not.toBe(matrix2.sections)

      // But have the same content
      expect(matrix1.permissions).toEqual(matrix2.permissions)
    })
  })

  describe('getConfig', () => {
    it('should return permission configuration', () => {
      const config = PermissionService.getConfig('customers.create' as Permission)

      expect(config).toBeDefined()
      expect(config?.id).toBe('customers.create')
      expect(config?.label).toBeDefined()
      expect(config?.category).toBeDefined()
    })

    it('should return undefined for non-existent permission', () => {
      const config = PermissionService.getConfig('fake.permission' as Permission)

      expect(config).toBeUndefined()
    })

    it('should include dangerous flag when present', () => {
      const config = PermissionService.getConfig('customers.delete' as Permission)

      // Delete operations should be marked as dangerous
      if (config) {
        expect(typeof config.dangerous).toBe('boolean')
      }
    })
  })

  describe('getAll', () => {
    it('should return all permission IDs', () => {
      const allPerms = PermissionService.getAll()

      expect(Array.isArray(allPerms)).toBe(true)
      expect(allPerms.length).toBeGreaterThan(0)
      expect(allPerms).toContain('customers.create' as Permission)
      expect(allPerms).toContain('customers.read' as Permission)
    })

    it('should return a copy to prevent mutation', () => {
      const perms1 = PermissionService.getAll()
      const perms2 = PermissionService.getAll()

      // Should be different arrays (copies)
      expect(perms1).not.toBe(perms2)

      // But have the same content
      expect(perms1).toEqual(perms2)
    })
  })
})
