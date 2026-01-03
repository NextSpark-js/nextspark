/**
 * Billing Schema Validation Tests
 *
 * Tests all Zod schemas for billing module to ensure proper validation
 * of API inputs and type safety.
 */

import { describe, test, expect } from '@jest/globals'
import {
  planTypeSchema,
  planVisibilitySchema,
  subscriptionStatusSchema,
  paymentProviderSchema,
  billingEventTypeSchema,
  billingEventStatusSchema,
  createPlanSchema,
  updatePlanSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  trackUsageSchema,
  createBillingEventSchema,
} from '@/core/lib/billing/schema'

// ===========================================
// ENUM SCHEMAS
// ===========================================

describe('Billing Schema - Enum Validations', () => {
  describe('planTypeSchema', () => {
    test('should accept valid plan types', () => {
      expect(planTypeSchema.safeParse('free').success).toBe(true)
      expect(planTypeSchema.safeParse('paid').success).toBe(true)
      expect(planTypeSchema.safeParse('enterprise').success).toBe(true)
    })

    test('should reject invalid plan types', () => {
      expect(planTypeSchema.safeParse('basic').success).toBe(false)
      expect(planTypeSchema.safeParse('premium').success).toBe(false)
      expect(planTypeSchema.safeParse('').success).toBe(false)
      expect(planTypeSchema.safeParse(null).success).toBe(false)
    })
  })

  describe('planVisibilitySchema', () => {
    test('should accept valid visibility values', () => {
      expect(planVisibilitySchema.safeParse('public').success).toBe(true)
      expect(planVisibilitySchema.safeParse('hidden').success).toBe(true)
      expect(planVisibilitySchema.safeParse('invite_only').success).toBe(true)
    })

    test('should reject invalid visibility values', () => {
      expect(planVisibilitySchema.safeParse('private').success).toBe(false)
      expect(planVisibilitySchema.safeParse('internal').success).toBe(false)
      expect(planVisibilitySchema.safeParse('').success).toBe(false)
    })
  })

  describe('subscriptionStatusSchema', () => {
    test('should accept valid subscription statuses', () => {
      const validStatuses = ['trialing', 'active', 'past_due', 'canceled', 'paused', 'expired']
      validStatuses.forEach(status => {
        expect(subscriptionStatusSchema.safeParse(status).success).toBe(true)
      })
    })

    test('should reject invalid subscription statuses', () => {
      expect(subscriptionStatusSchema.safeParse('pending').success).toBe(false)
      expect(subscriptionStatusSchema.safeParse('inactive').success).toBe(false)
      expect(subscriptionStatusSchema.safeParse('').success).toBe(false)
    })
  })

  describe('paymentProviderSchema', () => {
    test('should accept valid payment providers', () => {
      expect(paymentProviderSchema.safeParse('stripe').success).toBe(true)
      expect(paymentProviderSchema.safeParse('paddle').success).toBe(true)
      expect(paymentProviderSchema.safeParse('lemonsqueezy').success).toBe(true)
    })

    test('should reject invalid payment providers', () => {
      expect(paymentProviderSchema.safeParse('paypal').success).toBe(false)
      expect(paymentProviderSchema.safeParse('braintree').success).toBe(false)
    })
  })

  describe('billingEventTypeSchema', () => {
    test('should accept valid billing event types', () => {
      expect(billingEventTypeSchema.safeParse('payment').success).toBe(true)
      expect(billingEventTypeSchema.safeParse('refund').success).toBe(true)
      expect(billingEventTypeSchema.safeParse('invoice').success).toBe(true)
      expect(billingEventTypeSchema.safeParse('credit').success).toBe(true)
    })

    test('should reject invalid billing event types', () => {
      expect(billingEventTypeSchema.safeParse('chargeback').success).toBe(false)
      expect(billingEventTypeSchema.safeParse('dispute').success).toBe(false)
    })
  })

  describe('billingEventStatusSchema', () => {
    test('should accept valid billing event statuses', () => {
      expect(billingEventStatusSchema.safeParse('pending').success).toBe(true)
      expect(billingEventStatusSchema.safeParse('succeeded').success).toBe(true)
      expect(billingEventStatusSchema.safeParse('failed').success).toBe(true)
    })

    test('should reject invalid billing event statuses', () => {
      expect(billingEventStatusSchema.safeParse('processing').success).toBe(false)
      expect(billingEventStatusSchema.safeParse('completed').success).toBe(false)
    })
  })
})

