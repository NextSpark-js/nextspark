/**
 * Unit Tests - Membership Service
 *
 * Tests the MembershipService and TeamMembership class that provide
 * unified team membership context combining:
 * - Role & hierarchy
 * - Permissions (RBAC)
 * - Subscription features
 * - Quota state
 *
 * Test Coverage:
 * - MEMB_001: TeamMembership.hasMinHierarchy()
 * - MEMB_002: TeamMembership.hasRole()
 * - MEMB_003: TeamMembership.hasAnyRole()
 * - MEMB_004: TeamMembership.hasPermission()
 * - MEMB_005: TeamMembership.hasFeature()
 * - MEMB_006: TeamMembership.checkQuota()
 * - MEMB_007: TeamMembership.canPerformAction() - allowed
 * - MEMB_008: TeamMembership.canPerformAction() - not_member
 * - MEMB_009: TeamMembership.canPerformAction() - permission_denied
 * - MEMB_010: TeamMembership.canPerformAction() - subscription_inactive
 */

// Mock server-only to allow testing server components
jest.mock('server-only', () => ({}))

import { TeamMembership, MembershipService } from '@/core/lib/services/membership.service'
import type {
  TeamMembershipData,
  Permission,
  MembershipSubscription,
  QuotaState,
} from '@/core/lib/permissions/types'

