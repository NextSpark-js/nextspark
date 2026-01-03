/**
 * Unit Tests - UsageService
 *
 * Tests all UsageService methods for usage tracking and quota management.
 */

import { UsageService } from '@/core/lib/services/usage.service'
import { queryOneWithRLS, queryWithRLS, getTransactionClient } from '@/core/lib/db'
import type { Usage } from '@/core/lib/billing/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  getTransactionClient: jest.fn(),
}))

// Mock SubscriptionService
jest.mock('@/core/lib/services/subscription.service', () => ({
  SubscriptionService: {
    getActive: jest.fn(),
  },
}))

// Mock PlanService
jest.mock('@/core/lib/services/plan.service', () => ({
  PlanService: {
    getLimit: jest.fn(),
  },
}))

// Mock billing helpers
jest.mock('@/core/lib/billing/helpers', () => ({
  getPeriodKey: jest.fn().mockReturnValue('2024-01'),
  calculatePercentUsed: jest.fn().mockImplementation((current, limit) =>
    limit > 0 ? Math.round((current / limit) * 100) : 0
  ),
}))

// Mock billing registry
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    limits: {
      projects: { resetPeriod: 'monthly' },
      api_calls: { resetPeriod: 'monthly' },
    },
    plans: [],
  },
}))

import { SubscriptionService } from '@/core/lib/services/subscription.service'
import { PlanService } from '@/core/lib/services/plan.service'

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockGetTransactionClient = getTransactionClient as jest.MockedFunction<typeof getTransactionClient>
const mockSubscriptionService = SubscriptionService as jest.Mocked<typeof SubscriptionService>
const mockPlanService = PlanService as jest.Mocked<typeof PlanService>