// ===========================================
// PLAN SCHEMAS
// ===========================================

describe('Billing Schema - Plan Validations', () => {
  describe('createPlanSchema', () => {
    test('should accept valid plan data with all fields', () => {
      const validPlan = {
        slug: 'pro-plan',
        name: 'Pro Plan',
        description: 'Professional tier with advanced features',
        type: 'paid' as const,
        visibility: 'public' as const,
        priceMonthly: 2900,
        priceYearly: 29000,
        currency: 'usd',
        trialDays: 14,
        features: ['advanced-analytics', 'priority-support'],
        limits: { api_calls: 10000, storage_gb: 100 },
        metadata: { popular: true, highlight: 'Best Value' },
        sortOrder: 2,
      }

      const result = createPlanSchema.safeParse(validPlan)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBe('pro-plan')
        expect(result.data.name).toBe('Pro Plan')
        expect(result.data.priceMonthly).toBe(2900)
      }
    })

    test('should accept valid plan with only required fields', () => {
      const minimalPlan = {
        slug: 'free-plan',
        name: 'Free Plan',
      }

      const result = createPlanSchema.safeParse(minimalPlan)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('paid') // default
        expect(result.data.visibility).toBe('public') // default
        expect(result.data.currency).toBe('usd') // default
        expect(result.data.trialDays).toBe(0) // default
        expect(result.data.features).toEqual([]) // default
        expect(result.data.limits).toEqual({}) // default
        expect(result.data.metadata).toEqual({}) // default
        expect(result.data.sortOrder).toBe(0) // default
      }
    })

    test('should reject invalid slug format', () => {
      const invalidSlugs = [
        { slug: '', name: 'Plan' }, // empty
        { slug: 'Pro Plan', name: 'Plan' }, // spaces
        { slug: 'pro_plan', name: 'Plan' }, // underscore
        { slug: 'PRO-PLAN', name: 'Plan' }, // uppercase
        { slug: 'pro@plan', name: 'Plan' }, // special chars
      ]

      invalidSlugs.forEach(plan => {
        expect(createPlanSchema.safeParse(plan).success).toBe(false)
      })
    })

    test('should accept valid slug formats', () => {
      const validSlugs = [
        'free',
        'pro-plan',
        'enterprise-2024',
        'startup-tier',
        'plan-123',
      ]

      validSlugs.forEach(slug => {
        expect(createPlanSchema.safeParse({ slug, name: 'Test' }).success).toBe(true)
      })
    })

    test('should reject empty or too long name', () => {
      expect(createPlanSchema.safeParse({ slug: 'test', name: '' }).success).toBe(false)
      expect(createPlanSchema.safeParse({ slug: 'test', name: 'a'.repeat(101) }).success).toBe(false)
    })

    test('should reject too long description', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        description: 'a'.repeat(501),
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(false)
    })

    test('should reject negative prices', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        priceMonthly: -100,
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(false)
    })

    test('should reject invalid currency code', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        currency: 'US', // too short
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(false)

      const plan2 = {
        slug: 'test',
        name: 'Test',
        currency: 'USDD', // too long
      }
      expect(createPlanSchema.safeParse(plan2).success).toBe(false)
    })

    test('should accept valid currency codes', () => {
      const currencies = ['usd', 'eur', 'gbp', 'jpy']
      currencies.forEach(currency => {
        const plan = { slug: 'test', name: 'Test', currency }
        expect(createPlanSchema.safeParse(plan).success).toBe(true)
      })
    })

    test('should reject negative trial days', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        trialDays: -5,
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(false)
    })

    test('should enforce features as array of strings', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        features: ['feature1', 'feature2'],
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(true)

      const invalidPlan = {
        slug: 'test',
        name: 'Test',
        features: 'feature1', // string instead of array
      }
      expect(createPlanSchema.safeParse(invalidPlan).success).toBe(false)
    })

    test('should enforce limits as record of integers', () => {
      const plan = {
        slug: 'test',
        name: 'Test',
        limits: { api_calls: 1000, users: 5 },
      }
      expect(createPlanSchema.safeParse(plan).success).toBe(true)

      const invalidPlan = {
        slug: 'test',
        name: 'Test',
        limits: { api_calls: 1000.5 }, // float not allowed
      }
      expect(createPlanSchema.safeParse(invalidPlan).success).toBe(false)
    })
  })

  describe('updatePlanSchema', () => {
    test('should accept partial plan updates', () => {
      const updates = [
        { name: 'Updated Name' },
        { priceMonthly: 3900 },
        { visibility: 'hidden' as const },
        { features: ['new-feature'] },
        {},
      ]

      updates.forEach(update => {
        expect(updatePlanSchema.safeParse(update).success).toBe(true)
      })
    })

    test('should still enforce validation rules on provided fields', () => {
      const invalidUpdates = [
        { slug: 'INVALID SLUG' },
        { priceMonthly: -100 },
        { currency: 'TOOLONG' },
      ]

      invalidUpdates.forEach(update => {
        expect(updatePlanSchema.safeParse(update).success).toBe(false)
      })
    })
  })
})