describe('TeamMembership Class', () => {
  // Helper function to create a membership with default values
  function createMembership(overrides: Partial<TeamMembershipData> = {}): TeamMembership {
    const defaultData: TeamMembershipData = {
      userId: 'user-123',
      teamId: 'team-456',
      role: 'member',
      hierarchy: 10,
      permissions: ['customers.create', 'customers.read'] as Permission[],
      subscription: {
        id: 'sub-789',
        planSlug: 'professional',
        planName: 'Professional Plan',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date('2025-01-26'),
      },
      features: ['advanced_analytics', 'api_access'],
      quotas: {
        projects: {
          used: 5,
          limit: 10,
          unlimited: false,
          remaining: 5,
        },
        users: {
          used: 3,
          limit: -1,
          unlimited: true,
          remaining: Infinity,
        },
      },
      ...overrides,
    }

    return new TeamMembership(defaultData)
  }

  describe('hasMinHierarchy', () => {
    it('MEMB_002: should return true when user meets hierarchy level', () => {
      const membership = createMembership({ hierarchy: 50 })

      expect(membership.hasMinHierarchy(50)).toBe(true)
      expect(membership.hasMinHierarchy(40)).toBe(true)
      expect(membership.hasMinHierarchy(10)).toBe(true)
    })

    it('MEMB_002: should return false when user does not meet hierarchy level', () => {
      const membership = createMembership({ hierarchy: 10 })

      expect(membership.hasMinHierarchy(50)).toBe(false)
      expect(membership.hasMinHierarchy(100)).toBe(false)
    })

    it('should handle edge cases', () => {
      const membership = createMembership({ hierarchy: 0 })

      expect(membership.hasMinHierarchy(0)).toBe(true)
      expect(membership.hasMinHierarchy(1)).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('MEMB_003: should return true when user has specific role', () => {
      const membership = createMembership({ role: 'admin' })

      expect(membership.hasRole('admin')).toBe(true)
    })

    it('MEMB_003: should return false when user has different role', () => {
      const membership = createMembership({ role: 'member' })

      expect(membership.hasRole('admin')).toBe(false)
      expect(membership.hasRole('owner')).toBe(false)
    })

    it('should handle null role', () => {
      const membership = createMembership({ role: null })

      expect(membership.hasRole('member')).toBe(false)
      expect(membership.hasRole('admin')).toBe(false)
    })
  })

  describe('hasAnyRole', () => {
    it('MEMB_004: should return true when user has one of the specified roles', () => {
      const membership = createMembership({ role: 'admin' })

      expect(membership.hasAnyRole(['owner', 'admin'])).toBe(true)
      expect(membership.hasAnyRole(['admin', 'member', 'viewer'])).toBe(true)
    })

    it('MEMB_004: should return false when user has none of the specified roles', () => {
      const membership = createMembership({ role: 'member' })

      expect(membership.hasAnyRole(['owner', 'admin'])).toBe(false)
      expect(membership.hasAnyRole(['viewer'])).toBe(false)
    })

    it('should return false for null role', () => {
      const membership = createMembership({ role: null })

      expect(membership.hasAnyRole(['owner', 'admin'])).toBe(false)
    })

    it('should return false for empty roles array', () => {
      const membership = createMembership({ role: 'admin' })

      expect(membership.hasAnyRole([])).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('MEMB_005: should return true when user has specific permission', () => {
      const membership = createMembership({
        permissions: ['customers.create', 'customers.read', 'customers.update'] as Permission[],
      })

      expect(membership.hasPermission('customers.create' as Permission)).toBe(true)
      expect(membership.hasPermission('customers.read' as Permission)).toBe(true)
    })

    it('MEMB_005: should return false when user does not have permission', () => {
      const membership = createMembership({
        permissions: ['customers.read'] as Permission[],
      })

      expect(membership.hasPermission('customers.delete' as Permission)).toBe(false)
      expect(membership.hasPermission('teams.invite' as Permission)).toBe(false)
    })

    it('should handle empty permissions array', () => {
      const membership = createMembership({ permissions: [] })

      expect(membership.hasPermission('customers.read' as Permission)).toBe(false)
    })
  })

  describe('hasFeature', () => {
    it('MEMB_006: should return true when plan includes feature', () => {
      const membership = createMembership({
        features: ['advanced_analytics', 'api_access', 'custom_branding'],
      })

      expect(membership.hasFeature('advanced_analytics')).toBe(true)
      expect(membership.hasFeature('api_access')).toBe(true)
    })

    it('MEMB_006: should return false when plan does not include feature', () => {
      const membership = createMembership({
        features: ['basic_reporting'],
      })

      expect(membership.hasFeature('advanced_analytics')).toBe(false)
      expect(membership.hasFeature('api_access')).toBe(false)
    })

    it('should handle empty features array', () => {
      const membership = createMembership({ features: [] })

      expect(membership.hasFeature('any_feature')).toBe(false)
    })
  })

  describe('checkQuota', () => {
    it('MEMB_007: should return allowed when quota is available', () => {
      const membership = createMembership({
        quotas: {
          projects: {
            used: 5,
            limit: 10,
            unlimited: false,
            remaining: 5,
          },
        },
      })

      const result = membership.checkQuota('projects', 1)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('MEMB_007: should return not allowed when quota would be exceeded', () => {
      const membership = createMembership({
        quotas: {
          projects: {
            used: 9,
            limit: 10,
            unlimited: false,
            remaining: 1,
          },
        },
      })

      const result = membership.checkQuota('projects', 2)

      expect(result.allowed).toBe(false)
      // remaining calculates from remaining - increment = 1 - 2 = -1, but Math.max(0, -1) = 0
      expect(result.remaining).toBe(0)
    })

    it('should return allowed for unlimited quotas', () => {
      const membership = createMembership({
        quotas: {
          users: {
            used: 100,
            limit: -1,
            unlimited: true,
            remaining: Infinity,
          },
        },
      })

      const result = membership.checkQuota('users', 50)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })

    it('should return allowed for unknown limits', () => {
      const membership = createMembership({ quotas: {} })

      const result = membership.checkQuota('unknown_limit', 1)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })

    it('should default increment to 1 if not provided', () => {
      const membership = createMembership({
        quotas: {
          projects: {
            used: 5,
            limit: 10,
            unlimited: false,
            remaining: 5,
          },
        },
      })

      const result = membership.checkQuota('projects')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should handle quota at exact limit', () => {
      const membership = createMembership({
        quotas: {
          projects: {
            used: 10,
            limit: 10,
            unlimited: false,
            remaining: 0,
          },
        },
      })

      const result = membership.checkQuota('projects', 1)

      expect(result.allowed).toBe(false)
      // remaining calculates from remaining - increment = 0 - 1 = -1, but Math.max(0, -1) = 0
      expect(result.remaining).toBe(0)
    })
  })

  describe('canPerformAction', () => {
    it('MEMB_005: should return allowed:true when all checks pass', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'active',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(true)
    })

    it('MEMB_006: should return not_member when user has no role', () => {
      const membership = createMembership({ role: null })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('not_member')
        expect(result.message).toBe('You are not a member of this team')
      }
    })

    it('MEMB_010: should return subscription_inactive when subscription is not active', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'past_due',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('subscription_inactive')
        expect(result.message).toContain('past_due')
        expect(result.meta?.currentStatus).toBe('past_due')
      }
    })

    it('MEMB_010: should allow action when subscription is trialing', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'trialing',
          trialEndsAt: new Date('2025-02-01'),
          currentPeriodEnd: new Date('2025-02-01'),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(true)
    })

    it('MEMB_007: should return permission_denied when user lacks permission', () => {
      const membership = createMembership({
        role: 'member',
        permissions: ['customers.read'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'active',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.delete')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('permission_denied')
        expect(result.message).toContain('customers.delete')
        expect(result.meta?.requiredPermission).toBe('customers.delete')
        expect(result.meta?.userRole).toBe('member')
      }
    })

    it('should allow action for invalid permission format', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'active',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      // Action without dot notation (not a valid permission)
      const result = membership.canPerformAction('invalid_action')

      expect(result.allowed).toBe(true)
    })

    it('should allow action when subscription is null', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: null,
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(true)
    })

    it('should handle canceled subscription status', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'canceled',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('subscription_inactive')
        expect(result.message).toContain('canceled')
      }
    })

    it('should handle paused subscription status', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'paused',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('subscription_inactive')
        expect(result.message).toContain('paused')
      }
    })

    it('should handle expired subscription status', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'expired',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('subscription_inactive')
        expect(result.message).toContain('expired')
      }
    })
  })

  describe('TeamMembership Constructor', () => {
    it('should create instance with all properties', () => {
      const data: TeamMembershipData = {
        userId: 'user-123',
        teamId: 'team-456',
        role: 'admin',
        hierarchy: 50,
        permissions: ['customers.create'] as Permission[],
        subscription: null,
        features: [],
        quotas: {},
      }

      const membership = new TeamMembership(data)

      expect(membership.userId).toBe('user-123')
      expect(membership.teamId).toBe('team-456')
      expect(membership.role).toBe('admin')
      expect(membership.hierarchy).toBe(50)
      expect(membership.permissions).toEqual(['customers.create'])
      expect(membership.subscription).toBeNull()
      expect(membership.features).toEqual([])
      expect(membership.quotas).toEqual({})
    })

    it('properties are readonly in TypeScript', () => {
      const membership = createMembership()

      // TypeScript enforces readonly at compile time
      // At runtime, JavaScript doesn't prevent reassignment
      // This test just verifies the properties exist and are set correctly
      expect(membership.userId).toBe('user-123')
      expect(membership.teamId).toBe('team-456')
      expect(membership.role).toBe('member')
      expect(membership.hierarchy).toBe(10)

      // The 'readonly' is a TypeScript compile-time feature
      // @ts-expect-error - TypeScript prevents this at compile time
      membership.role = 'owner'
    })
  })
})

