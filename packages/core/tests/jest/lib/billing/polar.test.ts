/**
 * Unit tests for Polar.sh Payment Gateway Integration
 *
 * Tests the PolarGateway class implementing BillingGateway interface.
 * Mocks Polar SDK to avoid actual API calls.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock Polar SDK method stubs
const mockCheckoutsCreate = jest.fn()
const mockCustomerSessionsCreate = jest.fn()
const mockCustomersGet = jest.fn()
const mockCustomersCreate = jest.fn()
const mockSubscriptionsUpdate = jest.fn()
const mockSubscriptionsRevoke = jest.fn()

// Mock @polar-sh/sdk
jest.mock('@polar-sh/sdk', () => ({
  Polar: jest.fn().mockImplementation(() => ({
    checkouts: { create: mockCheckoutsCreate },
    customerSessions: { create: mockCustomerSessionsCreate },
    customers: { get: mockCustomersGet, create: mockCustomersCreate },
    subscriptions: { update: mockSubscriptionsUpdate, revoke: mockSubscriptionsRevoke },
  }))
}))

// Mock @polar-sh/sdk/webhooks
const mockValidateEvent = jest.fn()
class MockWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}
jest.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: (...args: unknown[]) => mockValidateEvent(...args),
  WebhookVerificationError: MockWebhookVerificationError,
}))

// Mock PlanService
const mockGetPriceId = jest.fn()
jest.mock('@/core/lib/services/plan.service', () => ({
  PlanService: {
    getPriceId: (...args: unknown[]) => mockGetPriceId(...args),
  }
}))

// Mock BILLING_REGISTRY (needed for import, even though Polar uses PlanService)
jest.mock('@/core/lib/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    provider: 'polar',
    plans: [],
    limits: {}
  }
}))

// Import after mocks are set up
import { PolarGateway, getPolarInstance } from '@/core/lib/billing/gateways/polar'

describe('Polar Gateway', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      POLAR_ACCESS_TOKEN: 'polar_pat_mock_token_123',
      POLAR_WEBHOOK_SECRET: 'polar_whsec_mock_secret_123',
      POLAR_ORGANIZATION_ID: 'org_mock_123',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ===========================================
  // PolarGateway class tests
  // ===========================================

  describe('PolarGateway class', () => {
    let gateway: PolarGateway

    beforeEach(() => {
      gateway = new PolarGateway()
    })

    describe('createCheckoutSession', () => {
      test('should create checkout session with productPriceId and return provider-agnostic result', async () => {
        mockGetPriceId.mockReturnValue('polar_price_pro_monthly')
        mockCheckoutsCreate.mockResolvedValue({
          id: 'polar_checkout_123',
          url: 'https://polar.sh/checkout/test',
        })

        const result = await gateway.createCheckoutSession({
          teamId: 'team-123',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
          customerEmail: 'user@test.com',
        })

        expect(result).toEqual({
          id: 'polar_checkout_123',
          url: 'https://polar.sh/checkout/test',
        })

        expect(mockCheckoutsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            productPriceId: 'polar_price_pro_monthly',
            successUrl: 'http://localhost:3000/success',
            returnUrl: 'http://localhost:3000/cancel',
            customerEmail: 'user@test.com',
            metadata: { teamId: 'team-123', planSlug: 'pro', billingPeriod: 'monthly' },
          })
        )
      })

      test('should use yearly price when billingPeriod is yearly', async () => {
        mockGetPriceId.mockReturnValue('polar_price_pro_yearly')
        mockCheckoutsCreate.mockResolvedValue({
          id: 'polar_checkout_456',
          url: 'https://polar.sh/checkout/yearly',
        })

        await gateway.createCheckoutSession({
          teamId: 'team-456',
          planSlug: 'pro',
          billingPeriod: 'yearly',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })

        expect(mockGetPriceId).toHaveBeenCalledWith('pro', 'yearly')
      })

      test('should handle null url in response', async () => {
        mockGetPriceId.mockReturnValue('polar_price_123')
        mockCheckoutsCreate.mockResolvedValue({
          id: 'polar_checkout_789',
          url: undefined,
        })

        const result = await gateway.createCheckoutSession({
          teamId: 'team-789',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })

        expect(result.url).toBeNull()
      })

      test('should throw error when PlanService returns no price ID', async () => {
        mockGetPriceId.mockReturnValue(null)

        await expect(
          gateway.createCheckoutSession({
            teamId: 'team-free',
            planSlug: 'free',
            billingPeriod: 'monthly',
            successUrl: 'http://localhost:3000/success',
            cancelUrl: 'http://localhost:3000/cancel',
          })
        ).rejects.toThrow('No price ID configured for free monthly')
      })

      test('should not include customerEmail when not provided', async () => {
        mockGetPriceId.mockReturnValue('polar_price_123')
        mockCheckoutsCreate.mockResolvedValue({ id: 'polar_checkout_no_email', url: null })

        await gateway.createCheckoutSession({
          teamId: 'team-no-email',
          planSlug: 'pro',
          billingPeriod: 'monthly',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })

        const calledWith = mockCheckoutsCreate.mock.calls[0]?.[0] as Record<string, unknown>
        expect(calledWith).not.toHaveProperty('customerEmail')
      })
    })

    describe('createPortalSession', () => {
      test('should create customer session and return customerPortalUrl', async () => {
        mockCustomerSessionsCreate.mockResolvedValue({
          id: 'session_123',
          customerPortalUrl: 'https://polar.sh/portal/test',
        })

        const result = await gateway.createPortalSession({
          customerId: 'polar_cus_123',
          returnUrl: 'http://localhost:3000/billing',
        })

        expect(result).toEqual({ url: 'https://polar.sh/portal/test' })
        expect(mockCustomerSessionsCreate).toHaveBeenCalledWith({
          customerId: 'polar_cus_123',
        })
      })

      test('should handle Polar API errors', async () => {
        mockCustomerSessionsCreate.mockRejectedValue(
          new Error('Customer not found')
        )

        await expect(
          gateway.createPortalSession({
            customerId: 'polar_cus_invalid',
            returnUrl: 'http://localhost:3000/billing',
          })
        ).rejects.toThrow('Customer not found')
      })
    })

    describe('verifyWebhookSignature', () => {
      test('should verify with headers object and return provider-agnostic event', () => {
        const mockEvent = {
          id: 'polar_evt_123',
          type: 'subscription.created',
          data: { subscriptionId: 'sub_123' },
        }
        mockValidateEvent.mockReturnValue(mockEvent)

        const headers = {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,abc123',
        }

        const result = gateway.verifyWebhookSignature('payload-body', headers)

        expect(result).toEqual({
          id: 'polar_evt_123',
          type: 'subscription.created',
          data: { subscriptionId: 'sub_123' },
        })
        expect(mockValidateEvent).toHaveBeenCalledWith(
          'payload-body',
          headers,
          'polar_whsec_mock_secret_123'
        )
      })

      test('should construct headers from string signature (fallback)', () => {
        mockValidateEvent.mockReturnValue({
          id: 'polar_evt_456',
          type: 'checkout.updated',
          data: {},
        })

        gateway.verifyWebhookSignature('payload', 'v1,signature_string')

        expect(mockValidateEvent).toHaveBeenCalledWith(
          'payload',
          {
            'webhook-id': '',
            'webhook-timestamp': '',
            'webhook-signature': 'v1,signature_string',
          },
          'polar_whsec_mock_secret_123'
        )
      })

      test('should convert Buffer payload to string', () => {
        mockValidateEvent.mockReturnValue({
          id: 'polar_evt_buf',
          type: 'order.paid',
          data: {},
        })

        const buffer = Buffer.from('buffer-payload')
        const headers = { 'webhook-id': 'wh_1', 'webhook-timestamp': '123', 'webhook-signature': 'sig' }

        gateway.verifyWebhookSignature(buffer, headers)

        expect(mockValidateEvent).toHaveBeenCalledWith(
          'buffer-payload',
          headers,
          'polar_whsec_mock_secret_123'
        )
      })

      test('should throw when webhook secret is not configured', () => {
        delete process.env.POLAR_WEBHOOK_SECRET

        expect(() => {
          gateway.verifyWebhookSignature('payload', 'signature')
        }).toThrow('POLAR_WEBHOOK_SECRET is not configured')
      })

      test('should wrap WebhookVerificationError with descriptive message', () => {
        mockValidateEvent.mockImplementation(() => {
          throw new MockWebhookVerificationError('Invalid signature')
        })

        expect(() => {
          gateway.verifyWebhookSignature('payload', { 'webhook-id': '', 'webhook-timestamp': '', 'webhook-signature': 'bad' })
        }).toThrow('Polar webhook verification failed: Invalid signature')
      })

      test('should re-throw non-WebhookVerificationError errors', () => {
        mockValidateEvent.mockImplementation(() => {
          throw new Error('Network error')
        })

        expect(() => {
          gateway.verifyWebhookSignature('payload', { 'webhook-id': '', 'webhook-timestamp': '', 'webhook-signature': 'sig' })
        }).toThrow('Network error')
      })
    })

    describe('getCustomer', () => {
      test('should return provider-agnostic customer', async () => {
        mockCustomersGet.mockResolvedValue({
          id: 'polar_cus_123',
          email: 'customer@test.com',
          name: 'Test Customer',
          // Polar-specific fields stripped by gateway
          organizationId: 'org_123',
        })

        const result = await gateway.getCustomer('polar_cus_123')

        expect(result).toEqual({
          id: 'polar_cus_123',
          email: 'customer@test.com',
          name: 'Test Customer',
        })
        expect(mockCustomersGet).toHaveBeenCalledWith({ id: 'polar_cus_123' })
      })

      test('should handle null email and name', async () => {
        mockCustomersGet.mockResolvedValue({
          id: 'polar_cus_minimal',
          email: undefined,
          name: undefined,
        })

        const result = await gateway.getCustomer('polar_cus_minimal')

        expect(result).toEqual({
          id: 'polar_cus_minimal',
          email: null,
          name: null,
        })
      })
    })

    describe('createCustomer', () => {
      test('should create customer with email and return provider-agnostic result', async () => {
        mockCustomersCreate.mockResolvedValue({
          id: 'polar_cus_new',
          email: 'new@test.com',
          name: null,
        })

        const result = await gateway.createCustomer({ email: 'new@test.com' })

        expect(result).toEqual({
          id: 'polar_cus_new',
          email: 'new@test.com',
          name: null,
        })
      })

      test('should include name and metadata when provided', async () => {
        mockCustomersCreate.mockResolvedValue({
          id: 'polar_cus_full',
          email: 'full@test.com',
          name: 'John Doe',
        })

        await gateway.createCustomer({
          email: 'full@test.com',
          name: 'John Doe',
          metadata: { teamId: 'team-123' },
        })

        expect(mockCustomersCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'full@test.com',
            name: 'John Doe',
            metadata: { teamId: 'team-123' },
            organizationId: 'org_mock_123',
          })
        )
      })

      test('should not include organizationId when env var is not set', async () => {
        delete process.env.POLAR_ORGANIZATION_ID
        mockCustomersCreate.mockResolvedValue({
          id: 'polar_cus_no_org',
          email: 'no-org@test.com',
          name: null,
        })

        await gateway.createCustomer({ email: 'no-org@test.com' })

        const calledWith = mockCustomersCreate.mock.calls[0]?.[0] as Record<string, unknown>
        expect(calledWith).not.toHaveProperty('organizationId')
      })
    })

    describe('updateSubscriptionPlan', () => {
      test('should update subscription with productPriceId and return provider-agnostic result', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'polar_sub_123',
          status: 'active',
          cancelAtPeriodEnd: false,
        })

        const result = await gateway.updateSubscriptionPlan({
          subscriptionId: 'polar_sub_123',
          newPriceId: 'polar_price_enterprise',
        })

        expect(result).toEqual({
          id: 'polar_sub_123',
          status: 'active',
          cancelAtPeriodEnd: false,
        })
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith({
          id: 'polar_sub_123',
          subscriptionUpdate: {
            productPriceId: 'polar_price_enterprise',
          },
        })
      })
    })

    describe('cancelSubscriptionAtPeriodEnd', () => {
      test('should set cancelAtPeriodEnd and return provider-agnostic result', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'polar_sub_cancel',
          status: 'active',
          cancelAtPeriodEnd: true,
        })

        const result = await gateway.cancelSubscriptionAtPeriodEnd('polar_sub_cancel')

        expect(result).toEqual({
          id: 'polar_sub_cancel',
          status: 'active',
          cancelAtPeriodEnd: true,
        })
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith({
          id: 'polar_sub_cancel',
          subscriptionUpdate: {
            cancelAtPeriodEnd: true,
          },
        })
      })
    })

    describe('cancelSubscriptionImmediately', () => {
      test('should revoke subscription (Polar terminology) and return provider-agnostic result', async () => {
        mockSubscriptionsRevoke.mockResolvedValue({
          id: 'polar_sub_revoke',
          status: 'revoked',
        })

        const result = await gateway.cancelSubscriptionImmediately('polar_sub_revoke')

        expect(result).toEqual({
          id: 'polar_sub_revoke',
          status: 'revoked',
          cancelAtPeriodEnd: false,
        })
        expect(mockSubscriptionsRevoke).toHaveBeenCalledWith({
          id: 'polar_sub_revoke',
        })
      })

      test('should default status to "canceled" when revoke returns no status', async () => {
        mockSubscriptionsRevoke.mockResolvedValue({
          id: 'polar_sub_no_status',
          status: undefined,
        })

        const result = await gateway.cancelSubscriptionImmediately('polar_sub_no_status')

        expect(result.status).toBe('canceled')
      })
    })

    describe('reactivateSubscription', () => {
      test('should set cancelAtPeriodEnd to false and return provider-agnostic result', async () => {
        mockSubscriptionsUpdate.mockResolvedValue({
          id: 'polar_sub_reactivate',
          status: 'active',
          cancelAtPeriodEnd: false,
        })

        const result = await gateway.reactivateSubscription('polar_sub_reactivate')

        expect(result).toEqual({
          id: 'polar_sub_reactivate',
          status: 'active',
          cancelAtPeriodEnd: false,
        })
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith({
          id: 'polar_sub_reactivate',
          subscriptionUpdate: {
            cancelAtPeriodEnd: false,
          },
        })
      })
    })
  })

  // ===========================================
  // getPolarInstance tests
  // ===========================================

  describe('getPolarInstance', () => {
    test('should return Polar instance', () => {
      const instance = getPolarInstance()
      expect(instance).toBeDefined()
      expect(instance.checkouts).toBeDefined()
      expect(instance.customerSessions).toBeDefined()
      expect(instance.subscriptions).toBeDefined()
      expect(instance.customers).toBeDefined()
    })

    test('should throw error when POLAR_ACCESS_TOKEN is not configured', () => {
      jest.resetModules()

      const originalToken = process.env.POLAR_ACCESS_TOKEN
      delete process.env.POLAR_ACCESS_TOKEN

      const { getPolarInstance: freshGetPolarInstance } = require('@/core/lib/billing/gateways/polar')

      try {
        expect(() => {
          freshGetPolarInstance()
        }).toThrow('POLAR_ACCESS_TOKEN is not configured')
      } finally {
        process.env.POLAR_ACCESS_TOKEN = originalToken
      }
    })

    test('should reuse same instance (lazy loading)', () => {
      const instance1 = getPolarInstance()
      const instance2 = getPolarInstance()
      expect(instance1).toBe(instance2)
    })
  })
})
