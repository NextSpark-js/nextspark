/**
 * Unit Tests - SubscriptionService
 *
 * Tests all SubscriptionService methods for subscription management,
 * feature checks, and quota enforcement.
 */

import { SubscriptionService } from '@/core/lib/services/subscription.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import type { Subscription, Plan, SubscriptionWithPlan } from '@/core/lib/billing/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

// Mock PlanService
jest.mock('@/core/lib/services/plan.service', () => ({
  PlanService: {
    getBySlug: jest.fn(),
    getDefault: jest.fn(),
    getFeatures: jest.fn(),
    getLimit: jest.fn(),
    isUpgrade: jest.fn(),
    getConfig: jest.fn(),
    getStripePriceId: jest.fn(),
  },
}))

// Mock UsageService
jest.mock('@/core/lib/services/usage.service', () => ({
  UsageService: {
    getCurrent: jest.fn(),
  },
}))

// Mock TeamMemberService
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: {
    hasPermission: jest.fn(),
  },
}))

// Mock billing helpers
jest.mock('@/core/lib/billing/helpers', () => ({
  getPeriodKey: jest.fn().mockReturnValue('2024-01'),
  calculatePercentUsed: jest.fn().mockImplementation((current, limit) =>
    limit > 0 ? Math.round((current / limit) * 100) : 0
  ),
  isSubscriptionActive: jest.fn().mockImplementation(
    (status) => status === 'active' || status === 'trialing'
  ),
  hasFeature: jest.fn().mockImplementation(
    (features, feature) => features?.includes(feature) ?? false
  ),
}))

// Mock billing registry
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    limits: {
      projects: { resetPeriod: 'monthly', name: 'Projects' },
      members: { resetPeriod: 'monthly', name: 'Team Members' },
      api_calls: { resetPeriod: 'monthly', name: 'API Calls' },
    },
    actionMappings: {
      permissions: { create_project: 'projects.create' },
      features: { use_analytics: 'analytics' },
      limits: { create_project: 'projects' },
    },
    plans: [],
  },
}))

// Mock stripe gateway (not actually used in tests but needs to be mocked)
jest.mock('@/core/lib/billing/gateways/stripe', () => ({
  updateSubscriptionPlan: jest.fn(),
}))

// Mock enforcement module
jest.mock('@/core/lib/billing/enforcement', () => ({
  checkDowngrade: jest.fn().mockResolvedValue({ canDowngrade: true, warnings: [] }),
}))

import { PlanService } from '@/core/lib/services/plan.service'
import { UsageService } from '@/core/lib/services/usage.service'
import { TeamMemberService } from '@/core/lib/services/team-member.service'

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
const mockPlanService = PlanService as jest.Mocked<typeof PlanService>
const mockUsageService = UsageService as jest.Mocked<typeof UsageService>
const mockTeamMemberService = TeamMemberService as jest.Mocked<typeof TeamMemberService>

