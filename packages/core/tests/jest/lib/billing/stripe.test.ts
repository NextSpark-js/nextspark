/**
 * Unit tests for Stripe Payment Gateway Integration
 *
 * Tests the StripeGateway class and the getBillingGateway() factory.
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
        providerPriceIds: { monthly: null, yearly: null },
        trialDays: 0,
        limits: {},
        features: []
      },
      {
        slug: 'pro',
        name: 'Pro',
        providerPriceIds: {
          monthly: 'price_pro_monthly',
          yearly: 'price_pro_yearly',
        },
        trialDays: 14,
        limits: { projects: 10 },
        features: ['advanced_analytics']
      },
      {
        slug: 'enterprise',
        name: 'Enterprise',
        providerPriceIds: {
          monthly: 'price_enterprise_monthly',
          yearly: null,
        },
        trialDays: 0,
        limits: { projects: -1 },
        features: ['*']
      },
    ],
    limits: {}
  }
}))

// Import after mocks are set up
import { StripeGateway } from '@/core/lib/billing/gateways/stripe'
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
        ).rejects.toThrow('No price ID configured for free monthly')
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

      test('should throw error for deleted customer', async () => {
        mockCustomersRetrieve.mockResolvedValue({
          id: 'cus_deleted_123',
          object: 'customer',
          deleted: true,
        })

        await expect(gateway.getCustomer('cus_deleted_123')).rejects.toThrow(
          'Customer cus_deleted_123 has been deleted'
        )
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

    describe('createOneTimeCheckout', () => {
      test('should create one-time checkout session with payment mode', async () => {
        const mockSession = {
          id: 'cs_onetime_123',
          url: 'https://checkout.stripe.com/test-onetime',
        }
        mockCheckoutSessionsCreate.mockResolvedValue(mockSession)

        const result = await gateway.createOneTimeCheckout({
          teamId: 'team-123',
          priceId: 'price_credit_pack',
          quantity: 5,
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
          customerEmail: 'user@test.com',
          metadata: { type: 'credit_pack' },
        })

        expect(result).toEqual({
          id: 'cs_onetime_123',
          url: 'https://checkout.stripe.com/test-onetime',
        })

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'payment',
            line_items: [{ price: 'price_credit_pack', quantity: 5 }],
            metadata: expect.objectContaining({ teamId: 'team-123', type: 'credit_pack' }),
          })
        )
      })

      test('should default quantity to 1', async () => {
        mockCheckoutSessionsCreate.mockResolvedValue({
          id: 'cs_onetime_456',
          url: 'https://checkout.stripe.com/test-onetime-2',
        })

        await gateway.createOneTimeCheckout({
          teamId: 'team-456',
          priceId: 'price_single',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel',
        })

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            line_items: [{ price: 'price_single', quantity: 1 }],
          })
        )
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

      test('should use custom proration behavior when provided', async () => {
        mockSubscriptionsRetrieve.mockResolvedValue({
          id: 'sub_123',
          items: { data: [{ id: 'si_123' }] },
        })
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
        })

        await gateway.updateSubscriptionPlan({
          subscriptionId: 'sub_123',
          newPriceId: 'price_new',
          prorationBehavior: 'none',
        })

        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
          items: [{ id: 'si_123', price: 'price_new' }],
          proration_behavior: 'none',
        })
      })

      test('should default to create_prorations proration behavior', async () => {
        mockSubscriptionsRetrieve.mockResolvedValue({
          id: 'sub_123',
          items: { data: [{ id: 'si_123' }] },
        })
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
        })

        await gateway.updateSubscriptionPlan({
          subscriptionId: 'sub_123',
          newPriceId: 'price_new',
        })

        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
          items: [{ id: 'si_123', price: 'price_new' }],
          proration_behavior: 'create_prorations',
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

})