// Sample usage data
const mockUsage: Usage = {
  id: 'usage-123',
  subscriptionId: 'sub-456',
  limitSlug: 'projects',
  periodKey: '2024-01',
  currentValue: 5,
  lastIncrementAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('UsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('get', () => {
    it('returns usage when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockUsage)

      const result = await UsageService.get('sub-456', 'projects', '2024-01')

      expect(result).toEqual(mockUsage)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"subscriptionId" = $1'),
        ['sub-456', 'projects', '2024-01']
      )
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await UsageService.get('sub-456', 'projects', '2024-01')

      expect(result).toBeNull()
    })

    it('returns null for empty subscriptionId', async () => {
      const result = await UsageService.get('', 'projects', '2024-01')

      expect(result).toBeNull()
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns null for empty limitSlug', async () => {
      const result = await UsageService.get('sub-456', '', '2024-01')

      expect(result).toBeNull()
    })

    it('returns null for empty periodKey', async () => {
      const result = await UsageService.get('sub-456', 'projects', '')

      expect(result).toBeNull()
    })
  })

  describe('getCurrent', () => {
    it('returns current usage value', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 5 })

      const result = await UsageService.getCurrent('sub-456', 'projects')

      expect(result).toBe(5)
    })

    it('returns 0 when no usage found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await UsageService.getCurrent('sub-456', 'projects')

      expect(result).toBe(0)
    })

    it('returns 0 for empty subscriptionId', async () => {
      const result = await UsageService.getCurrent('', 'projects')

      expect(result).toBe(0)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns 0 for empty limitSlug', async () => {
      const result = await UsageService.getCurrent('sub-456', '')

      expect(result).toBe(0)
    })
  })

  describe('getAll', () => {
    it('returns all usage for subscription', async () => {
      mockQueryWithRLS.mockResolvedValue([mockUsage, { ...mockUsage, limitSlug: 'members' }])

      const result = await UsageService.getAll('sub-456')

      expect(result).toHaveLength(2)
    })

    it('returns empty array for empty subscriptionId', async () => {
      const result = await UsageService.getAll('')

      expect(result).toEqual([])
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })
  })

  describe('getByTeam', () => {
    it('returns usage for team via subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue({ id: 'sub-456' } as any)
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 5 })

      const result = await UsageService.getByTeam('team-123', 'projects')

      expect(result).toBe(5)
      expect(mockSubscriptionService.getActive).toHaveBeenCalledWith('team-123')
    })

    it('returns 0 when no active subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue(null)

      const result = await UsageService.getByTeam('team-123', 'projects')

      expect(result).toBe(0)
    })

    it('returns 0 for empty teamId', async () => {
      const result = await UsageService.getByTeam('', 'projects')

      expect(result).toBe(0)
    })
  })

  describe('listNearQuota', () => {
    it('returns subscriptions near quota threshold', async () => {
      mockQueryWithRLS.mockResolvedValue([
        {
          subscriptionId: 'sub-1',
          teamId: 'team-1',
          planSlug: 'pro',
          limitSlug: 'projects',
          current: 8,
        },
      ])
      mockPlanService.getLimit.mockReturnValue(10)

      const result = await UsageService.listNearQuota(80)

      expect(result).toHaveLength(1)
      expect(result[0].subscriptionId).toBe('sub-1')
      expect(result[0].max).toBe(10)
      expect(result[0].percentUsed).toBe(80)
    })

    it('filters by limitSlug when provided', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await UsageService.listNearQuota(80, 'api_calls')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"limitSlug" = $1'),
        ['api_calls']
      )
    })

    it('throws error for invalid threshold', async () => {
      await expect(UsageService.listNearQuota(-10)).rejects.toThrow('Threshold must be between 0 and 100')
      await expect(UsageService.listNearQuota(150)).rejects.toThrow('Threshold must be between 0 and 100')
    })

    it('skips unlimited limits (-1)', async () => {
      mockQueryWithRLS.mockResolvedValue([
        {
          subscriptionId: 'sub-1',
          teamId: 'team-1',
          planSlug: 'enterprise',
          limitSlug: 'projects',
          current: 1000,
        },
      ])
      mockPlanService.getLimit.mockReturnValue(-1) // Unlimited

      const result = await UsageService.listNearQuota(80)

      expect(result).toHaveLength(0)
    })
  })

  describe('getTrend', () => {
    it('returns usage trend over periods', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { periodKey: '2024-02', currentValue: 150 },
        { periodKey: '2024-01', currentValue: 100 },
      ])

      const result = await UsageService.getTrend('sub-456', 'api_calls', 2)

      expect(result).toHaveLength(2)
      expect(result[0].periodKey).toBe('2024-02')
      expect(result[0].value).toBe(150)
    })

    it('returns empty array for empty subscriptionId', async () => {
      const result = await UsageService.getTrend('', 'api_calls')

      expect(result).toEqual([])
    })

    it('throws error for invalid periods', async () => {
      await expect(UsageService.getTrend('sub-456', 'api_calls', 0)).rejects.toThrow('Periods must be between 1 and 24')
      await expect(UsageService.getTrend('sub-456', 'api_calls', 30)).rejects.toThrow('Periods must be between 1 and 24')
    })

    it('uses default of 6 periods', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await UsageService.getTrend('sub-456', 'api_calls')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $3'),
        ['sub-456', 'api_calls', 6]
      )
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('increment', () => {
    it('increments usage by 1 by default', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 6 })

      const result = await UsageService.increment('sub-456', 'projects')

      expect(result.currentValue).toBe(6)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.arrayContaining(['sub-456', 'projects', '2024-01', 1])
      )
    })

    it('increments by custom amount', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 10 })

      const result = await UsageService.increment('sub-456', 'projects', 5)

      expect(result.currentValue).toBe(10)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      )
    })

    it('throws error for empty subscriptionId', async () => {
      await expect(UsageService.increment('', 'projects')).rejects.toThrow('Subscription ID and limit slug are required')
    })

    it('throws error for empty limitSlug', async () => {
      await expect(UsageService.increment('sub-456', '')).rejects.toThrow('Subscription ID and limit slug are required')
    })

    it('throws error when insert fails', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      await expect(UsageService.increment('sub-456', 'projects')).rejects.toThrow('Failed to increment usage')
    })
  })

  describe('decrement', () => {
    it('decrements usage by 1 by default', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 4 })

      const result = await UsageService.decrement('sub-456', 'projects')

      expect(result.currentValue).toBe(4)
      // Should call increment with negative value
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([-1])
      )
    })

    it('decrements by custom amount', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockUsage, currentValue: 0 })

      const result = await UsageService.decrement('sub-456', 'projects', 5)

      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([-5])
      )
    })
  })

  describe('reset', () => {
    it('resets usage for specific limit', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await UsageService.reset('sub-456', 'projects')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"limitSlug" = $2'),
        ['sub-456', 'projects']
      )
    })

    it('resets all usage when no limitSlug provided', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await UsageService.reset('sub-456')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"subscriptionId" = $1'),
        ['sub-456']
      )
      // Should NOT contain limitSlug filter
      expect(mockQueryWithRLS).not.toHaveBeenCalledWith(
        expect.stringContaining('"limitSlug"'),
        expect.any(Array)
      )
    })

    it('throws error for empty subscriptionId', async () => {
      await expect(UsageService.reset('')).rejects.toThrow('Subscription ID is required')
    })
  })

  // ===========================================
  // TRACK (Main usage tracking function)
  // ===========================================

  describe('track', () => {
    const mockTx = {
      query: jest.fn(),
      queryOne: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    }

    beforeEach(() => {
      mockGetTransactionClient.mockResolvedValue(mockTx as any)
      mockSubscriptionService.getActive.mockResolvedValue({ id: 'sub-456' } as any)
    })

    it('tracks usage with transaction', async () => {
      mockTx.queryOne.mockResolvedValue(mockUsage)

      const result = await UsageService.track({
        teamId: 'team-123',
        userId: 'user-456',
        limitSlug: 'api_calls',
        delta: 1,
        action: 'api.request',
      })

      expect(result).toEqual(mockUsage)
      expect(mockTx.query).toHaveBeenCalled() // usage_events insert
      expect(mockTx.queryOne).toHaveBeenCalled() // usage upsert
      expect(mockTx.commit).toHaveBeenCalled()
    })

    it('throws error for empty teamId', async () => {
      await expect(UsageService.track({
        teamId: '',
        userId: 'user-456',
        limitSlug: 'api_calls',
        delta: 1,
      })).rejects.toThrow('Team ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(UsageService.track({
        teamId: 'team-123',
        userId: '',
        limitSlug: 'api_calls',
        delta: 1,
      })).rejects.toThrow('User ID is required')
    })

    it('throws error for empty limitSlug', async () => {
      await expect(UsageService.track({
        teamId: 'team-123',
        userId: 'user-456',
        limitSlug: '',
        delta: 1,
      })).rejects.toThrow('Limit slug is required')
    })

    it('throws error when no active subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue(null)

      await expect(UsageService.track({
        teamId: 'team-123',
        userId: 'user-456',
        limitSlug: 'api_calls',
        delta: 1,
      })).rejects.toThrow('No active subscription found')
    })

    it('rolls back on failure', async () => {
      mockTx.queryOne.mockRejectedValue(new Error('DB error'))

      await expect(UsageService.track({
        teamId: 'team-123',
        userId: 'user-456',
        limitSlug: 'api_calls',
        delta: 1,
      })).rejects.toThrow('DB error')

      expect(mockTx.rollback).toHaveBeenCalled()
    })
  })

  // ===========================================
  // BACKGROUND JOBS
  // ===========================================

  describe('processMonthlyReset', () => {
    it('resets monthly usage records and returns count', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: 5 }])

      const result = await UsageService.processMonthlyReset()

      expect(result).toBe(5)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      )
    })

    it('returns 0 when no records to reset', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: 0 }])

      const result = await UsageService.processMonthlyReset()

      expect(result).toBe(0)
    })
  })

  // ===========================================
  // ANALYTICS
  // ===========================================

  describe('getTeamUsageByUser', () => {
    it('returns usage breakdown by user for team and period', async () => {
      mockSubscriptionService.getActive.mockResolvedValue({ id: 'sub-456' } as any)
      mockQueryWithRLS.mockResolvedValue([
        { userId: 'user-1', userName: 'Alice', userEmail: 'alice@test.com', limitSlug: 'api_calls', totalUsage: 50 },
        { userId: 'user-2', userName: 'Bob', userEmail: 'bob@test.com', limitSlug: 'api_calls', totalUsage: 30 },
      ])

      const result = await UsageService.getTeamUsageByUser('team-123', '2024-01')

      expect(result).toHaveLength(2)
      expect(result[0].totalUsage).toBe(50)
    })

    it('returns empty array for empty teamId', async () => {
      const result = await UsageService.getTeamUsageByUser('', '2024-01')

      expect(result).toEqual([])
    })

    it('returns empty array for empty periodKey', async () => {
      const result = await UsageService.getTeamUsageByUser('team-123', '')

      expect(result).toEqual([])
    })

    it('returns empty array when no active subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue(null)

      const result = await UsageService.getTeamUsageByUser('team-123', '2024-01')

      expect(result).toEqual([])
    })
  })

  describe('getTopConsumers', () => {
    it('returns top consumers for a limit', async () => {
      mockSubscriptionService.getActive.mockResolvedValue({ id: 'sub-456' } as any)
      mockQueryWithRLS.mockResolvedValue([
        { userId: 'user-1', userName: 'Alice', totalUsage: 1000 },
        { userId: 'user-2', userName: 'Bob', totalUsage: 800 },
      ])

      const result = await UsageService.getTopConsumers('team-123', 'api_calls', '2024-01')

      expect(result).toHaveLength(2)
      expect(result[0].totalUsage).toBe(1000)
    })

    it('returns empty array for empty params', async () => {
      const result = await UsageService.getTopConsumers('', 'api_calls', '2024-01')

      expect(result).toEqual([])
    })

    it('returns empty array when no active subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue(null)

      const result = await UsageService.getTopConsumers('team-123', 'api_calls', '2024-01')

      expect(result).toEqual([])
    })
  })

  describe('getUserTimeline', () => {
    it('returns usage timeline for user', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { userId: 'user-123', limitSlug: 'api_calls', delta: 100, createdAt: '2024-01-15' },
        { userId: 'user-123', limitSlug: 'api_calls', delta: 50, createdAt: '2024-01-14' },
      ])

      const result = await UsageService.getUserTimeline('user-123')

      expect(result).toHaveLength(2)
    })

    it('returns empty array for empty userId', async () => {
      const result = await UsageService.getUserTimeline('')

      expect(result).toEqual([])
    })

    it('can filter by limitSlug', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await UsageService.getUserTimeline('user-123', { limitSlug: 'api_calls' })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"limitSlug"'),
        expect.arrayContaining(['user-123', 'api_calls'])
      )
    })
  })

  describe('getTeamSummary', () => {
    it('returns comprehensive usage summary for team', async () => {
      mockSubscriptionService.getActive.mockResolvedValue({
        id: 'sub-456',
        plan: { slug: 'pro' }
      } as any)
      mockQueryWithRLS.mockResolvedValue([]) // Empty usage

      const result = await UsageService.getTeamSummary('team-123')

      expect(result).toHaveProperty('byLimit')
      expect(result).toHaveProperty('byUser')
      expect(result).toHaveProperty('topConsumers')
    })

    it('returns empty summary when no active subscription', async () => {
      mockSubscriptionService.getActive.mockResolvedValue(null)

      const result = await UsageService.getTeamSummary('team-123')

      expect(result).toEqual({ byLimit: {}, byUser: [], topConsumers: [] })
    })

    it('returns empty summary for empty teamId', async () => {
      const result = await UsageService.getTeamSummary('')

      expect(result).toEqual({ byLimit: {}, byUser: [], topConsumers: [] })
    })
  })
})