// ===========================================
// SUBSCRIPTION SCHEMAS
// ===========================================

describe('Billing Schema - Subscription Validations', () => {
  describe('createSubscriptionSchema', () => {
    test('should accept valid subscription data', () => {
      const validSubscription = {
        teamId: 'team-123',
        userId: 'user-456',
        planId: 'plan-789',
        status: 'active' as const,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }

      const result = createSubscriptionSchema.safeParse(validSubscription)
      expect(result.success).toBe(true)
    })

    test('should accept subscription without optional fields', () => {
      const minimalSubscription = {
        teamId: 'team-123',
        planId: 'plan-789',
      }

      const result = createSubscriptionSchema.safeParse(minimalSubscription)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active') // default
      }
    })

    test('should reject empty required fields', () => {
      const invalidSubscriptions = [
        { teamId: '', planId: 'plan-123' },
        { teamId: 'team-123', planId: '' },
        { planId: 'plan-123' }, // missing teamId
        { teamId: 'team-123' }, // missing planId
      ]

      invalidSubscriptions.forEach(subscription => {
        expect(createSubscriptionSchema.safeParse(subscription).success).toBe(false)
      })
    })

    test('should reject invalid datetime formats', () => {
      const subscription = {
        teamId: 'team-123',
        planId: 'plan-789',
        currentPeriodStart: 'not-a-date',
      }
      expect(createSubscriptionSchema.safeParse(subscription).success).toBe(false)
    })

    test('should accept valid ISO datetime strings', () => {
      const subscription = {
        teamId: 'team-123',
        planId: 'plan-789',
        currentPeriodStart: '2024-12-20T10:00:00Z',
        currentPeriodEnd: '2025-01-20T10:00:00Z',
      }
      expect(createSubscriptionSchema.safeParse(subscription).success).toBe(true)
    })
  })

  describe('updateSubscriptionSchema', () => {
    test('should accept partial subscription updates', () => {
      const updates = [
        { status: 'canceled' as const },
        { planId: 'new-plan-id' },
        { cancelAtPeriodEnd: true },
        { status: 'paused' as const, cancelAtPeriodEnd: false },
        {},
      ]

      updates.forEach(update => {
        expect(updateSubscriptionSchema.safeParse(update).success).toBe(true)
      })
    })

    test('should reject invalid status values', () => {
      expect(updateSubscriptionSchema.safeParse({ status: 'invalid' }).success).toBe(false)
    })

    test('should reject empty planId', () => {
      expect(updateSubscriptionSchema.safeParse({ planId: '' }).success).toBe(false)
    })

    test('should enforce boolean type for cancelAtPeriodEnd', () => {
      expect(updateSubscriptionSchema.safeParse({ cancelAtPeriodEnd: true }).success).toBe(true)
      expect(updateSubscriptionSchema.safeParse({ cancelAtPeriodEnd: false }).success).toBe(true)
      expect(updateSubscriptionSchema.safeParse({ cancelAtPeriodEnd: 'yes' }).success).toBe(false)
    })
  })
})

// ===========================================
// USAGE SCHEMAS
// ===========================================

