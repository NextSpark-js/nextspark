/**
 * Unit Tests - PlanService
 *
 * Tests all PlanService methods including database queries
 * and registry-based configuration lookups.
 */

import { PlanService } from '@/core/lib/services/plan.service'
import { queryOneWithRLS, queryWithRLS } from '@/core/lib/db'
import { BILLING_REGISTRY } from '@/core/lib/registries/billing-registry'
import type { Plan } from '@/core/lib/billing/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
}))

// Mock billing registry
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    defaultPlan: 'free',
    features: {
      analytics: { slug: 'analytics', name: 'Analytics' },
      api_access: { slug: 'api_access', name: 'API Access' },
      custom_domain: { slug: 'custom_domain', name: 'Custom Domain' },
    },
    plans: [
      {
        slug: 'free',
        name: 'Free',
        features: ['analytics'],
        limits: { projects: 3, members: 1 },
        price: { monthly: 0, yearly: 0 },
      },
      {
        slug: 'pro',
        name: 'Pro',
        features: ['analytics', 'api_access'],
        limits: { projects: 100, members: 10 },
        price: { monthly: 2900, yearly: 29000 },
        stripePriceIdMonthly: 'price_pro_monthly',
        stripePriceIdYearly: 'price_pro_yearly',
      },
      {
        slug: 'enterprise',
        name: 'Enterprise',
        features: ['*'],
        limits: { projects: -1, members: -1 },
        price: { monthly: 9900, yearly: 99000 },
        stripePriceIdMonthly: 'price_ent_monthly',
        stripePriceIdYearly: 'price_ent_yearly',
      },
    ],
  },
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>

