/**
 * Stripe Connect Gateway Tests
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock Stripe SDK
const mockAccountsCreate = jest.fn()
const mockAccountsRetrieve = jest.fn()
const mockAccountLinksCreate = jest.fn()
const mockAccountsCreateLoginLink = jest.fn()
const mockCheckoutSessionsCreate = jest.fn()
const mockPaymentIntentsCreate = jest.fn()
const mockPaymentIntentsRetrieve = jest.fn()
const mockRefundsCreate = jest.fn()
const mockPayoutsCreate = jest.fn()
const mockBalanceRetrieve = jest.fn()
const mockWebhooksConstructEvent = jest.fn()
const mockSubscriptionsUpdate = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
      createLoginLink: mockAccountsCreateLoginLink,
    },
    accountLinks: { create: mockAccountLinksCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
    },
    refunds: { create: mockRefundsCreate },
    payouts: { create: mockPayoutsCreate },
    balance: { retrieve: mockBalanceRetrieve },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
    subscriptions: { update: mockSubscriptionsUpdate },
  }))
})

import { StripeConnectGateway } from '@/core/lib/marketplace/gateways/stripe-connect'

describe('StripeConnectGateway', () => {
  const originalEnv = process.env
  let gateway: StripeConnectGateway

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_mock',
    }
    gateway = new StripeConnectGateway()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('provider should be stripe_connect', () => {
    expect(gateway.provider).toBe('stripe_connect')
  })

  describe('createConnectedAccount', () => {
    test('should create Express account with correct params', async () => {
      mockAccountsCreate.mockResolvedValue({
        id: 'acct_test123',
        email: 'salon@test.com',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements: { currently_due: ['business_url'], past_due: [], eventually_due: [] },
      })

      const result = await gateway.createConnectedAccount({
        teamId: 'team-123',
        email: 'salon@test.com',
        businessName: 'Salon Test',
        country: 'US',
        businessType: 'individual',
      })

      expect(mockAccountsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          country: 'US',
          email: 'salon@test.com',
          business_type: 'individual',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        })
      )

      expect(result).toEqual({
        id: 'acct_test123',
        email: 'salon@test.com',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingStatus: 'pending',
        requirements: expect.objectContaining({
          currentlyDue: ['business_url'],
        }),
      })
    })
  })

  describe('createOnboardingLink', () => {
    test('should create account link with correct URLs', async () => {
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/e/acct_test',
        expires_at: Math.floor(Date.now() / 1000) + 300,
      })

      const result = await gateway.createOnboardingLink({
        externalAccountId: 'acct_test123',
        refreshUrl: 'https://app.com/refresh',
        returnUrl: 'https://app.com/return',
      })

      expect(result.url).toBe('https://connect.stripe.com/setup/e/acct_test')
      expect(result.expiresAt).toBeInstanceOf(Date)

      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_test123',
        refresh_url: 'https://app.com/refresh',
        return_url: 'https://app.com/return',
        type: 'account_onboarding',
      })
    })
  })

  describe('createMarketplaceCheckout', () => {
    test('should create checkout session with application_fee and transfer_data', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      })

      const result = await gateway.createMarketplaceCheckout({
        connectedAccountId: 'internal-id-123',
        externalAccountId: 'acct_salon',
        amount: 10000,
        currency: 'usd',
        applicationFee: 1500,
        referenceId: 'booking-789',
        description: 'Haircut - Salon Elegante',
        customerEmail: 'customer@test.com',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      })

      expect(result).toEqual({
        id: 'cs_test_456',
        status: 'pending',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      })

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_intent_data: expect.objectContaining({
            application_fee_amount: 1500,
            transfer_data: { destination: 'acct_salon' },
          }),
        })
      )
    })
  })

  describe('createMarketplacePayment', () => {
    test('should create payment intent with split', async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test_789',
        status: 'requires_payment_method',
        latest_charge: null,
      })

      const result = await gateway.createMarketplacePayment({
        connectedAccountId: 'internal-id-123',
        externalAccountId: 'acct_salon',
        amount: 5000,
        currency: 'usd',
        applicationFee: 750,
        referenceId: 'booking-456',
        description: 'Beard trim',
      })

      expect(result.id).toBe('pi_test_789')
      expect(result.status).toBe('pending')

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          application_fee_amount: 750,
          transfer_data: { destination: 'acct_salon' },
        })
      )
    })
  })

  describe('refundPayment', () => {
    test('should refund with application fee refund by default', async () => {
      mockRefundsCreate.mockResolvedValue({
        id: 're_test_123',
        amount: 10000,
        status: 'succeeded',
      })

      const result = await gateway.refundPayment({
        externalPaymentId: 'pi_test_789',
      })

      expect(result).toEqual({
        id: 're_test_123',
        amount: 10000,
        status: 'succeeded',
        feeRefunded: 0,
      })

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test_789',
          refund_application_fee: true,
        })
      )
    })

    test('should support partial refund without fee refund', async () => {
      mockRefundsCreate.mockResolvedValue({
        id: 're_partial_456',
        amount: 5000,
        status: 'succeeded',
      })

      await gateway.refundPayment({
        externalPaymentId: 'pi_test_789',
        amount: 5000,
        refundApplicationFee: false,
      })

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          refund_application_fee: false,
        })
      )
    })
  })

  describe('getAccountBalance', () => {
    test('should return available and pending balance', async () => {
      mockBalanceRetrieve.mockResolvedValue({
        available: [{ amount: 50000, currency: 'usd' }],
        pending: [{ amount: 10000, currency: 'usd' }],
      })

      const result = await gateway.getAccountBalance('acct_salon')

      expect(result).toEqual({
        available: 50000,
        pending: 10000,
        currency: 'usd',
      })

      expect(mockBalanceRetrieve).toHaveBeenCalledWith({
        stripeAccount: 'acct_salon',
      })
    })
  })

  describe('verifyWebhookSignature', () => {
    test('should verify and return parsed event with account', () => {
      mockWebhooksConstructEvent.mockReturnValue({
        id: 'evt_connect_123',
        type: 'payment_intent.succeeded',
        account: 'acct_salon',
        data: { object: { id: 'pi_123' } },
      })

      const result = gateway.verifyWebhookSignature('payload', 'sig_test')

      expect(result).toEqual({
        id: 'evt_connect_123',
        type: 'payment_intent.succeeded',
        account: 'acct_salon',
        data: { object: { id: 'pi_123' } },
      })
    })

    test('should throw when STRIPE_CONNECT_WEBHOOK_SECRET is missing', () => {
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET

      expect(() => gateway.verifyWebhookSignature('payload', 'sig'))
        .toThrow('STRIPE_CONNECT_WEBHOOK_SECRET is not configured')
    })
  })

  describe('getAccountStatus', () => {
    test('should map active account correctly', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        id: 'acct_active',
        email: 'active@salon.com',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [], past_due: [], eventually_due: [], disabled_reason: null },
      })

      const result = await gateway.getAccountStatus('acct_active')

      expect(result.onboardingStatus).toBe('active')
      expect(result.chargesEnabled).toBe(true)
      expect(result.payoutsEnabled).toBe(true)
    })

    test('should map restricted account correctly', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        id: 'acct_restricted',
        email: 'restricted@salon.com',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { currently_due: [], past_due: ['individual.verification.document'], eventually_due: [], disabled_reason: null },
      })

      const result = await gateway.getAccountStatus('acct_restricted')

      expect(result.onboardingStatus).toBe('restricted')
    })

    test('should map disabled account correctly', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        id: 'acct_disabled',
        email: 'disabled@salon.com',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { currently_due: [], past_due: [], eventually_due: [], disabled_reason: 'rejected.fraud' },
      })

      const result = await gateway.getAccountStatus('acct_disabled')

      expect(result.onboardingStatus).toBe('disabled')
    })
  })
})
