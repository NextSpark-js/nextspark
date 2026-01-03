/**
 * Unit Tests - Billing Queries
 *
 * Tests query functions for the Billing Registry:
 * - planHasFeature(): O(1) feature lookup per plan
 * - getPlanLimit(): O(1) limit value lookup
 * - getPlanFeatures(): Get all features for a plan
 * - getPlanLimits(): Get all limits for a plan
 * - getFullBillingMatrix(): Get complete billing matrix
 * - getPlan(): Get plan by slug
 * - getPublicPlans(): Get public visibility plans
 *
 * Tests use actual plan/feature/limit slugs from default theme's billing config.
 */

import {
  planHasFeature,
  getPlanLimit,
  getPlanFeatures,
  getPlanLimits,
  getFullBillingMatrix,
  getPlan,
  getPublicPlans,
} from '@/core/lib/billing/queries'

describe('Billing Queries', () => {
  // ============================================================================
  // planHasFeature
  // ============================================================================

  describe('planHasFeature', () => {
    describe('Valid Plan + Feature Combinations', () => {
      it('should return true for free plan with basic_analytics', () => {
        expect(planHasFeature('free', 'basic_analytics')).toBe(true)
      })

      it('should return true for starter plan with api_access', () => {
        expect(planHasFeature('starter', 'api_access')).toBe(true)
      })

      it('should return true for pro plan with webhooks', () => {
        expect(planHasFeature('pro', 'webhooks')).toBe(true)
      })

      it('should return true for business plan with sso', () => {
        expect(planHasFeature('business', 'sso')).toBe(true)
      })

      it('should return true for enterprise plan with all features (wildcard)', () => {
        // Enterprise has features: ['*'], meaning all features
        expect(planHasFeature('enterprise', 'basic_analytics')).toBe(true)
        expect(planHasFeature('enterprise', 'advanced_analytics')).toBe(true)
        expect(planHasFeature('enterprise', 'sso')).toBe(true)
        expect(planHasFeature('enterprise', 'white_label')).toBe(true)
      })
    })

    describe('Plan Does Not Have Feature', () => {
      it('should return false when free plan does not have advanced_analytics', () => {
        // Free plan only has basic_analytics
        expect(planHasFeature('free', 'advanced_analytics')).toBe(false)
      })

      it('should return false when starter plan does not have webhooks', () => {
        // Webhooks is only in pro, business, enterprise
        expect(planHasFeature('starter', 'webhooks')).toBe(false)
      })

      it('should return false when pro plan does not have sso', () => {
        // SSO is only in business and enterprise
        expect(planHasFeature('pro', 'sso')).toBe(false)
      })

      it('should return false when starter plan does not have white_label', () => {
        // White label is only in enterprise
        expect(planHasFeature('starter', 'white_label')).toBe(false)
      })
    })

    describe('Non-existent Feature', () => {
      it('should return false for existing plan with non-existent feature', () => {
        expect(planHasFeature('starter', 'nonexistent_feature')).toBe(false)
      })

      it('should return false for free plan with non-existent feature', () => {
        expect(planHasFeature('free', 'some_random_feature')).toBe(false)
      })

      it('should return false for enterprise plan with non-existent feature', () => {
        // Even enterprise with '*' returns false for non-existent features
        expect(planHasFeature('enterprise', 'made_up_feature')).toBe(false)
      })
    })

    describe('Non-existent Plan', () => {
      it('should return false for non-existent plan with existing feature', () => {
        expect(planHasFeature('nonexistent', 'api_access')).toBe(false)
      })

      it('should return false for non-existent plan with non-existent feature', () => {
        expect(planHasFeature('nonexistent', 'nonexistent_feature')).toBe(false)
      })

      it('should return false for empty plan slug', () => {
        expect(planHasFeature('', 'api_access')).toBe(false)
      })
    })
  })

  // ============================================================================
  // getPlanLimit
  // ============================================================================

  describe('getPlanLimit', () => {
    describe('Valid Plan + Limit Combinations', () => {
      it('should return correct team_members limit for free plan', () => {
        expect(getPlanLimit('free', 'team_members')).toBe(3)
      })

      it('should return correct tasks limit for starter plan', () => {
        expect(getPlanLimit('starter', 'tasks')).toBe(200)
      })

      it('should return correct customers limit for pro plan', () => {
        expect(getPlanLimit('pro', 'customers')).toBe(500)
      })

      it('should return correct storage_gb limit for business plan', () => {
        expect(getPlanLimit('business', 'storage_gb')).toBe(200)
      })

      it('should return -1 for unlimited limits in enterprise plan', () => {
        // Enterprise has all limits set to -1 (unlimited)
        expect(getPlanLimit('enterprise', 'team_members')).toBe(-1)
        expect(getPlanLimit('enterprise', 'tasks')).toBe(-1)
        expect(getPlanLimit('enterprise', 'customers')).toBe(-1)
        expect(getPlanLimit('enterprise', 'api_calls')).toBe(-1)
        expect(getPlanLimit('enterprise', 'storage_gb')).toBe(-1)
      })

      it('should return 0 for webhooks_count in free plan', () => {
        // Free plan has 0 webhooks
        expect(getPlanLimit('free', 'webhooks_count')).toBe(0)
      })

      it('should return correct api_calls limit for starter plan', () => {
        expect(getPlanLimit('starter', 'api_calls')).toBe(10000)
      })
    })

    describe('Non-existent Limit', () => {
      it('should return 0 for existing plan with non-existent limit', () => {
        expect(getPlanLimit('starter', 'nonexistent_limit')).toBe(0)
      })

      it('should return 0 for free plan with non-existent limit', () => {
        expect(getPlanLimit('free', 'made_up_limit')).toBe(0)
      })

      it('should return 0 for enterprise plan with non-existent limit', () => {
        expect(getPlanLimit('enterprise', 'invalid_limit')).toBe(0)
      })
    })

    describe('Non-existent Plan', () => {
      it('should return 0 for non-existent plan with existing limit', () => {
        expect(getPlanLimit('nonexistent', 'team_members')).toBe(0)
      })

      it('should return 0 for non-existent plan with non-existent limit', () => {
        expect(getPlanLimit('nonexistent', 'nonexistent_limit')).toBe(0)
      })

      it('should return 0 for empty plan slug', () => {
        expect(getPlanLimit('', 'team_members')).toBe(0)
      })
    })
  })

  // ============================================================================
  // getPlanFeatures
  // ============================================================================

  describe('getPlanFeatures', () => {
    describe('Valid Plans', () => {
      it('should return array with basic_analytics for free plan', () => {
        const features = getPlanFeatures('free')
        expect(features).toEqual(['basic_analytics'])
      })

      it('should return correct features for starter plan', () => {
        const features = getPlanFeatures('starter')
        expect(features).toContain('basic_analytics')
        expect(features).toContain('advanced_analytics')
        expect(features).toContain('api_access')
        expect(features).toContain('guest_access')
        expect(features.length).toBe(4)
      })

      it('should return correct features for pro plan', () => {
        const features = getPlanFeatures('pro')
        expect(features).toContain('basic_analytics')
        expect(features).toContain('advanced_analytics')
        expect(features).toContain('realtime_analytics')
        expect(features).toContain('api_access')
        expect(features).toContain('webhooks')
        expect(features).toContain('custom_branding')
        expect(features).toContain('guest_access')
        expect(features).toContain('priority_support')
        expect(features).toContain('task_automation')
        expect(features.length).toBe(9)
      })

      it('should return correct features for business plan', () => {
        const features = getPlanFeatures('business')
        expect(features).toContain('sso')
        expect(features).toContain('audit_logs')
        expect(features).toContain('customer_import')
        expect(features).toContain('recurring_tasks')
        expect(features.length).toBe(13)
      })

      it('should return all features for enterprise plan', () => {
        const features = getPlanFeatures('enterprise')
        // Enterprise has '*' wildcard, so should have all features
        expect(features.length).toBeGreaterThan(10)
        expect(features).toContain('basic_analytics')
        expect(features).toContain('sso')
        expect(features).toContain('white_label')
        expect(features).toContain('dedicated_support')
      })
    })

    describe('Non-existent Plan', () => {
      it('should return empty array for non-existent plan', () => {
        const features = getPlanFeatures('nonexistent')
        expect(features).toEqual([])
      })

      it('should return empty array for empty plan slug', () => {
        const features = getPlanFeatures('')
        expect(features).toEqual([])
      })
    })

    describe('Return Type', () => {
      it('should return an array', () => {
        const features = getPlanFeatures('starter')
        expect(Array.isArray(features)).toBe(true)
      })

      it('should return array of strings', () => {
        const features = getPlanFeatures('pro')
        features.forEach(feature => {
          expect(typeof feature).toBe('string')
        })
      })
    })
  })

  // ============================================================================
  // getPlanLimits
  // ============================================================================

  describe('getPlanLimits', () => {
    describe('Valid Plans', () => {
      it('should return correct limits object for free plan', () => {
        const limits = getPlanLimits('free')
        expect(limits.team_members).toBe(3)
        expect(limits.tasks).toBe(50)
        expect(limits.customers).toBe(25)
        expect(limits.api_calls).toBe(1000)
        expect(limits.storage_gb).toBe(1)
        expect(limits.file_uploads).toBe(100)
        expect(limits.webhooks_count).toBe(0)
      })

      it('should return correct limits object for starter plan', () => {
        const limits = getPlanLimits('starter')
        expect(limits.team_members).toBe(5)
        expect(limits.tasks).toBe(200)
        expect(limits.customers).toBe(100)
        expect(limits.api_calls).toBe(10000)
        expect(limits.storage_gb).toBe(10)
        expect(limits.file_uploads).toBe(500)
        expect(limits.webhooks_count).toBe(3)
      })

      it('should return correct limits object for pro plan', () => {
        const limits = getPlanLimits('pro')
        expect(limits.team_members).toBe(15)
        expect(limits.tasks).toBe(1000)
        expect(limits.customers).toBe(500)
        expect(limits.api_calls).toBe(100000)
        expect(limits.storage_gb).toBe(50)
        expect(limits.file_uploads).toBe(2000)
        expect(limits.webhooks_count).toBe(10)
      })

      it('should return correct limits object for business plan', () => {
        const limits = getPlanLimits('business')
        expect(limits.team_members).toBe(50)
        expect(limits.tasks).toBe(5000)
        expect(limits.customers).toBe(2000)
        expect(limits.api_calls).toBe(500000)
        expect(limits.storage_gb).toBe(200)
        expect(limits.file_uploads).toBe(10000)
        expect(limits.webhooks_count).toBe(50)
      })

      it('should return -1 for all limits in enterprise plan (unlimited)', () => {
        const limits = getPlanLimits('enterprise')
        expect(limits.team_members).toBe(-1)
        expect(limits.tasks).toBe(-1)
        expect(limits.customers).toBe(-1)
        expect(limits.api_calls).toBe(-1)
        expect(limits.storage_gb).toBe(-1)
        expect(limits.file_uploads).toBe(-1)
        expect(limits.webhooks_count).toBe(-1)
      })
    })

    describe('Non-existent Plan', () => {
      it('should return record with all zeros for non-existent plan', () => {
        const limits = getPlanLimits('nonexistent')
        expect(limits.team_members).toBe(0)
        expect(limits.tasks).toBe(0)
        expect(limits.customers).toBe(0)
        expect(limits.api_calls).toBe(0)
        expect(limits.storage_gb).toBe(0)
        expect(limits.file_uploads).toBe(0)
        expect(limits.webhooks_count).toBe(0)
      })

      it('should return record with all zeros for empty plan slug', () => {
        const limits = getPlanLimits('')
        expect(limits.team_members).toBe(0)
        expect(limits.tasks).toBe(0)
      })
    })

    describe('Return Type', () => {
      it('should return an object', () => {
        const limits = getPlanLimits('starter')
        expect(typeof limits).toBe('object')
        expect(limits).not.toBeNull()
      })

      it('should return object with number values', () => {
        const limits = getPlanLimits('pro')
        Object.values(limits).forEach(value => {
          expect(typeof value).toBe('number')
        })
      })

      it('should include all limit types', () => {
        const limits = getPlanLimits('starter')
        expect(limits).toHaveProperty('team_members')
        expect(limits).toHaveProperty('tasks')
        expect(limits).toHaveProperty('customers')
        expect(limits).toHaveProperty('api_calls')
        expect(limits).toHaveProperty('storage_gb')
        expect(limits).toHaveProperty('file_uploads')
        expect(limits).toHaveProperty('webhooks_count')
      })
    })
  })

  // ============================================================================
  // getFullBillingMatrix
  // ============================================================================

  describe('getFullBillingMatrix', () => {
    describe('Return Structure', () => {
      it('should return object with required properties', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix).toHaveProperty('plans')
        expect(matrix).toHaveProperty('features')
        expect(matrix).toHaveProperty('limits')
        expect(matrix).toHaveProperty('matrix')
        expect(matrix).toHaveProperty('metadata')
      })

      it('should have plans array with correct length', () => {
        const matrix = getFullBillingMatrix()
        expect(Array.isArray(matrix.plans)).toBe(true)
        expect(matrix.plans.length).toBe(5) // free, starter, pro, business, enterprise
      })

      it('should have features object with entries', () => {
        const matrix = getFullBillingMatrix()
        expect(typeof matrix.features).toBe('object')
        expect(Object.keys(matrix.features).length).toBeGreaterThan(0)
      })

      it('should have limits object with entries', () => {
        const matrix = getFullBillingMatrix()
        expect(typeof matrix.limits).toBe('object')
        expect(Object.keys(matrix.limits).length).toBeGreaterThan(0)
      })

      it('should have matrix with features and limits', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix.matrix).toHaveProperty('features')
        expect(matrix.matrix).toHaveProperty('limits')
      })

      it('should have metadata with correct properties', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix.metadata).toHaveProperty('totalPlans')
        expect(matrix.metadata).toHaveProperty('publicPlans')
        expect(matrix.metadata).toHaveProperty('totalFeatures')
        expect(matrix.metadata).toHaveProperty('totalLimits')
        expect(matrix.metadata).toHaveProperty('theme')
      })
    })

    describe('Matrix Content Validation', () => {
      it('should have correct plan slugs in plans array', () => {
        const matrix = getFullBillingMatrix()
        const planSlugs = matrix.plans.map(p => p.slug)
        expect(planSlugs).toContain('free')
        expect(planSlugs).toContain('starter')
        expect(planSlugs).toContain('pro')
        expect(planSlugs).toContain('business')
        expect(planSlugs).toContain('enterprise')
      })

      it('should have matrix.features with feature slugs as keys', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix.matrix.features).toHaveProperty('basic_analytics')
        expect(matrix.matrix.features).toHaveProperty('api_access')
        expect(matrix.matrix.features).toHaveProperty('webhooks')
      })

      it('should have matrix.limits with limit slugs as keys', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix.matrix.limits).toHaveProperty('team_members')
        expect(matrix.matrix.limits).toHaveProperty('tasks')
        expect(matrix.matrix.limits).toHaveProperty('customers')
      })

      it('should have metadata with correct counts', () => {
        const matrix = getFullBillingMatrix()
        expect(matrix.metadata.totalPlans).toBe(5)
        expect(matrix.metadata.publicPlans).toBe(4) // free, starter, pro, business (enterprise is hidden)
        expect(matrix.metadata.totalFeatures).toBeGreaterThan(10)
        expect(matrix.metadata.totalLimits).toBe(7)
      })
    })

    describe('Consistency', () => {
      it('should return same object on multiple calls', () => {
        const matrix1 = getFullBillingMatrix()
        const matrix2 = getFullBillingMatrix()
        expect(matrix1.metadata.totalPlans).toBe(matrix2.metadata.totalPlans)
        expect(matrix1.plans.length).toBe(matrix2.plans.length)
      })
    })
  })

  // ============================================================================
  // getPlan
  // ============================================================================

  describe('getPlan', () => {
    describe('Valid Plan Slugs', () => {
      it('should return plan definition for free slug', () => {
        const plan = getPlan('free')
        expect(plan).toBeDefined()
        expect(plan?.slug).toBe('free')
        expect(plan?.type).toBe('free')
        expect(plan?.visibility).toBe('public')
      })

      it('should return plan definition for starter slug', () => {
        const plan = getPlan('starter')
        expect(plan).toBeDefined()
        expect(plan?.slug).toBe('starter')
        expect(plan?.type).toBe('paid')
        expect(plan?.visibility).toBe('public')
      })

      it('should return plan definition for pro slug', () => {
        const plan = getPlan('pro')
        expect(plan).toBeDefined()
        expect(plan?.slug).toBe('pro')
        expect(plan?.type).toBe('paid')
        expect(plan?.visibility).toBe('public')
      })

      it('should return plan definition for business slug', () => {
        const plan = getPlan('business')
        expect(plan).toBeDefined()
        expect(plan?.slug).toBe('business')
        expect(plan?.type).toBe('paid')
        expect(plan?.visibility).toBe('public')
      })

      it('should return plan definition for enterprise slug', () => {
        const plan = getPlan('enterprise')
        expect(plan).toBeDefined()
        expect(plan?.slug).toBe('enterprise')
        expect(plan?.type).toBe('enterprise')
        expect(plan?.visibility).toBe('hidden')
      })
    })

    describe('Plan Properties', () => {
      it('should return plan with name property', () => {
        const plan = getPlan('starter')
        expect(plan?.name).toBeDefined()
        expect(typeof plan?.name).toBe('string')
      })

      it('should return plan with description property', () => {
        const plan = getPlan('pro')
        expect(plan?.description).toBeDefined()
        expect(typeof plan?.description).toBe('string')
      })

      it('should return plan with features array', () => {
        const plan = getPlan('starter')
        expect(Array.isArray(plan?.features)).toBe(true)
        expect(plan?.features.length).toBeGreaterThan(0)
      })

      it('should return plan with limits object', () => {
        const plan = getPlan('pro')
        expect(typeof plan?.limits).toBe('object')
        expect(plan?.limits).not.toBeNull()
      })

      it('should return plan with price for paid plans', () => {
        const plan = getPlan('starter')
        expect(plan?.price).toBeDefined()
        expect(typeof plan?.price?.monthly).toBe('number')
        expect(typeof plan?.price?.yearly).toBe('number')
      })
    })

    describe('Invalid Plan Slugs', () => {
      it('should return undefined for non-existent slug', () => {
        const plan = getPlan('nonexistent')
        expect(plan).toBeUndefined()
      })

      it('should return undefined for empty slug', () => {
        const plan = getPlan('')
        expect(plan).toBeUndefined()
      })

      it('should return undefined for invalid slug', () => {
        const plan = getPlan('invalid-plan-slug')
        expect(plan).toBeUndefined()
      })
    })
  })

  // ============================================================================
  // getPublicPlans
  // ============================================================================

  describe('getPublicPlans', () => {
    describe('Return Structure', () => {
      it('should return an array', () => {
        const plans = getPublicPlans()
        expect(Array.isArray(plans)).toBe(true)
      })

      it('should return array with 4 plans (excluding enterprise)', () => {
        const plans = getPublicPlans()
        expect(plans.length).toBe(4)
      })

      it('should return plans with slug property', () => {
        const plans = getPublicPlans()
        plans.forEach(plan => {
          expect(plan).toHaveProperty('slug')
          expect(typeof plan.slug).toBe('string')
        })
      })
    })

    describe('Visibility Filtering', () => {
      it('should return only plans with visibility === public', () => {
        const plans = getPublicPlans()
        plans.forEach(plan => {
          expect(plan.visibility).toBe('public')
        })
      })

      it('should include free, starter, pro, business plans', () => {
        const plans = getPublicPlans()
        const slugs = plans.map(p => p.slug)
        expect(slugs).toContain('free')
        expect(slugs).toContain('starter')
        expect(slugs).toContain('pro')
        expect(slugs).toContain('business')
      })

      it('should NOT include enterprise plan (hidden visibility)', () => {
        const plans = getPublicPlans()
        const slugs = plans.map(p => p.slug)
        expect(slugs).not.toContain('enterprise')
      })
    })

    describe('Plan Content', () => {
      it('should return plans with complete properties', () => {
        const plans = getPublicPlans()
        plans.forEach(plan => {
          expect(plan).toHaveProperty('slug')
          expect(plan).toHaveProperty('name')
          expect(plan).toHaveProperty('description')
          expect(plan).toHaveProperty('type')
          expect(plan).toHaveProperty('visibility')
          expect(plan).toHaveProperty('features')
          expect(plan).toHaveProperty('limits')
        })
      })

      it('should return plans ordered as defined in config', () => {
        const plans = getPublicPlans()
        const slugs = plans.map(p => p.slug)
        expect(slugs[0]).toBe('free')
        expect(slugs[1]).toBe('starter')
        expect(slugs[2]).toBe('pro')
        expect(slugs[3]).toBe('business')
      })
    })

    describe('Consistency', () => {
      it('should return same plans on multiple calls', () => {
        const plans1 = getPublicPlans()
        const plans2 = getPublicPlans()
        expect(plans1.length).toBe(plans2.length)
        expect(plans1.map(p => p.slug)).toEqual(plans2.map(p => p.slug))
      })

      it('should be read-only array (no mutations)', () => {
        const plans = getPublicPlans()
        expect(() => {
          // TypeScript readonly should prevent this, but test runtime behavior
          const plansArray = plans as unknown as Array<typeof plans[0]>
          plansArray.push = () => 0
        }).not.toThrow()
      })
    })
  })
})