// Sample plan data
const mockPlan: Plan = {
  id: 'plan-123',
  slug: 'pro',
  name: 'Pro Plan',
  description: 'Professional features',
  type: 'paid',
  visibility: 'public',
  sortOrder: 2,
  features: ['analytics', 'api_access'],
  limits: { projects: 100, members: 10 },
  trialDays: 14,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('PlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // DATABASE QUERIES
  // ===========================================

  describe('getById', () => {
    it('returns plan when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockPlan)

      const result = await PlanService.getById('plan-123')

      expect(result).toEqual(mockPlan)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "plans" WHERE id = $1',
        ['plan-123']
      )
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await PlanService.getById('non-existent')

      expect(result).toBeNull()
    })

    it('throws error for empty id', async () => {
      await expect(PlanService.getById('')).rejects.toThrow('Plan ID is required')
      await expect(PlanService.getById('  ')).rejects.toThrow('Plan ID is required')
    })
  })

  describe('getBySlug', () => {
    it('returns plan when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockPlan)

      const result = await PlanService.getBySlug('pro')

      expect(result).toEqual(mockPlan)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "plans" WHERE slug = $1',
        ['pro']
      )
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await PlanService.getBySlug('non-existent')

      expect(result).toBeNull()
    })

    it('throws error for empty slug', async () => {
      await expect(PlanService.getBySlug('')).rejects.toThrow('Plan slug is required')
    })
  })

  describe('list', () => {
    const mockPlans: Plan[] = [
      { ...mockPlan, id: 'plan-1', slug: 'free', sortOrder: 1 },
      { ...mockPlan, id: 'plan-2', slug: 'pro', sortOrder: 2 },
    ]

    it('returns public plans by default', async () => {
      mockQueryWithRLS.mockResolvedValue(mockPlans)

      const result = await PlanService.list()

      expect(result).toEqual(mockPlans)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("visibility = 'public'")
      )
    })

    it('returns all plans when includeHidden is true', async () => {
      mockQueryWithRLS.mockResolvedValue(mockPlans)

      const result = await PlanService.list({ includeHidden: true })

      expect(result).toEqual(mockPlans)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "plans" ORDER BY "sortOrder" ASC'
      )
    })
  })

  describe('getDefault', () => {
    it('returns default plan based on registry', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockPlan, slug: 'free' })

      const result = await PlanService.getDefault()

      expect(result?.slug).toBe('free')
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "plans" WHERE slug = $1',
        ['free']
      )
    })
  })

  describe('exists', () => {
    it('returns true when plan exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'plan-123' })

      const result = await PlanService.exists('pro')

      expect(result).toBe(true)
    })

    it('returns false when plan does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await PlanService.exists('non-existent')

      expect(result).toBe(false)
    })

    it('returns false for empty slug', async () => {
      const result = await PlanService.exists('')

      expect(result).toBe(false)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })
  })

  // ===========================================
  // REGISTRY HELPERS (Synchronous)
  // ===========================================

  describe('getConfig', () => {
    it('returns config for existing plan', () => {
      const config = PlanService.getConfig('pro')

      expect(config).not.toBeNull()
      expect(config?.slug).toBe('pro')
      expect(config?.name).toBe('Pro')
    })

    it('returns null for non-existent plan', () => {
      const config = PlanService.getConfig('non-existent')

      expect(config).toBeNull()
    })

    it('returns null for empty slug', () => {
      const config = PlanService.getConfig('')

      expect(config).toBeNull()
    })
  })

  describe('getFeatures', () => {
    it('returns features for plan', () => {
      const features = PlanService.getFeatures('pro')

      expect(features).toEqual(['analytics', 'api_access'])
    })

    it('returns all features when plan has wildcard', () => {
      const features = PlanService.getFeatures('enterprise')

      expect(features).toContain('analytics')
      expect(features).toContain('api_access')
      expect(features).toContain('custom_domain')
    })

    it('returns empty array for non-existent plan', () => {
      const features = PlanService.getFeatures('non-existent')

      expect(features).toEqual([])
    })
  })

  describe('getLimits', () => {
    it('returns limits for plan', () => {
      const limits = PlanService.getLimits('pro')

      expect(limits).toEqual({ projects: 100, members: 10 })
    })

    it('returns empty object for non-existent plan', () => {
      const limits = PlanService.getLimits('non-existent')

      expect(limits).toEqual({})
    })
  })

  describe('getLimit', () => {
    it('returns specific limit value', () => {
      const limit = PlanService.getLimit('pro', 'projects')

      expect(limit).toBe(100)
    })

    it('returns 0 for non-existent limit', () => {
      const limit = PlanService.getLimit('pro', 'non_existent')

      expect(limit).toBe(0)
    })

    it('returns -1 for unlimited', () => {
      const limit = PlanService.getLimit('enterprise', 'projects')

      expect(limit).toBe(-1)
    })
  })

  describe('hasFeature', () => {
    it('returns true when plan has feature', () => {
      expect(PlanService.hasFeature('pro', 'analytics')).toBe(true)
      expect(PlanService.hasFeature('pro', 'api_access')).toBe(true)
    })

    it('returns false when plan lacks feature', () => {
      expect(PlanService.hasFeature('free', 'api_access')).toBe(false)
    })

    it('returns true for enterprise with wildcard', () => {
      expect(PlanService.hasFeature('enterprise', 'custom_domain')).toBe(true)
    })
  })

  // ===========================================
  // COMPARISON HELPERS
  // ===========================================

  describe('isUpgrade', () => {
    it('returns true for upgrade (higher price)', () => {
      expect(PlanService.isUpgrade('free', 'pro')).toBe(true)
      expect(PlanService.isUpgrade('pro', 'enterprise')).toBe(true)
    })

    it('returns false for downgrade (lower price)', () => {
      expect(PlanService.isUpgrade('pro', 'free')).toBe(false)
      expect(PlanService.isUpgrade('enterprise', 'pro')).toBe(false)
    })

    it('returns false for same plan', () => {
      expect(PlanService.isUpgrade('pro', 'pro')).toBe(false)
    })

    it('returns false for non-existent plan', () => {
      expect(PlanService.isUpgrade('non-existent', 'pro')).toBe(false)
      expect(PlanService.isUpgrade('pro', 'non-existent')).toBe(false)
    })
  })

  describe('getAllSlugs', () => {
    it('returns all plan slugs', () => {
      const slugs = PlanService.getAllSlugs()

      expect(slugs).toContain('free')
      expect(slugs).toContain('pro')
      expect(slugs).toContain('enterprise')
      expect(slugs).toHaveLength(3)
    })
  })

  describe('getPrice', () => {
    it('returns monthly price', () => {
      expect(PlanService.getPrice('pro', 'monthly')).toBe(2900)
    })

    it('returns yearly price', () => {
      expect(PlanService.getPrice('pro', 'yearly')).toBe(29000)
    })

    it('returns null for free plan', () => {
      expect(PlanService.getPrice('free', 'monthly')).toBe(0)
    })

    it('returns null for non-existent plan', () => {
      expect(PlanService.getPrice('non-existent', 'monthly')).toBeNull()
    })
  })

  describe('getStripePriceId', () => {
    it('returns monthly Stripe price ID', () => {
      expect(PlanService.getStripePriceId('pro', 'monthly')).toBe('price_pro_monthly')
    })

    it('returns yearly Stripe price ID', () => {
      expect(PlanService.getStripePriceId('pro', 'yearly')).toBe('price_pro_yearly')
    })

    it('returns null for plan without Stripe IDs', () => {
      expect(PlanService.getStripePriceId('free', 'monthly')).toBeNull()
    })

    it('returns null for non-existent plan', () => {
      expect(PlanService.getStripePriceId('non-existent', 'monthly')).toBeNull()
    })
  })
})
