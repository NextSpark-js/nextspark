/**
 * Unit tests for Stripe Payment Gateway Integration
 *
 * Tests the Stripe SDK wrapper functions for checkout, portal, and webhook handling.
 * Mocks Stripe SDK to avoid actual API calls.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type Stripe from 'stripe'

// Mock Stripe SDK before importing gateway
const mockCheckoutSessionsCreate = jest.fn()
const mockBillingPortalSessionsCreate = jest.fn()
const mockWebhooksConstructEvent = jest.fn()
const mockCustomersRetrieve = jest.fn()
const mockCustomersCreate = jest.fn()

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
    }
  }))
})

// Mock BILLING_REGISTRY
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
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
      }
    ],
    limits: {}
  }
}))

// Import after mocks are set up
import {
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  getCustomer,
  createCustomer,
  getStripeInstance
} from '@/core/lib/billing/gateways/stripe'

describe('Stripe Gateway', () => {
  // Set up environment variables
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'testkey_mock_key_123456789',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret_123456789'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

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

      expect(result).toEqual(mockSession)
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

    test('should create checkout session for pro plan yearly', async () => {
      const mockSession = {
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/test-yearly'
      }
      mockCheckoutSessionsCreate.mockResolvedValue(mockSession)

      await createCheckoutSession({
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

    test('should use existing customer ID when provided', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_789' })

      await createCheckoutSession({
        teamId: 'team-789',
        planSlug: 'pro',
        billingPeriod: 'monthly',
        successUrl: 'http://localhost:5173/success',
        cancelUrl: 'http://localhost:5173/cancel',
        customerId: 'cus_existing_123'
      })

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing_123'
        })
      )
      expect(mockCheckoutSessionsCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: expect.anything()
        })
      )
    })

    test('should add trial period for plans with trialDays', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_trial' })

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
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_no_trial' })

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

    test('should throw error for plan with no yearly price when requesting yearly', async () => {
      await expect(
        createCheckoutSession({
          teamId: 'team-enterprise',
          planSlug: 'enterprise',
          billingPeriod: 'yearly',
          successUrl: 'http://localhost:5173/success',
          cancelUrl: 'http://localhost:5173/cancel'
        })
      ).rejects.toThrow('No Stripe price configured for enterprise yearly')
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

      expect(result).toEqual(mockPortalSession)
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
      } as Stripe.Event

      mockWebhooksConstructEvent.mockReturnValue(mockEvent)

      const payload = JSON.stringify({ test: 'data' })
      const signature = 'test_signature_123'

      const result = verifyWebhookSignature(payload, signature)

      expect(result).toEqual(mockEvent)
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
      const mockCustomer = {
        id: 'cus_test_123',
        email: 'customer@test.com',
        name: 'Test Customer'
      } as Stripe.Customer

      mockCustomersRetrieve.mockResolvedValue(mockCustomer)

      const result = await getCustomer('cus_test_123')

      expect(result).toEqual(mockCustomer)
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
      const mockCustomer = {
        id: 'cus_new_123',
        email: 'new@test.com'
      } as Stripe.Customer

      mockCustomersCreate.mockResolvedValue(mockCustomer)

      const result = await createCustomer({
        email: 'new@test.com'
      })

      expect(result).toEqual(mockCustomer)
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'new@test.com'
      })
    })

    test('should create customer with email, name, and metadata', async () => {
      const mockCustomer = {
        id: 'cus_new_456',
        email: 'customer@test.com',
        name: 'John Doe',
        metadata: { teamId: 'team-123' }
      } as Stripe.Customer

      mockCustomersCreate.mockResolvedValue(mockCustomer)

      const result = await createCustomer({
        email: 'customer@test.com',
        name: 'John Doe',
        metadata: { teamId: 'team-123' }
      })

      expect(result).toEqual(mockCustomer)
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'customer@test.com',
        name: 'John Doe',
        metadata: { teamId: 'team-123' }
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

  describe('Edge Cases', () => {
    test('should handle empty metadata in checkout session', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_test_empty' })

      await createCheckoutSession({
        teamId: 'team-empty',
        planSlug: 'enterprise',
        billingPeriod: 'monthly',
        successUrl: 'http://localhost:5173/success',
        cancelUrl: 'http://localhost:5173/cancel'
      })

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { teamId: 'team-empty', planSlug: 'enterprise', billingPeriod: 'monthly' }
        })
      )
    })

    test('should handle Stripe SDK initialization with correct API version', () => {
      const instance = getStripeInstance()
      expect(instance).toBeDefined()
    })
  })
})
