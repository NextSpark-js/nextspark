/**
 * Unit tests for Stripe Payment Gateway Integration
 *
 * Tests the StripeGateway class, deprecated standalone functions,
 * and the getBillingGateway() factory.
 * Mocks Stripe SDK to avoid actual API calls.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock Stripe SDK before importing gateway
const mockCheckoutSessionsCreate = jest.fn()
const mockBillingPortalSessionsCreate = jest.fn()
const mockWebhooksConstructEvent = jest.fn()
const mockCustomersRetrieve = jest.fn()
const mockCustomersCreate = jest.fn()
const mockSubscriptionsRetrieve = jest.fn()
const mockSubscriptionsUpdate = jest.fn()
const mockSubscriptionsCancel = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate
      }
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate
      }
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent
    },
    customers: {
      retrieve: mockCustomersRetrieve,
      create: mockCustomersCreate
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
      cancel: mockSubscriptionsCancel,
    }
  }))
})

// Mock BILLING_REGISTRY
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    provider: 'stripe',
    plans: [
      {
        slug: 'free',
        name: 'Free',
        stripePriceIdMonthly: null,
        stripePriceIdYearly: null,
        trialDays: 0,
        limits: {},
        features: []
      },
      {
        slug: 'pro',
        name: 'Pro',
        stripePriceIdMonthly: 'price_pro_monthly',
        stripePriceIdYearly: 'price_pro_yearly',
        trialDays: 14,
        limits: { projects: 10 },
        features: ['advanced_analytics']
      },
      {
        slug: 'enterprise',
        name: 'Enterprise',
        stripePriceIdMonthly: 'price_enterprise_monthly',
        stripePriceIdYearly: null,
        trialDays: 0,
        limits: { projects: -1 },
        features: ['*']
      },
      {
        slug: 'generic',
        name: 'Generic',
        providerPriceIds: {
          monthly: 'generic_monthly_123',
          yearly: 'generic_yearly_456',
        },
        trialDays: 0,
        limits: {},
        features: []
      }
    ],
    limits: {}
  }
}))

// Import after mocks are set up
import {
  StripeGateway,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  getCustomer,
  createCustomer,
  getStripeInstance,
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionImmediately,
  reactivateSubscription,
  updateSubscriptionPlan,
} from '@/core/lib/billing/gateways/stripe'
import { getBillingGateway, resetBillingGateway } from '@/core/lib/billing/gateways/factory'

describe('Stripe Gateway', () => {
  // Set up environment variables
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    resetBillingGateway()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'testkey_mock_key_123456789',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret_123456789'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ===========================================
  // StripeGateway class tests
  // ===========================================

  describe('StripeGateway class', () => {
    let gateway: StripeGateway

    beforeEach(() => {
      gateway = new StripeGateway()
    })

    describe('createCheckoutSession', () => {
      test('should create checkout session and return provider-agnostic result', async () => {
        const mockSession = {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
          metadata: { teamId: 'team-123', planSlug: 'pro' }
        }
        mockCheckoutSessionsCreate.mockResolvedValue(mockSession)

        const result = await gateway.createCheckoutSession({
          teamId: 'team-123',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerEmail: 'user@test.com'
        })

        // Returns provider-agnostic shape (only id + url)
        expect(result).toEqual({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
        })

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
          })
        )
      })

      test('should use yearly price when billingPeriod is yearly', async () => {
        mockCheckoutSessionsCreate.mockResolvedValue({
          id: 'cs_test_456',
          url: 'https://checkout.stripe.com/test-yearly'
        })

        await gateway.createCheckoutSession({
          teamId: 'team-456',
          planSlug: 'pro',
          billingPeriod: 'yearly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerEmail: 'user@test.com'
        })

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            line_items: [{ price: 'price_pro_yearly', quantity: 1 }]
          })
        )
      })

      test('should throw error for invalid plan slug', async () => {
        await expect(
          gateway.createCheckoutSession({
            teamId: 'team-invalid',
            planSlug: 'nonexistent',
            billingPeriod: 'monthly',
            successUrl: 'http://localhost:5173/success',
            cancelUrl: 'http://localhost:5173/cancel'
          })
        ).rejects.toThrow('Plan nonexistent not found in BILLING_REGISTRY')
      })

      test('should throw error for plan with no price ID', async () => {
        await expect(
          gateway.createCheckoutSession({
            teamId: 'team-free',
            planSlug: 'free',
            billingPeriod: 'monthly',
            successUrl: 'http://localhost:5173/success',
            cancelUrl: 'http://localhost:5173/cancel'
          })
        ).rejects.toThrow('No Stripe price configured for free monthly')
      })
    })

    describe('createPortalSession', () => {
      test('should create portal session and return provider-agnostic result', async () => {
        const mockPortalSession = {
          id: 'bps_test_123',
          url: 'https://billing.stripe.com/portal/test'
        }
        mockBillingPortalSessionsCreate.mockResolvedValue(mockPortalSession)

        const result = await gateway.createPortalSession({
          customerId: 'cus_test_123',
          returnUrl: 'http://localhost:5173/billing'
        })

        // Returns only url (provider-agnostic)
        expect(result).toEqual({ url: 'https://billing.stripe.com/portal/test' })
      })
    })

    describe('verifyWebhookSignature', () => {
      test('should verify and return provider-agnostic event', () => {
        const mockEvent = {
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123' } }
        }
        mockWebhooksConstructEvent.mockReturnValue(mockEvent)

        const result = gateway.verifyWebhookSignature('payload', 'sig_123')

        expect(result).toEqual({
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123' } },
        })
      })

      test('should throw when webhook secret is not configured', () => {
        delete process.env.STRIPE_WEBHOOK_SECRET

        expect(() => {
          gateway.verifyWebhookSignature('payload', 'signature')
        }).toThrow('STRIPE_WEBHOOK_SECRET is not configured')
      })
    })

    describe('getCustomer', () => {
      test('should return provider-agnostic customer', async () => {
        mockCustomersRetrieve.mockResolvedValue({
          id: 'cus_test_123',
          email: 'customer@test.com',
          name: 'Test Customer',
          // Stripe-specific fields stripped by gateway
          currency: 'usd',
        })

        const result = await gateway.getCustomer('cus_test_123')

        expect(result).toEqual({
          id: 'cus_test_123',
          email: 'customer@test.com',
          name: 'Test Customer',
        })
      })
    })

    describe('createCustomer', () => {
      test('should create customer and return provider-agnostic result', async () => {
        mockCustomersCreate.mockResolvedValue({
          id: 'cus_new_123',
          email: 'new@test.com',
          name: null,
        })

        const result = await gateway.createCustomer({ email: 'new@test.com' })

        expect(result).toEqual({
          id: 'cus_new_123',
          email: 'new@test.com',
          name: null,
        })
      })
    })

    describe('updateSubscriptionPlan', () => {
      test('should update subscription and return provider-agnostic result', async () => {
        mockSubscriptionsRetrieve.mockResolvedValue({
          id: 'sub_123',
          items: { data: [{ id: 'si_123' }] },
        })
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
        })

        const result = await gateway.updateSubscriptionPlan({
          subscriptionId: 'sub_123',
          newPriceId: 'price_new',
        })

        expect(result).toEqual({
          id: 'sub_123',
          status: 'active',
          cancelAtPeriodEnd: false,
        })
      })

      test('should throw if subscription has no items', async () => {
        mockSubscriptionsRetrieve.mockResolvedValue({
          id: 'sub_empty',
          items: { data: [] },
        })

        await expect(
          gateway.updateSubscriptionPlan({
            subscriptionId: 'sub_empty',
            newPriceId: 'price_new',
          })
        ).rejects.toThrow('Subscription has no items')
      })
    })

    describe('cancelSubscriptionAtPeriodEnd', () => {
      test('should soft-cancel and return provider-agnostic result', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: true,
        })

        const result = await gateway.cancelSubscriptionAtPeriodEnd('sub_123')

        expect(result).toEqual({
          id: 'sub_123',
          status: 'active',
          cancelAtPeriodEnd: true,
        })
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
          cancel_at_period_end: true,
        })
      })
    })

    describe('cancelSubscriptionImmediately', () => {
      test('should hard-cancel and return provider-agnostic result', async () => {
        mockSubscriptionsCancel.mockResolvedValue({
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: false,
        })

        const result = await gateway.cancelSubscriptionImmediately('sub_123')

        expect(result).toEqual({
          id: 'sub_123',
          status: 'canceled',
          cancelAtPeriodEnd: false,
        })
      })
    })

    describe('reactivateSubscription', () => {
      test('should reactivate and return provider-agnostic result', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
        })

        const result = await gateway.reactivateSubscription('sub_123')

        expect(result).toEqual({
          id: 'sub_123',
          status: 'active',
          cancelAtPeriodEnd: false,
        })
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
          cancel_at_period_end: false,
        })
      })
    })
  })

  // ===========================================
  // Factory tests
  // ===========================================

  describe('getBillingGateway() factory', () => {
    test('should return a StripeGateway when provider is stripe', () => {
      const gw = getBillingGateway()
      expect(gw).toBeInstanceOf(StripeGateway)
    })

    test('should return the same singleton instance', () => {
      const gw1 = getBillingGateway()
      const gw2 = getBillingGateway()
      expect(gw1).toBe(gw2)
    })

    test('should return a new instance after reset', () => {
      const gw1 = getBillingGateway()
      resetBillingGateway()
      const gw2 = getBillingGateway()
      expect(gw1).not.toBe(gw2)
    })
  })

  // ===========================================
  // Deprecated standalone function tests (backward compat)
  // ===========================================

  describe('Deprecated standalone functions', () => {
    describe('createCheckoutSession', () => {
      test('should create checkout session for pro plan monthly', async () => {
        const mockSession = {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
          metadata: { teamId: 'team-123', planSlug: 'pro' }
        }
        mockCheckoutSessionsCreate.mockResolvedValue(mockSession)

        const result = await createCheckoutSession({
          teamId: 'team-123',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerEmail: 'user@test.com'
        })

        expect(result).toEqual({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' })
        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
            success_url: 'http://localhost:5173/success',
            cancel_url: 'http://localhost:5173/cancel',
            metadata: { teamId: 'team-123', planSlug: 'pro', billingPeriod: 'monthly' },
            client_reference_id: 'team-123',
            customer_email: 'user@test.com'
          })
        )
      })

      test('should add trial period for plans with trialDays', async () => {
        mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_trial', url: null })

        await createCheckoutSession({
          teamId: 'team-trial',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerEmail: 'trial@test.com'
        })

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_data: {
              trial_period_days: 14
            }
          })
        )
      })

      test('should NOT add trial when using existing customer', async () => {
        mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_no_trial', url: null })

        await createCheckoutSession({
          teamId: 'team-no-trial',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerId: 'cus_existing_456'
        })

        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_data: expect.anything()
          })
        )
      })

      test('should throw error for invalid plan slug', async () => {
        await expect(
          createCheckoutSession({
            teamId: 'team-invalid',
            planSlug: 'nonexistent',
            billingPeriod: 'monthly',
            successUrl: 'http://localhost:5173/success',
            cancelUrl: 'http://localhost:5173/cancel'
          })
        ).rejects.toThrow('Plan nonexistent not found in BILLING_REGISTRY')
      })

      test('should throw error for plan with no Stripe price ID', async () => {
        await expect(
          createCheckoutSession({
            teamId: 'team-free',
            planSlug: 'free',
            billingPeriod: 'monthly',
            successUrl: 'http://localhost:5173/success',
            cancelUrl: 'http://localhost:5173/cancel'
          })
        ).rejects.toThrow('No Stripe price configured for free monthly')
      })
    })

    describe('createPortalSession', () => {
      test('should create portal session with customer ID', async () => {
        const mockPortalSession = {
          id: 'bps_test_123',
          url: 'https://billing.stripe.com/portal/test'
        }
        mockBillingPortalSessionsCreate.mockResolvedValue(mockPortalSession)

        const result = await createPortalSession({
          customerId: 'cus_test_123',
          returnUrl: 'http://localhost:5173/billing'
        })

        expect(result).toEqual({ url: 'https://billing.stripe.com/portal/test' })
        expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
          customer: 'cus_test_123',
          return_url: 'http://localhost:5173/billing'
        })
      })

      test('should handle Stripe API errors', async () => {
        mockBillingPortalSessionsCreate.mockRejectedValue(
          new Error('Customer not found')
        )

        await expect(
          createPortalSession({
            customerId: 'cus_invalid',
            returnUrl: 'http://localhost:5173/billing'
          })
        ).rejects.toThrow('Customer not found')
      })
    })

    describe('verifyWebhookSignature', () => {
      test('should verify valid webhook signature', () => {
        const mockEvent = {
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: { object: {} }
        }

        mockWebhooksConstructEvent.mockReturnValue(mockEvent)

        const payload = JSON.stringify({ test: 'data' })
        const signature = 'test_signature_123'

        const result = verifyWebhookSignature(payload, signature)

        expect(result).toEqual({
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: { object: {} },
        })
        expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
          payload,
          signature,
          'whsec_mock_secret_123456789'
        )
      })

      test('should throw error when webhook secret is not configured', () => {
        delete process.env.STRIPE_WEBHOOK_SECRET

        expect(() => {
          verifyWebhookSignature('payload', 'signature')
        }).toThrow('STRIPE_WEBHOOK_SECRET is not configured')
      })

      test('should throw error for invalid signature', () => {
        mockWebhooksConstructEvent.mockImplementation(() => {
          throw new Error('Invalid signature')
        })

        expect(() => {
          verifyWebhookSignature('payload', 'invalid_signature')
        }).toThrow('Invalid signature')
      })
    })

    describe('getCustomer', () => {
      test('should retrieve customer by ID', async () => {
        mockCustomersRetrieve.mockResolvedValue({
          id: 'cus_test_123',
          email: 'customer@test.com',
          name: 'Test Customer'
        })

        const result = await getCustomer('cus_test_123')

        expect(result).toEqual({
          id: 'cus_test_123',
          email: 'customer@test.com',
          name: 'Test Customer',
        })
        expect(mockCustomersRetrieve).toHaveBeenCalledWith('cus_test_123')
      })

      test('should handle customer not found error', async () => {
        mockCustomersRetrieve.mockRejectedValue(new Error('No such customer'))

        await expect(getCustomer('cus_invalid')).rejects.toThrow(
          'No such customer'
        )
      })
    })

    describe('createCustomer', () => {
      test('should create customer with email', async () => {
        mockCustomersCreate.mockResolvedValue({
          id: 'cus_new_123',
          email: 'new@test.com',
          name: null,
        })

        const result = await createCustomer({
          email: 'new@test.com'
        })

        expect(result).toEqual({
          id: 'cus_new_123',
          email: 'new@test.com',
          name: null,
        })
        expect(mockCustomersCreate).toHaveBeenCalledWith({
          email: 'new@test.com'
        })
      })

      test('should create customer with email, name, and metadata', async () => {
        mockCustomersCreate.mockResolvedValue({
          id: 'cus_new_456',
          email: 'customer@test.com',
          name: 'John Doe',
          metadata: { teamId: 'team-123' }
        })

        const result = await createCustomer({
          email: 'customer@test.com',
          name: 'John Doe',
          metadata: { teamId: 'team-123' }
        })

        expect(result).toEqual({
          id: 'cus_new_456',
          email: 'customer@test.com',
          name: 'John Doe',
        })
        expect(mockCustomersCreate).toHaveBeenCalledWith({
          email: 'customer@test.com',
          name: 'John Doe',
          metadata: { teamId: 'team-123' }
        })
      })
    })

    describe('cancelSubscriptionAtPeriodEnd', () => {
      test('should delegate to StripeGateway', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_test',
          status: 'active',
          cancel_at_period_end: true,
        })

        const result = await cancelSubscriptionAtPeriodEnd('sub_test')
        expect(result.cancelAtPeriodEnd).toBe(true)
      })
    })

    describe('cancelSubscriptionImmediately', () => {
      test('should delegate to StripeGateway', async () => {
        mockSubscriptionsCancel.mockResolvedValue({
          id: 'sub_test',
          status: 'canceled',
          cancel_at_period_end: false,
        })

        const result = await cancelSubscriptionImmediately('sub_test')
        expect(result.status).toBe('canceled')
      })
    })

    describe('reactivateSubscription', () => {
      test('should delegate to StripeGateway', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_test',
          status: 'active',
          cancel_at_period_end: false,
        })

        const result = await reactivateSubscription('sub_test')
        expect(result.cancelAtPeriodEnd).toBe(false)
      })
    })

    describe('updateSubscriptionPlan', () => {
      test('should delegate to StripeGateway', async () => {
        mockSubscriptionsRetrieve.mockResolvedValue({
          id: 'sub_test',
          items: { data: [{ id: 'si_test' }] },
        })
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_test',
          status: 'active',
          cancel_at_period_end: false,
        })

        const result = await updateSubscriptionPlan({
          subscriptionId: 'sub_test',
          newPriceId: 'price_new',
        })
        expect(result.id).toBe('sub_test')
      })
    })
  })

  describe('getStripeInstance', () => {
    test('should return Stripe instance', () => {
      const instance = getStripeInstance()
      expect(instance).toBeDefined()
      expect(instance.checkout).toBeDefined()
      expect(instance.billingPortal).toBeDefined()
      expect(instance.webhooks).toBeDefined()
    })

    test('should throw error when STRIPE_SECRET_KEY is not configured', () => {
      // Reset modules to clear cached Stripe instance
      jest.resetModules()

      const originalKey = process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_SECRET_KEY

      // Re-import after clearing cache
      const { getStripeInstance: freshGetStripeInstance } = require('@/core/lib/billing/gateways/stripe')

      try {
        expect(() => {
          freshGetStripeInstance()
        }).toThrow('STRIPE_SECRET_KEY is not configured')
      } finally {
        process.env.STRIPE_SECRET_KEY = originalKey
      }
    })

    test('should reuse same instance (lazy loading)', () => {
      const instance1 = getStripeInstance()
      const instance2 = getStripeInstance()
      expect(instance1).toBe(instance2)
    })
  })
})