// Sample plan data
const mockPlan: Plan = {
  id: 'plan-789',
  slug: 'pro',
  name: 'Pro Plan',
  type: 'paid',
  price: 29,
  priceYearly: 290,
  features: ['analytics', 'api_access'],
  limits: { projects: 100, members: 10 },
  sortOrder: 2,
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Sample subscription data
const mockSubscription: Subscription = {
  id: 'sub-123',
  teamId: 'team-456',
  planId: 'plan-789',
  status: 'active',
  billingInterval: 'monthly',
  currentPeriodStart: '2024-01-01',
  currentPeriodEnd: '2024-02-01',
  cancelAtPeriodEnd: false,
  externalSubscriptionId: 'stripe_sub_123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// SubscriptionWithPlan has a nested plan object
const mockSubscriptionWithPlan: SubscriptionWithPlan = {
  ...mockSubscription,
  plan: mockPlan,
}

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('getById', () => {
    it('returns subscription when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscription)

      const result = await SubscriptionService.getById('sub-123')

      expect(result).toEqual(mockSubscription)
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await SubscriptionService.getById('non-existent')

      expect(result).toBeNull()
    })

    it('throws error for empty id', async () => {
      await expect(SubscriptionService.getById('')).rejects.toThrow('Subscription ID is required')
    })
  })

  describe('getByTeamId', () => {
    it('returns subscription with plan details', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)

      const result = await SubscriptionService.getByTeamId('team-456')

      expect(result?.plan.slug).toBe('pro')
    })

    it('returns null when no subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await SubscriptionService.getByTeamId('team-without-sub')

      expect(result).toBeNull()
    })
  })

  describe('getByUserId', () => {
    it('returns subscription for user', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)

      const result = await SubscriptionService.getByUserId('user-123')

      expect(result).toEqual(mockSubscriptionWithPlan)
    })
  })

  describe('getActive', () => {
    it('returns active subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)

      const result = await SubscriptionService.getActive('team-456')

      expect(result?.status).toBe('active')
    })

    it('returns null for inactive subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await SubscriptionService.getActive('team-without-active')

      expect(result).toBeNull()
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('create', () => {
    it('creates subscription', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [mockSubscription], rowCount: 1 })

      const result = await SubscriptionService.create('team-456', 'plan-789')

      expect(result).toEqual(mockSubscription)
    })

    it('creates with trial days', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockSubscription, status: 'trialing' }], rowCount: 1 })

      const result = await SubscriptionService.create('team-456', 'plan-789', { trialDays: 14 })

      expect(result.status).toBe('trialing')
      expect(mockMutateWithRLS).toHaveBeenCalled()
    })
  })

  describe('createDefault', () => {
    it('creates free subscription', async () => {
      mockPlanService.getDefault.mockResolvedValue({ id: 'plan-free', slug: 'free' } as any)
      mockMutateWithRLS.mockResolvedValue({ rows: [mockSubscription], rowCount: 1 })

      const result = await SubscriptionService.createDefault('team-456')

      expect(result).toEqual(mockSubscription)
    })

    it('throws error when default plan not found', async () => {
      mockPlanService.getDefault.mockResolvedValue(null)

      await expect(SubscriptionService.createDefault('team-456')).rejects.toThrow('Default plan not found')
    })
  })

  describe('updateStatus', () => {
    it('updates subscription status', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockSubscription, status: 'canceled' }], rowCount: 1 })

      const result = await SubscriptionService.updateStatus('sub-123', 'canceled')

      expect(result.status).toBe('canceled')
    })
  })

  describe('cancel', () => {
    it('cancels subscription at period end', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockSubscription, cancelAtPeriodEnd: true }], rowCount: 1 })

      await SubscriptionService.cancel('sub-123')

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"cancelAtPeriodEnd" = true'),
        expect.any(Array)
      )
    })
  })

  describe('pause', () => {
    it('pauses active subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockSubscription, status: 'active' })
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockSubscription, status: 'paused' }], rowCount: 1 })

      const result = await SubscriptionService.pause('sub-123')

      expect(result.status).toBe('paused')
    })

    it('throws error when not active', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockSubscription, status: 'canceled' })

      await expect(SubscriptionService.pause('sub-123')).rejects.toThrow('Can only pause active subscriptions')
    })
  })

  describe('resume', () => {
    it('resumes paused subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockSubscription, status: 'paused' })
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockSubscription, status: 'active' }], rowCount: 1 })

      const result = await SubscriptionService.resume('sub-123')

      expect(result.status).toBe('active')
    })

    it('throws error when not paused', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockSubscription, status: 'active' })

      await expect(SubscriptionService.resume('sub-123')).rejects.toThrow('Can only resume paused subscriptions')
    })
  })

  // ===========================================
  // FEATURE/QUOTA CHECKS
  // ===========================================

  describe('hasFeature', () => {
    it('returns true when subscription has feature', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)
      mockPlanService.getConfig.mockReturnValue({
        slug: 'pro',
        features: ['analytics', 'api_access'],
        limits: {},
      })

      const result = await SubscriptionService.hasFeature('team-456', 'analytics')

      expect(result).toBe(true)
    })

    it('returns false when subscription lacks feature', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)
      mockPlanService.getConfig.mockReturnValue({
        slug: 'pro',
        features: ['analytics'],
        limits: {},
      })

      const result = await SubscriptionService.hasFeature('team-456', 'custom_domain')

      expect(result).toBe(false)
    })

    it('returns false when no subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await SubscriptionService.hasFeature('team-without-sub', 'analytics')

      expect(result).toBe(false)
    })
  })

  describe('checkQuota', () => {
    it('returns allowed when under quota with correct remaining calculation', async () => {
      mockQueryOneWithRLS
        .mockResolvedValueOnce(mockSubscriptionWithPlan) // getActive
        .mockResolvedValueOnce({ currentValue: 50 }) // usage query
      mockPlanService.getLimit.mockReturnValue(100)

      const result = await SubscriptionService.checkQuota('team-456', 'projects')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(50)
      expect(result.max).toBe(100)
      expect(result.remaining).toBe(50) // 100 - 50 = 50
      expect(result.percentUsed).toBe(50) // 50% used
    })

    it('returns not allowed when at quota with zero remaining', async () => {
      mockQueryOneWithRLS
        .mockResolvedValueOnce(mockSubscriptionWithPlan) // getActive
        .mockResolvedValueOnce({ currentValue: 100 }) // usage query
      mockPlanService.getLimit.mockReturnValue(100)

      const result = await SubscriptionService.checkQuota('team-456', 'projects')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.percentUsed).toBe(100) // 100% used
    })

    it('returns not allowed when over quota', async () => {
      mockQueryOneWithRLS
        .mockResolvedValueOnce(mockSubscriptionWithPlan) // getActive
        .mockResolvedValueOnce({ currentValue: 150 }) // usage query - over limit
      mockPlanService.getLimit.mockReturnValue(100)

      const result = await SubscriptionService.checkQuota('team-456', 'projects')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0) // Math.max(0, -50) = 0
    })

    it('returns allowed for unlimited (-1)', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)
      mockPlanService.getLimit.mockReturnValue(-1)

      const result = await SubscriptionService.checkQuota('team-456', 'projects')

      expect(result.allowed).toBe(true)
      expect(result.max).toBe(-1)
    })

    it('returns not allowed when no active subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null) // no active subscription

      const result = await SubscriptionService.checkQuota('team-456', 'projects')

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(0)
      expect(result.max).toBe(0)
    })

    it('returns allowed for unknown limit (not in registry)', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscriptionWithPlan)

      const result = await SubscriptionService.checkQuota('team-456', 'unknown_limit')

      expect(result.allowed).toBe(true)
      expect(result.max).toBe(-1)
    })
  })

  describe('canPerformAction', () => {
    it('returns allowed for superadmin user', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'superadmin' })

      const result = await SubscriptionService.canPerformAction('user-123', 'team-456', 'create_project')

      expect(result.allowed).toBe(true)
    })

    it('returns not allowed when user is not team member', async () => {
      mockQueryOneWithRLS
        .mockResolvedValueOnce({ role: 'user' }) // user role query
        .mockResolvedValueOnce(null) // team member query (not a member)

      const result = await SubscriptionService.canPerformAction('user-123', 'team-456', 'create_project')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('no_permission')
    })

    it('returns not allowed for empty parameters', async () => {
      const result = await SubscriptionService.canPerformAction('', 'team-456', 'create_project')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('no_permission')
    })
  })

  // ===========================================
  // FILTERING QUERIES
  // ===========================================

  describe('listByStatus', () => {
    it('returns subscriptions by status', async () => {
      mockQueryWithRLS.mockResolvedValue([mockSubscriptionWithPlan])

      const result = await SubscriptionService.listByStatus('active')

      expect(result).toHaveLength(1)
    })
  })

  describe('listExpiringSoon', () => {
    it('returns subscriptions expiring within days', async () => {
      mockQueryWithRLS.mockResolvedValue([mockSubscriptionWithPlan])

      const result = await SubscriptionService.listExpiringSoon(7)

      expect(result).toHaveLength(1)
    })
  })

  describe('listByPlan', () => {
    it('returns subscriptions for plan', async () => {
      mockQueryWithRLS.mockResolvedValue([mockSubscriptionWithPlan])

      const result = await SubscriptionService.listByPlan('pro')

      expect(result).toHaveLength(1)
    })
  })

  describe('getByExternalId', () => {
    it('returns subscription by Stripe ID', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockSubscription)

      const result = await SubscriptionService.getByExternalId('stripe_sub_123')

      expect(result).toEqual(mockSubscription)
    })
  })

  describe('countByPlan', () => {
    it('returns count per plan', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { slug: 'free', count: '100' },
        { slug: 'pro', count: '50' },
      ])

      const result = await SubscriptionService.countByPlan()

      expect(result).toEqual({ free: 100, pro: 50 })
    })

    it('returns single count when planSlug provided', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: '50' })

      const result = await SubscriptionService.countByPlan('pro')

      expect(result).toBe(50)
    })
  })

  describe('getHistory', () => {
    it('returns subscription history for team', async () => {
      mockQueryWithRLS.mockResolvedValue([mockSubscriptionWithPlan])

      const result = await SubscriptionService.getHistory('team-456')

      expect(result).toHaveLength(1)
    })
  })

  // ===========================================
  // PLAN CHANGES
  // ===========================================

  describe('changePlan', () => {
    it('returns error for empty teamId', async () => {
      const result = await SubscriptionService.changePlan('', 'pro')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Team ID is required')
    })

    it('returns error for empty targetPlanSlug', async () => {
      const result = await SubscriptionService.changePlan('team-456', '')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Target plan slug is required')
    })

    it('returns error when no active subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await SubscriptionService.changePlan('team-456', 'pro')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No active subscription found')
    })

    it('returns error when target plan not found in registry', async () => {
      mockQueryOneWithRLS.mockResolvedValue({
        ...mockSubscriptionWithPlan,
        externalSubscriptionId: 'stripe_sub_123',
      })
      mockPlanService.getConfig.mockReturnValue(null)

      const result = await SubscriptionService.changePlan('team-456', 'nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('returns error when no Stripe price available', async () => {
      mockQueryOneWithRLS.mockResolvedValue({
        ...mockSubscriptionWithPlan,
        externalSubscriptionId: 'stripe_sub_123',
      })
      mockPlanService.getConfig.mockReturnValue({ slug: 'enterprise', features: [], limits: {} })
      mockPlanService.getStripePriceId.mockReturnValue(null)

      const result = await SubscriptionService.changePlan('team-456', 'enterprise')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No Stripe price')
    })
  })

  // ===========================================
  // BACKGROUND JOBS
  // ===========================================

  describe('processExpiredTrials', () => {
    it('updates expired trial subscriptions and returns count', async () => {
      // First call: SELECT expired trials
      // Second call: UPDATE
      mockQueryWithRLS
        .mockResolvedValueOnce([{ id: 'sub-1', planId: 'plan-1' }, { id: 'sub-2', planId: 'plan-1' }])
        .mockResolvedValueOnce([])

      const result = await SubscriptionService.processExpiredTrials()

      expect(result).toBe(2)
      // Verify both SELECT and UPDATE were called
      expect(mockQueryWithRLS).toHaveBeenCalledTimes(2)
    })

    it('returns 0 when no expired trials', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await SubscriptionService.processExpiredTrials()

      expect(result).toBe(0)
      // Should only make the SELECT query, not UPDATE
      expect(mockQueryWithRLS).toHaveBeenCalledTimes(1)
    })
  })
})