describe('MembershipService (Integration)', () => {
  // Note: Full integration tests require database mocking
  // These tests verify the service structure and error handling

  describe('get', () => {
    it('should throw error when userId is missing', async () => {
      await expect(MembershipService.get('', 'team-123')).rejects.toThrow(
        'User ID and Team ID are required'
      )
    })

    it('should throw error when teamId is missing', async () => {
      await expect(MembershipService.get('user-123', '')).rejects.toThrow(
        'User ID and Team ID are required'
      )
    })

    // Additional integration tests would require mocking:
    // - TeamMemberService.getByTeamAndUser
    // - SubscriptionService.getActive
    // - PlanService.getConfig
    // - UsageService (via SubscriptionService.checkQuota)
    //
    // These are better tested in integration/e2e tests or with proper mocks
  })
})

// ===========================================
// V2 MIGRATION TESTS
// ===========================================
// These tests verify the error format and patterns used by API routes
// migrated in v2 to use MembershipService

describe('TeamMembership - V2 API Migration Patterns', () => {
  function createMembership(overrides: Partial<TeamMembershipData> = {}): TeamMembership {
    const defaultData: TeamMembershipData = {
      userId: 'user-123',
      teamId: 'team-456',
      role: 'member',
      hierarchy: 10,
      permissions: ['customers.create', 'customers.read'] as Permission[],
      subscription: {
        id: 'sub-789',
        planSlug: 'professional',
        planName: 'Professional Plan',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date('2025-01-26'),
      },
      features: ['advanced_analytics', 'api_access'],
      quotas: {
        projects: {
          used: 5,
          limit: 10,
          unlimited: false,
          remaining: 5,
        },
      },
      ...overrides,
    }

    return new TeamMembership(defaultData)
  }

  describe('canPerformAction - Error Response Format', () => {
    it('V2_001: should return correct structure for not_member error', () => {
      const membership = createMembership({ role: null })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('not_member')
        expect(result.message).toBe('You are not a member of this team')
        expect(typeof result.message).toBe('string')
        // meta is optional for this error type
      }
    })

    it('V2_002: should return correct structure for permission_denied error', () => {
      const membership = createMembership({
        role: 'member',
        permissions: ['customers.read'] as Permission[],
      })

      const result = membership.canPerformAction('customers.delete')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('permission_denied')
        expect(result.message).toContain('customers.delete')
        expect(result.meta?.requiredPermission).toBe('customers.delete')
        expect(result.meta?.userRole).toBe('member')
      }
    })

    it('V2_003: should return correct structure for subscription_inactive error', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
        subscription: {
          id: 'sub-123',
          planSlug: 'professional',
          planName: 'Professional',
          status: 'past_due',
          trialEndsAt: null,
          currentPeriodEnd: new Date(),
        },
      })

      const result = membership.canPerformAction('customers.create')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('subscription_inactive')
        expect(result.message).toContain('past_due')
        expect(result.meta?.currentStatus).toBe('past_due')
      }
    })

    it('V2_004: should return allowed:true with no extra fields when successful', () => {
      const membership = createMembership({
        role: 'admin',
        permissions: ['customers.create'] as Permission[],
      })

      const result = membership.canPerformAction('customers.create')

      expect(result).toEqual({ allowed: true })
      // Verify no extra fields
      expect(Object.keys(result)).toEqual(['allowed'])
    })
  })

  describe('hasMinHierarchy - V2 Role-Based Checks', () => {
    it('V2_005: should return true when user hierarchy >= required (admin level)', () => {
      // Simulate admin role (hierarchy: 50)
      const membership = createMembership({ hierarchy: 50 })

      expect(membership.hasMinHierarchy(50)).toBe(true)
      expect(membership.hasMinHierarchy(10)).toBe(true)
    })

    it('V2_006: should return false when user hierarchy < required', () => {
      // Simulate member role (hierarchy: 10)
      const membership = createMembership({ hierarchy: 10 })

      expect(membership.hasMinHierarchy(50)).toBe(false)
      expect(membership.hasMinHierarchy(100)).toBe(false)
    })

    it('V2_007: should handle exact hierarchy match', () => {
      const membership = createMembership({ hierarchy: 50 })

      expect(membership.hasMinHierarchy(50)).toBe(true)
    })

    it('V2_008: should work for owner-level checks (hierarchy: 100)', () => {
      const ownerMembership = createMembership({ hierarchy: 100 })
      const adminMembership = createMembership({ hierarchy: 50 })

      expect(ownerMembership.hasMinHierarchy(100)).toBe(true)
      expect(adminMembership.hasMinHierarchy(100)).toBe(false)
    })
  })

  describe('ActionResult Type Safety', () => {
    it('V2_009: ActionResult discriminated union works correctly', () => {
      const membership = createMembership({ role: null })
      const result = membership.canPerformAction('customers.create')

      // TypeScript discriminated union
      if (result.allowed) {
        // This branch should never execute
        expect(result).toEqual({ allowed: true })
      } else {
        // All denied results must have reason and message
        expect(result.reason).toBeDefined()
        expect(result.message).toBeDefined()
        expect(typeof result.reason).toBe('string')
        expect(typeof result.message).toBe('string')
      }
    })

    it('V2_010: meta field is present when contextually relevant', () => {
      const membership = createMembership({
        role: 'member',
        permissions: ['customers.read'] as Permission[],
      })

      const result = membership.canPerformAction('customers.delete')

      if (!result.allowed && result.reason === 'permission_denied') {
        expect(result.meta).toBeDefined()
        expect(result.meta?.requiredPermission).toBeDefined()
        expect(result.meta?.userRole).toBeDefined()
      }
    })
  })
})
