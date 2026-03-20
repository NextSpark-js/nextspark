/**
 * Stripe Connect Webhook Handler Tests
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { NextRequest } from 'next/server'

// Mock Stripe SDK
const mockWebhooksConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  }))
})

// Mock DB
const mockQuery = jest.fn()
const mockQueryOne = jest.fn()

jest.mock('@/core/lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryOne: (...args: any[]) => mockQueryOne(...args),
}))

import { handleStripeConnectWebhook, type StripeConnectWebhookExtensions } from '@/core/lib/marketplace/stripe-connect-webhook'

// ============================================================
// HELPERS
// ============================================================

function createMockRequest(payload: string, signature: string | null): NextRequest {
  return {
    text: jest.fn().mockResolvedValue(payload),
    headers: {
      get: (name: string) => (name === 'stripe-signature' ? signature : null),
    },
  } as unknown as NextRequest
}

function createMockStripeEvent(type: string, data: any, account: string = 'acct_test') {
  return {
    id: 'evt_test_' + Math.random().toString(36).slice(2),
    type,
    account,
    data: { object: data },
  }
}

// ============================================================
// TESTS
// ============================================================

describe('handleStripeConnectWebhook', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_mock',
    }
    // Default: no duplicate events
    mockQueryOne.mockResolvedValue(null)
    // Default: queries succeed
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ----------------------------------------------------------
  // 1. Signature verification
  // ----------------------------------------------------------
  describe('signature verification', () => {
    test('returns 400 with no signature header', async () => {
      const req = createMockRequest('{}', null)

      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/no signature/i)
    })

    test('returns 400 on invalid signature', async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed')
      })

      const req = createMockRequest('{}', 'sig_invalid')

      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/invalid signature/i)
    })

    test('returns 500 when STRIPE_CONNECT_WEBHOOK_SECRET is missing', async () => {
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET

      const req = createMockRequest('{}', 'sig_test')

      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/not configured/i)
    })
  })

  // ----------------------------------------------------------
  // 2. Idempotency
  // ----------------------------------------------------------
  describe('idempotency', () => {
    test('returns 200 with duplicate status for already-processed events', async () => {
      const event = createMockStripeEvent('account.updated', { id: 'acct_123' })
      mockWebhooksConstructEvent.mockReturnValue(event)
      mockQueryOne.mockResolvedValue({ id: 'existing-row-id' })

      const req = createMockRequest('{}', 'sig_valid')

      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('duplicate')
      expect(body.received).toBe(true)
    })

    test('processes new events normally', async () => {
      const event = createMockStripeEvent('account.updated', {
        id: 'acct_new',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { disabled_reason: null, past_due: [] },
      })
      mockWebhooksConstructEvent.mockReturnValue(event)
      mockQueryOne.mockResolvedValue(null)

      const req = createMockRequest('{}', 'sig_valid')

      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
      expect(body.status).toBeUndefined()
      // Should have inserted the webhook event row
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "marketplaceWebhookEvents"'),
        expect.arrayContaining([event.id])
      )
    })
  })

  // ----------------------------------------------------------
  // 3. account.updated
  // ----------------------------------------------------------
  describe('account.updated', () => {
    test('updates connectedAccount with chargesEnabled, payoutsEnabled, onboardingStatus', async () => {
      const account = {
        id: 'acct_seller1',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { disabled_reason: null, past_due: [] },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      // The UPDATE call for connectedAccounts
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "connectedAccounts"'),
        ['active', true, true, 'acct_seller1']
      )
    })

    test('maps status to active when charges and payouts enabled', async () => {
      const account = {
        id: 'acct_active',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { disabled_reason: null, past_due: [] },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "connectedAccounts"'),
        expect.arrayContaining(['active'])
      )
    })

    test('maps status to restricted when past_due requirements exist', async () => {
      const account = {
        id: 'acct_restricted',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          disabled_reason: null,
          past_due: ['individual.verification.document'],
        },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "connectedAccounts"'),
        expect.arrayContaining(['restricted'])
      )
    })

    test('maps status to disabled when disabled_reason is set', async () => {
      const account = {
        id: 'acct_disabled',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          disabled_reason: 'rejected.fraud',
          past_due: [],
        },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "connectedAccounts"'),
        expect.arrayContaining(['disabled'])
      )
    })

    test('maps status to in_progress when details submitted but not yet enabled', async () => {
      const account = {
        id: 'acct_inprogress',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { disabled_reason: null, past_due: [] },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "connectedAccounts"'),
        expect.arrayContaining(['in_progress'])
      )
    })
  })

  // ----------------------------------------------------------
  // 4. payment_intent.succeeded
  // ----------------------------------------------------------
  describe('payment_intent.succeeded', () => {
    test('updates marketplacePayment status to succeeded with charge id', async () => {
      const pi = {
        id: 'pi_success_1',
        latest_charge: 'ch_charge_1',
      }
      const event = createMockStripeEvent('payment_intent.succeeded', pi, 'acct_seller')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['ch_charge_1', 'pi_success_1']
      )
    })

    test('handles latest_charge as object', async () => {
      const pi = {
        id: 'pi_success_2',
        latest_charge: { id: 'ch_obj_charge' },
      }
      const event = createMockStripeEvent('payment_intent.succeeded', pi, 'acct_seller')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['ch_obj_charge', 'pi_success_2']
      )
    })

    test('calls extensions.onPaymentSucceeded if provided', async () => {
      const pi = { id: 'pi_ext_1', latest_charge: 'ch_ext' }
      const event = createMockStripeEvent('payment_intent.succeeded', pi, 'acct_ext')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const onPaymentSucceeded = jest.fn().mockResolvedValue(undefined) as jest.Mock<() => Promise<void>>
      const extensions: StripeConnectWebhookExtensions = { onPaymentSucceeded }

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req, extensions)

      expect(onPaymentSucceeded).toHaveBeenCalledWith(pi, 'acct_ext')
    })

    test('does not call extensions.onPaymentSucceeded when not provided', async () => {
      const pi = { id: 'pi_noext', latest_charge: 'ch_noext' }
      const event = createMockStripeEvent('payment_intent.succeeded', pi, 'acct_noext')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')

      // Should not throw
      const res = await handleStripeConnectWebhook(req)
      expect(res.status).toBe(200)
    })
  })

  // ----------------------------------------------------------
  // 5. payment_intent.payment_failed
  // ----------------------------------------------------------
  describe('payment_intent.payment_failed', () => {
    test('updates marketplacePayment status to failed with error message', async () => {
      const pi = {
        id: 'pi_failed_1',
        last_payment_error: { message: 'Card declined' },
      }
      const event = createMockStripeEvent('payment_intent.payment_failed', pi)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['Card declined', 'pi_failed_1']
      )
    })

    test('uses default message when last_payment_error is missing', async () => {
      const pi = {
        id: 'pi_failed_2',
        last_payment_error: null,
      }
      const event = createMockStripeEvent('payment_intent.payment_failed', pi)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['Payment failed', 'pi_failed_2']
      )
    })
  })

  // ----------------------------------------------------------
  // 6. charge.refunded
  // ----------------------------------------------------------
  describe('charge.refunded', () => {
    test('updates status to refunded for full refund', async () => {
      const charge = {
        id: 'ch_refund_full',
        refunded: true,
        amount_refunded: 10000,
      }
      const event = createMockStripeEvent('charge.refunded', charge)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['refunded', 10000, 'ch_refund_full']
      )
    })

    test('updates status to partially_refunded for partial refund', async () => {
      const charge = {
        id: 'ch_refund_partial',
        refunded: false,
        amount_refunded: 5000,
      }
      const event = createMockStripeEvent('charge.refunded', charge)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['partially_refunded', 5000, 'ch_refund_partial']
      )
    })

    test('sets refundedAmount correctly', async () => {
      const charge = {
        id: 'ch_refund_amount',
        refunded: false,
        amount_refunded: 3500,
      }
      const event = createMockStripeEvent('charge.refunded', charge)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      // Verify the refundedAmount param
      const updateCall = mockQuery.mock.calls.find(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('"refundedAmount"')
      )
      expect(updateCall).toBeDefined()
      expect(updateCall![1]).toContain(3500)
    })
  })

  // ----------------------------------------------------------
  // 7. charge.dispute.created
  // ----------------------------------------------------------
  describe('charge.dispute.created', () => {
    test('updates marketplacePayment status to disputed', async () => {
      const dispute = {
        id: 'dp_test_1',
        charge: 'ch_disputed',
        reason: 'fraudulent',
      }
      const event = createMockStripeEvent('charge.dispute.created', dispute, 'acct_disputed')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['Dispute: fraudulent', 'ch_disputed']
      )
    })

    test('handles charge as object', async () => {
      const dispute = {
        id: 'dp_test_2',
        charge: { id: 'ch_disputed_obj' },
        reason: 'product_not_received',
      }
      const event = createMockStripeEvent('charge.dispute.created', dispute, 'acct_dp2')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "marketplacePayments"'),
        ['Dispute: product_not_received', 'ch_disputed_obj']
      )
    })

    test('calls extensions.onDisputeCreated if provided', async () => {
      const dispute = {
        id: 'dp_test_ext',
        charge: 'ch_ext_dispute',
        reason: 'general',
      }
      const event = createMockStripeEvent('charge.dispute.created', dispute, 'acct_dp_ext')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const onDisputeCreated = jest.fn().mockResolvedValue(undefined) as jest.Mock<() => Promise<void>>
      const extensions: StripeConnectWebhookExtensions = { onDisputeCreated }

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req, extensions)

      expect(onDisputeCreated).toHaveBeenCalledWith(dispute, 'acct_dp_ext')
    })

    test('does not update payment when charge id is missing', async () => {
      const dispute = {
        id: 'dp_no_charge',
        charge: null,
        reason: 'general',
      }
      const event = createMockStripeEvent('charge.dispute.created', dispute, 'acct_dp_nc')
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      // Should NOT have an UPDATE for marketplacePayments with status=disputed
      const disputeUpdateCalls = mockQuery.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE "marketplacePayments"') &&
          call[0].includes("'disputed'")
      )
      expect(disputeUpdateCalls).toHaveLength(0)
    })
  })

  // ----------------------------------------------------------
  // 8. Error handling
  // ----------------------------------------------------------
  describe('error handling', () => {
    test('returns 500 on handler error', async () => {
      const account = {
        id: 'acct_error',
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { disabled_reason: null, past_due: [] },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      // Make the handler's UPDATE query throw
      let callCount = 0
      mockQuery.mockImplementation(async (sql: string) => {
        callCount++
        // First call is the INSERT for the webhook event — let it succeed
        if (sql.includes('INSERT INTO "marketplaceWebhookEvents"')) {
          return { rows: [], rowCount: 1 }
        }
        // Second call is the handler's UPDATE — throw
        if (sql.includes('UPDATE "connectedAccounts"')) {
          throw new Error('DB connection lost')
        }
        // Allow error recording UPDATE
        return { rows: [], rowCount: 0 }
      })

      const req = createMockRequest('{}', 'sig_valid')
      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/handler failed/i)
    })

    test('records error in webhookEvents table', async () => {
      const account = {
        id: 'acct_err2',
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { disabled_reason: null, past_due: [] },
      }
      const event = createMockStripeEvent('account.updated', account)
      mockWebhooksConstructEvent.mockReturnValue(event)

      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO "marketplaceWebhookEvents"')) {
          return { rows: [], rowCount: 1 }
        }
        if (sql.includes('UPDATE "connectedAccounts"')) {
          throw new Error('Unexpected DB error')
        }
        // Allow the error recording UPDATE
        return { rows: [], rowCount: 0 }
      })

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      // Verify error was recorded in the webhook events table
      const errorUpdateCall = mockQuery.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE "marketplaceWebhookEvents"') &&
          call[0].includes('error')
      )
      expect(errorUpdateCall).toBeDefined()
      expect(errorUpdateCall![1]).toContain('Unexpected DB error')
    })

    test('logs unhandled event types gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      const event = createMockStripeEvent('unknown.event.type', { id: 'obj_unknown' })
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled event: unknown.event.type')
      )

      consoleSpy.mockRestore()
    })
  })

  // ----------------------------------------------------------
  // 9. Payout events (bonus coverage)
  // ----------------------------------------------------------
  describe('payout events', () => {
    test('handles payout.paid event', async () => {
      const payout = { id: 'po_paid_1', amount: 25000, currency: 'usd' }
      const event = createMockStripeEvent('payout.paid', payout)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(200)
    })

    test('handles payout.failed event', async () => {
      const payout = { id: 'po_failed_1', amount: 15000, currency: 'usd' }
      const event = createMockStripeEvent('payout.failed', payout)
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      const res = await handleStripeConnectWebhook(req)

      expect(res.status).toBe(200)
    })
  })

  // ----------------------------------------------------------
  // 10. Event marking as processed
  // ----------------------------------------------------------
  describe('event lifecycle', () => {
    test('marks event as processed after successful handling', async () => {
      const event = createMockStripeEvent('payout.paid', { id: 'po_lifecycle' })
      mockWebhooksConstructEvent.mockReturnValue(event)

      const req = createMockRequest('{}', 'sig_valid')
      await handleStripeConnectWebhook(req)

      // Verify the "mark as processed" UPDATE was called
      const processedCall = mockQuery.mock.calls.find(
        (call: any[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE "marketplaceWebhookEvents"') &&
          call[0].includes('processed = true')
      )
      expect(processedCall).toBeDefined()
      expect(processedCall![1]).toContain(event.id)
    })
  })
})