describe('Billing Schema - Usage Validations', () => {
  describe('trackUsageSchema', () => {
    test('should accept valid usage tracking data', () => {
      const validUsage = {
        limitSlug: 'api_calls',
        delta: 5,
        action: 'create_task',
        resourceType: 'task',
        resourceId: 'task-123',
        metadata: { endpoint: '/api/tasks', method: 'POST' },
      }

      const result = trackUsageSchema.safeParse(validUsage)
      expect(result.success).toBe(true)
    })

    test('should accept usage with only required fields', () => {
      const minimalUsage = {
        limitSlug: 'storage_gb',
        delta: 1,
      }

      const result = trackUsageSchema.safeParse(minimalUsage)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata).toEqual({}) // default
      }
    })

    test('should accept negative delta for usage release', () => {
      const usage = {
        limitSlug: 'api_calls',
        delta: -5,
      }
      expect(trackUsageSchema.safeParse(usage).success).toBe(true)
    })

    test('should reject empty limitSlug', () => {
      const usage = {
        limitSlug: '',
        delta: 1,
      }
      expect(trackUsageSchema.safeParse(usage).success).toBe(false)
    })

    test('should reject non-integer delta', () => {
      const usage = {
        limitSlug: 'api_calls',
        delta: 1.5,
      }
      expect(trackUsageSchema.safeParse(usage).success).toBe(false)
    })

    test('should reject missing required fields', () => {
      expect(trackUsageSchema.safeParse({ limitSlug: 'api_calls' }).success).toBe(false)
      expect(trackUsageSchema.safeParse({ delta: 1 }).success).toBe(false)
    })
  })
})

// ===========================================
// BILLING EVENT SCHEMAS
// ===========================================

describe('Billing Schema - Billing Event Validations', () => {
  describe('createBillingEventSchema', () => {
    test('should accept valid billing event data', () => {
      const validEvent = {
        subscriptionId: 'sub-123',
        type: 'payment' as const,
        status: 'succeeded' as const,
        amount: 2900,
        currency: 'usd',
        externalPaymentId: 'pi_123456',
        invoiceUrl: 'https://example.com/invoice/123',
        receiptUrl: 'https://example.com/receipt/123',
        metadata: { stripe_charge_id: 'ch_123' },
      }

      const result = createBillingEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    test('should accept event with only required fields', () => {
      const minimalEvent = {
        subscriptionId: 'sub-123',
        type: 'payment' as const,
        amount: 1000,
      }

      const result = createBillingEventSchema.safeParse(minimalEvent)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('pending') // default
        expect(result.data.currency).toBe('usd') // default
        expect(result.data.metadata).toEqual({}) // default
      }
    })

    test('should reject empty subscriptionId', () => {
      const event = {
        subscriptionId: '',
        type: 'payment' as const,
        amount: 1000,
      }
      expect(createBillingEventSchema.safeParse(event).success).toBe(false)
    })

    test('should reject negative amount', () => {
      const event = {
        subscriptionId: 'sub-123',
        type: 'payment' as const,
        amount: -100,
      }
      expect(createBillingEventSchema.safeParse(event).success).toBe(false)
    })

    test('should accept zero amount', () => {
      const event = {
        subscriptionId: 'sub-123',
        type: 'credit' as const,
        amount: 0,
      }
      expect(createBillingEventSchema.safeParse(event).success).toBe(true)
    })

    test('should reject invalid URL formats', () => {
      const invalidUrls = [
        { subscriptionId: 'sub-123', type: 'payment' as const, amount: 100, invoiceUrl: 'not-a-url' },
        { subscriptionId: 'sub-123', type: 'payment' as const, amount: 100, receiptUrl: 'invalid' },
      ]

      invalidUrls.forEach(event => {
        expect(createBillingEventSchema.safeParse(event).success).toBe(false)
      })
    })

    test('should accept valid URL formats', () => {
      const validEvent = {
        subscriptionId: 'sub-123',
        type: 'payment' as const,
        amount: 100,
        invoiceUrl: 'https://stripe.com/invoice/123',
        receiptUrl: 'https://stripe.com/receipt/123',
      }
      expect(createBillingEventSchema.safeParse(validEvent).success).toBe(true)
    })

    test('should accept all billing event types', () => {
      const types = ['payment', 'refund', 'invoice', 'credit'] as const
      types.forEach(type => {
        const event = {
          subscriptionId: 'sub-123',
          type,
          amount: 100,
        }
        expect(createBillingEventSchema.safeParse(event).success).toBe(true)
      })
    })

    test('should accept all billing event statuses', () => {
      const statuses = ['pending', 'succeeded', 'failed'] as const
      statuses.forEach(status => {
        const event = {
          subscriptionId: 'sub-123',
          type: 'payment' as const,
          status,
          amount: 100,
        }
        expect(createBillingEventSchema.safeParse(event).success).toBe(true)
      })
    })
  })
})
