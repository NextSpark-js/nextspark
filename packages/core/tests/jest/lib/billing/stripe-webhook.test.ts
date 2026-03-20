/**
 * Unit tests for Stripe Webhook Handler
 *
 * Tests handleStripeWebhook() which processes the full Stripe subscription lifecycle.
 * Mocks: NextRequest, billing gateway factory, billing registry, and database layer.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import type { NextRequest } from 'next/server'

// ─── Mock: Database layer ──────────────────────────────────────────────────────
const mockQuery = jest.fn<(...args: unknown[]) => Promise<{ rows: unknown[] }>>()
const mockQueryOne = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.mock('@/core/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

// ─── Mock: Billing gateway factory ─────────────────────────────────────────────
const mockVerifyWebhookSignature = jest.fn()

jest.mock('@/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: () => ({
    verifyWebhookSignature: mockVerifyWebhookSignature,
  }),
}))

// ─── Mock: Billing registry (uses moduleNameMapper from jest.config.cjs) ──────
// The auto-mock at tests/jest/__mocks__/@nextsparkjs/registries/billing-registry.ts
// is loaded by moduleNameMapper. We import it here for reference in tests.

// ─── Import SUT after mocks are set up ─────────────────────────────────────────
import { handleStripeWebhook } from '@/core/lib/billing/stripe-webhook'
import type { StripeWebhookExtensions } from '@/core/lib/billing/stripe-webhook'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createMockRequest(payload: string, signature: string | null = 'sig_test'): NextRequest {
  return {
    text: jest.fn<() => Promise<string>>().mockResolvedValue(payload),
    headers: {
      get: jest.fn((name: string) => (name === 'stripe-signature' ? signature : null)),
    },
  } as unknown as NextRequest
}

function buildStripeEvent(type: string, dataObject: Record<string, unknown>, eventId = 'evt_test_123') {
  return {
    id: eventId,
    type,
    data: { object: dataObject },
  }
}

function setupVerifiedEvent(type: string, dataObject: Record<string, unknown>, eventId?: string) {
  const event = buildStripeEvent(type, dataObject, eventId)
  mockVerifyWebhookSignature.mockReturnValue(event)
  // Default: event not yet processed (idempotency check)
  mockQueryOne.mockResolvedValueOnce(null)
  return event
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe('handleStripeWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: query returns empty rows
    mockQuery.mockResolvedValue({ rows: [] })
  })

  // ===========================================================================
  // 1. Signature verification
  // ===========================================================================

  describe('signature verification', () => {
    test('returns 400 if no stripe-signature header', async () => {
      const req = createMockRequest('payload', null)

      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('No signature provided')
      expect(mockVerifyWebhookSignature).not.toHaveBeenCalled()
    })

    test('returns 400 if signature verification fails', async () => {
      mockVerifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid signature')
      })
      const req = createMockRequest('payload', 'bad_sig')

      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })

    test('calls verifyWebhookSignature with payload and signature', async () => {
      const event = buildStripeEvent('unknown.event', {})
      mockVerifyWebhookSignature.mockReturnValue(event)
      mockQueryOne.mockResolvedValueOnce(null) // idempotency check

      const req = createMockRequest('raw_payload', 'sig_abc')
      await handleStripeWebhook(req)

      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith('raw_payload', 'sig_abc')
    })
  })

  // ===========================================================================
  // 2. Idempotency
  // ===========================================================================

  describe('idempotency', () => {
    test('skips duplicate events when queryOne returns existing record', async () => {
      const event = buildStripeEvent('checkout.session.completed', { id: 'cs_123' })
      mockVerifyWebhookSignature.mockReturnValue(event)
      // Return existing record -> duplicate
      mockQueryOne.mockResolvedValueOnce({ id: 'existing-billing-event-id' })

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      const body = await res.json()
      expect(body.status).toBe('duplicate')
      expect(body.received).toBe(true)
      // Should only have the idempotency queryOne call, no handler queries
      expect(mockQueryOne).toHaveBeenCalledTimes(1)
    })

    test('processes new events when queryOne returns null', async () => {
      setupVerifiedEvent('customer.subscription.deleted', {
        id: 'sub_123',
      })

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      const body = await res.json()
      expect(body.received).toBe(true)
      expect(body.status).toBeUndefined()
      // Handler should have run (query called for the UPDATE)
      expect(mockQuery).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 3. checkout.session.completed (subscription)
  // ===========================================================================

  describe('checkout.session.completed (subscription)', () => {
    const sessionData = {
      id: 'cs_checkout_123',
      metadata: {
        teamId: 'team-abc',
        planSlug: 'pro',
        billingPeriod: 'monthly',
        userId: 'user-xyz',
      },
      subscription: 'sub_new_123',
      customer: 'cus_new_123',
      amount_total: 4900,
      currency: 'usd',
      client_reference_id: null,
    }

    test('updates subscription with Stripe IDs when planSlug is in metadata', async () => {
      setupVerifiedEvent('checkout.session.completed', sessionData)
      // queryOne for plan lookup -> return plan ID
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })
      // queryOne for logBillingEvent -> subscription lookup
      mockQueryOne.mockResolvedValueOnce({ id: 'sub-uuid-123' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      // UPDATE subscriptions with plan, stripe IDs, status active
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"externalSubscriptionId"'),
        expect.arrayContaining(['sub_new_123', 'cus_new_123', 'plan-uuid-pro', 'monthly', 'team-abc'])
      )
    })

    test('updates plan, billingInterval, status to active', async () => {
      setupVerifiedEvent('checkout.session.completed', sessionData)
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })
      mockQueryOne.mockResolvedValueOnce({ id: 'sub-uuid-123' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      expect(sql).toContain('"planId"')
      expect(sql).toContain('"billingInterval"')
      expect(sql).toContain("status = 'active'")
    })

    test('logs billing event after checkout completed', async () => {
      setupVerifiedEvent('checkout.session.completed', sessionData)
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })
      // logBillingEvent: subscription lookup
      mockQueryOne.mockResolvedValueOnce({ id: 'sub-uuid-123' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      // The INSERT into billing_events
      const insertCall = mockQuery.mock.calls.find(
        (call) => (call[0] as string).includes('billing_events')
      )
      expect(insertCall).toBeDefined()
      const params = insertCall![1] as unknown[]
      expect(params).toContain('sub-uuid-123') // subscriptionId
      expect(params).toContain('payment') // type
      expect(params).toContain('succeeded') // status
      expect(params).toContain(4900) // amount
      expect(params).toContain('usd') // currency
    })

    test('falls back to update without plan when planSlug not found in DB', async () => {
      setupVerifiedEvent('checkout.session.completed', sessionData)
      // Plan lookup returns null
      mockQueryOne.mockResolvedValueOnce(null)
      // logBillingEvent subscription lookup
      mockQueryOne.mockResolvedValueOnce({ id: 'sub-uuid-123' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      // Fallback SQL should NOT contain planId
      expect(sql).not.toContain('"planId"')
      expect(sql).toContain("status = 'active'")
    })

    test('uses client_reference_id as teamId fallback', async () => {
      const sessionNoTeamMeta = {
        ...sessionData,
        metadata: { planSlug: 'pro', billingPeriod: 'monthly' },
        client_reference_id: 'team-from-ref',
      }
      setupVerifiedEvent('checkout.session.completed', sessionNoTeamMeta)
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })
      mockQueryOne.mockResolvedValueOnce({ id: 'sub-uuid-123' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const params = updateCall[1] as unknown[]
      expect(params).toContain('team-from-ref')
    })

    test('throws error when no team ID in session', async () => {
      const sessionNoTeam = {
        ...sessionData,
        metadata: { planSlug: 'pro' },
        client_reference_id: null,
      }
      setupVerifiedEvent('checkout.session.completed', sessionNoTeam)

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(500)
    })
  })

  // ===========================================================================
  // 4. checkout.session.completed (one-time payment)
  // ===========================================================================

  describe('checkout.session.completed (one-time payment)', () => {
    const oneTimeSession = {
      id: 'cs_onetime_123',
      metadata: { teamId: 'team-abc', userId: 'user-xyz' },
      subscription: null,
      customer: 'cus_123',
      amount_total: 9900,
      currency: 'usd',
      client_reference_id: null,
    }

    test('calls extensions.onOneTimePaymentCompleted when no planSlug', async () => {
      setupVerifiedEvent('checkout.session.completed', oneTimeSession)

      const mockExtension = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
      const extensions: StripeWebhookExtensions = {
        onOneTimePaymentCompleted: mockExtension,
      }

      const req = createMockRequest('payload')
      await handleStripeWebhook(req, extensions)

      expect(mockExtension).toHaveBeenCalledTimes(1)
    })

    test('creates StripeSessionData with correct fields', async () => {
      setupVerifiedEvent('checkout.session.completed', oneTimeSession)

      const mockExtension = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
      const extensions: StripeWebhookExtensions = {
        onOneTimePaymentCompleted: mockExtension,
      }

      const req = createMockRequest('payload')
      await handleStripeWebhook(req, extensions)

      const [sessionData, context] = mockExtension.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
      expect(sessionData).toEqual({
        id: 'cs_onetime_123',
        amountTotal: 9900,
        currency: 'usd',
        customerId: 'cus_123',
        subscriptionId: null,
        metadata: { teamId: 'team-abc', userId: 'user-xyz' },
        clientReferenceId: null,
      })
      expect(context).toEqual({ teamId: 'team-abc', userId: 'user-xyz' })
    })

    test('skips when no extension handler registered', async () => {
      setupVerifiedEvent('checkout.session.completed', oneTimeSession)

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
      // No DB updates should have happened (no subscription checkout, no handler)
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 5. invoice.paid
  // ===========================================================================

  describe('invoice.paid', () => {
    const invoiceData = {
      id: 'in_paid_123',
      subscription: 'sub_existing_123',
      number: 'INV-001',
      total: 4900,
      currency: 'usd',
      created: 1700000000,
      invoice_pdf: 'https://stripe.com/invoice.pdf',
      hosted_invoice_url: null,
      description: null,
      lines: {
        data: [
          {
            period: {
              start: 1700000000,
              end: 1702592000,
            },
          },
        ],
      },
    }

    test('updates subscription status to active', async () => {
      setupVerifiedEvent('invoice.paid', invoiceData)
      // syncInvoiceToDatabase: subscription lookup
      mockQuery.mockResolvedValueOnce({ rows: [] }) // UPDATE subscription
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] }) // SELECT teamId

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      expect(sql).toContain("status = 'active'")
      expect(sql).toContain('"externalSubscriptionId"')
    })

    test('updates currentPeriodStart/End from invoice line items', async () => {
      setupVerifiedEvent('invoice.paid', invoiceData)
      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      const params = updateCall[1] as unknown[]
      expect(sql).toContain('"currentPeriodStart"')
      expect(sql).toContain('"currentPeriodEnd"')
      expect(params).toContain(1700000000) // period.start
      expect(params).toContain(1702592000) // period.end
      expect(params).toContain('sub_existing_123')
    })

    test('syncs invoice to database', async () => {
      setupVerifiedEvent('invoice.paid', invoiceData)
      // UPDATE subscription
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // syncInvoiceToDatabase: SELECT teamId
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const insertCall = mockQuery.mock.calls.find(
        (call) => (call[0] as string).includes('INSERT INTO invoices')
      )
      expect(insertCall).toBeDefined()
      const params = insertCall![1] as unknown[]
      expect(params).toContain('team-abc')
      expect(params).toContain('INV-001')
      expect(params).toContain(49) // 4900/100 = amountInDollars
      expect(params).toContain('USD')
      expect(params).toContain('paid')
    })

    test('skips when invoice has no subscription ID', async () => {
      setupVerifiedEvent('invoice.paid', {
        ...invoiceData,
        subscription: null,
      })

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(200)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    test('updates without period dates when no line items', async () => {
      setupVerifiedEvent('invoice.paid', {
        ...invoiceData,
        lines: { data: [] },
      })
      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      expect(sql).toContain("status = 'active'")
      expect(sql).not.toContain('"currentPeriodStart"')
    })
  })

  // ===========================================================================
  // 6. invoice.payment_failed
  // ===========================================================================

  describe('invoice.payment_failed', () => {
    const failedInvoiceData = {
      id: 'in_failed_123',
      subscription: 'sub_existing_123',
      number: 'INV-002',
      total: 4900,
      currency: 'usd',
      created: 1700000000,
      invoice_pdf: null,
      hosted_invoice_url: 'https://stripe.com/hosted',
      description: 'Pro plan monthly',
      lines: { data: [] },
    }

    test('updates subscription status to past_due', async () => {
      setupVerifiedEvent('invoice.payment_failed', failedInvoiceData)
      mockQuery.mockResolvedValueOnce({ rows: [] }) // UPDATE subscription
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] }) // SELECT teamId

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      expect(sql).toContain("status = 'past_due'")
      expect(sql).toContain('"externalSubscriptionId"')
    })

    test('syncs invoice with failed status', async () => {
      setupVerifiedEvent('invoice.payment_failed', failedInvoiceData)
      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockResolvedValueOnce({ rows: [{ teamId: 'team-abc' }] })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const insertCall = mockQuery.mock.calls.find(
        (call) => (call[0] as string).includes('INSERT INTO invoices')
      )
      expect(insertCall).toBeDefined()
      const params = insertCall![1] as unknown[]
      expect(params).toContain('failed')
      expect(params).toContain('team-abc')
    })

    test('skips when invoice has no subscription ID', async () => {
      setupVerifiedEvent('invoice.payment_failed', {
        ...failedInvoiceData,
        subscription: null,
      })

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(200)
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 7. customer.subscription.updated
  // ===========================================================================

  describe('customer.subscription.updated', () => {
    const subscriptionData = {
      id: 'sub_updated_123',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: 1702592000,
      current_period_start: 1700000000,
      items: {
        data: [
          {
            price: { id: 'price_pro' },
          },
        ],
      },
    }

    test('updates subscription status mapping (active)', async () => {
      setupVerifiedEvent('customer.subscription.updated', subscriptionData)
      // queryOne for plan lookup by slug
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const params = updateCall[1] as unknown[]
      expect(params[0]).toBe('active')
    })

    test('maps trialing status correctly', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'trialing',
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('trialing')
    })

    test('maps past_due status correctly', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'past_due',
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('past_due')
    })

    test('maps unpaid to past_due', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'unpaid',
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('past_due')
    })

    test('maps incomplete_expired to expired', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'incomplete_expired',
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('expired')
    })

    test('maps canceled status correctly', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'canceled',
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('canceled')
    })

    test('updates cancelAtPeriodEnd', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        cancel_at_period_end: true,
      })
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      const params = updateCall[1] as unknown[]
      expect(sql).toContain('"cancelAtPeriodEnd"')
      expect(params[1]).toBe(true)
    })

    test('finds and updates plan by priceId from billing registry', async () => {
      setupVerifiedEvent('customer.subscription.updated', subscriptionData)
      // The billing registry mock has price_pro for the 'pro' plan
      // queryOne for plan DB lookup returns plan UUID
      mockQueryOne.mockResolvedValueOnce({ id: 'plan-uuid-pro' })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      const params = updateCall[1] as unknown[]
      expect(sql).toContain('"planId"')
      expect(params).toContain('plan-uuid-pro')
    })

    test('does not update plan when priceId not found in registry', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        items: { data: [{ price: { id: 'price_unknown_xyz' } }] },
      })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      expect(sql).not.toContain('"planId"')
    })

    test('defaults to active for unknown Stripe status', async () => {
      setupVerifiedEvent('customer.subscription.updated', {
        ...subscriptionData,
        status: 'some_future_status',
      })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const params = mockQuery.mock.calls[0][1] as unknown[]
      expect(params[0]).toBe('active')
    })
  })

  // ===========================================================================
  // 8. customer.subscription.deleted
  // ===========================================================================

  describe('customer.subscription.deleted', () => {
    test('updates subscription to canceled with canceledAt timestamp', async () => {
      setupVerifiedEvent('customer.subscription.deleted', {
        id: 'sub_deleted_123',
      })

      const req = createMockRequest('payload')
      await handleStripeWebhook(req)

      const updateCall = mockQuery.mock.calls[0]
      const sql = updateCall[0] as string
      const params = updateCall[1] as unknown[]
      expect(sql).toContain("status = 'canceled'")
      expect(sql).toContain('"canceledAt"')
      expect(sql).toContain('"externalSubscriptionId"')
      expect(params).toContain('sub_deleted_123')
    })
  })

  // ===========================================================================
  // 9. Error handling
  // ===========================================================================

  describe('error handling', () => {
    test('returns 500 on handler error', async () => {
      setupVerifiedEvent('checkout.session.completed', {
        id: 'cs_error',
        metadata: { teamId: 'team-abc', planSlug: 'pro' },
        subscription: 'sub_123',
        customer: 'cus_123',
        amount_total: 100,
        currency: 'usd',
        client_reference_id: null,
      })
      // Force plan lookup to throw
      mockQueryOne.mockRejectedValueOnce(new Error('DB connection lost'))

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Handler failed')
    })

    test('logs unhandled event types without error', async () => {
      setupVerifiedEvent('payment_intent.created', { id: 'pi_123' })

      const req = createMockRequest('payload')
      const res = await handleStripeWebhook(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
      // No DB calls should have been made for unhandled event
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
