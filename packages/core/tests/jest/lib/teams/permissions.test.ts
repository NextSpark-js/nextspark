/**
 * Unit Tests - Teams Permissions (role hierarchy)
 *
 * Covers canManageRole() and validateRoleTransition().
 * Hierarchy comes from the permissions-registry mock:
 * owner=100, admin=50, editor=30, member=10, viewer=1
 *
 * Issue #89: validateRoleTransition() only compared the actor against the
 * target's CURRENT role, so an actor could promote a lower-ranked member to
 * any role, including one above the actor's own level.
 */

import { canManageRole, validateRoleTransition } from '@/core/lib/teams/permissions'

describe('teams/permissions', () => {
  describe('canManageRole', () => {
    it('allows managing only roles strictly lower in the hierarchy', () => {
      expect(canManageRole('admin', 'member')).toBe(true)
      expect(canManageRole('owner', 'admin')).toBe(true)
      expect(canManageRole('admin', 'admin')).toBe(false)
      expect(canManageRole('member', 'admin')).toBe(false)
    })

    it('treats unknown roles as hierarchy 0', () => {
      expect(canManageRole('member', 'unknown-role')).toBe(true)
      expect(canManageRole('unknown-role', 'viewer')).toBe(false)
    })
  })

  describe('validateRoleTransition', () => {
    it('rejects changing the owner role', () => {
      const result = validateRoleTransition('owner', 'admin', 'owner')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('ownership transfer')
    })

    it('rejects promoting to owner', () => {
      const result = validateRoleTransition('member', 'owner', 'owner')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('ownership transfer')
    })

    it('rejects when the actor does not outrank the current role', () => {
      const result = validateRoleTransition('admin', 'member', 'member')
      expect(result.allowed).toBe(false)
    })

    it('allows assigning a role strictly below the actor', () => {
      expect(validateRoleTransition('member', 'editor', 'admin')).toEqual({ allowed: true })
      expect(validateRoleTransition('viewer', 'member', 'admin')).toEqual({ allowed: true })
      expect(validateRoleTransition('member', 'admin', 'owner')).toEqual({ allowed: true })
    })

    describe('destination role (issue #89)', () => {
      it('ROLE_089_1: rejects promoting a target above the actor own level', () => {
        // editor (30) outranks member (10) but must not be able to hand out admin (50)
        const result = validateRoleTransition('member', 'admin', 'editor')

        expect(result.allowed).toBe(false)
        expect(result.reason).toBeDefined()
      })

      it('ROLE_089_2: rejects assigning a role equal to the actor own level', () => {
        const result = validateRoleTransition('member', 'admin', 'admin')

        expect(result.allowed).toBe(false)
      })

      it('ROLE_089_3: rejects a lateral move into a higher role even when the actor outranks the current role', () => {
        // member (10) outranks viewer (1) but cannot promote the viewer to editor (30)
        const result = validateRoleTransition('viewer', 'editor', 'member')

        expect(result.allowed).toBe(false)
      })
    })
  })
})
