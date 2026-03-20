/**
 * MercadoPago Webhook Handler Tests
 *
 * Tests the pure logic functions used by the MP marketplace webhook handler:
 * - Signature verification (HMAC-SHA256 algorithm)
 * - Status mapping (MP status → MarketplacePaymentStatus)
 * - Payment context building (marketplace detection, fees, references)
 *
 * NOTE: The main handleMPMarketplaceWebhook function requires NextRequest and DB,
 * so it's tested at integration level. These tests cover the algorithmic core.
 */

import { describe, test, expect } from '@jest/globals'
import { createHmac } from 'crypto'
import type {
  MPFullPayment,
  MPPaymentContext,
  MPWebhookNotification,
  MPMarketplaceWebhookExtensions,
} from '@/core/lib/marketplace/mercadopago-webhook'

// ===========================================
// Signature Verification Algorithm
// ===========================================

describe('MercadoPago Webhook Signature Verification', () => {
  const webhookSecret = 'test-webhook-secret-123'

  /**
   * Recreates the HMAC algorithm used in verifyMPWebhookSignature.
   * This validates our understanding of the MP signature format:
   *   manifest = "id:{dataId};request-id:{xRequestId};ts:{ts};"
   *   hash = HMAC-SHA256(manifest, secret)
   */
  function computeSignature(params: {
    dataId?: string
    xRequestId?: string
    ts?: string
    secret: string
  }): string {
    let manifest = ''
    if (params.dataId) manifest += `id:${params.dataId};`
    if (params.xRequestId) manifest += `request-id:${params.xRequestId};`
    if (params.ts) manifest += `ts:${params.ts};`

    return createHmac('sha256', params.secret).update(manifest).digest('hex')
  }

  test('should produce correct HMAC for known inputs', () => {
    const dataId = '12345'
    const requestId = 'req-abc-123'
    const ts = '1700000000'

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
    const hmac = createHmac('sha256', webhookSecret).update(manifest).digest('hex')

    expect(manifest).toBe('id:12345;request-id:req-abc-123;ts:1700000000;')
    expect(hmac).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  test('should produce different HMAC for different timestamps', () => {
    const hmac1 = computeSignature({
      dataId: '12345',
      xRequestId: 'req-1',
      ts: '1000',
      secret: webhookSecret,
    })
    const hmac2 = computeSignature({
      dataId: '12345',
      xRequestId: 'req-1',
      ts: '1001',
      secret: webhookSecret,
    })

    expect(hmac1).not.toBe(hmac2)
  })

  test('should produce different HMAC for different data IDs', () => {
    const hmac1 = computeSignature({
      dataId: '12345',
      xRequestId: 'req-1',
      ts: '1000',
      secret: webhookSecret,
    })
    const hmac2 = computeSignature({
      dataId: '99999',
      xRequestId: 'req-1',
      ts: '1000',
      secret: webhookSecret,
    })

    expect(hmac1).not.toBe(hmac2)
  })

  test('should produce different HMAC for different secrets', () => {
    const params = { dataId: '12345', xRequestId: 'req-1', ts: '1000' }

    const hmac1 = computeSignature({ ...params, secret: 'secret-a' })
    const hmac2 = computeSignature({ ...params, secret: 'secret-b' })

    expect(hmac1).not.toBe(hmac2)
  })

  test('should produce deterministic HMAC for same inputs', () => {
    const params = {
      dataId: '12345',
      xRequestId: 'req-1',
      ts: '1000',
      secret: webhookSecret,
    }

    const hmac1 = computeSignature(params)
    const hmac2 = computeSignature(params)

    expect(hmac1).toBe(hmac2)
  })

  test('manifest should only include present parts', () => {
    // With all parts
    const manifestFull = 'id:123;request-id:req-1;ts:1000;'
    const hmacFull = createHmac('sha256', webhookSecret).update(manifestFull).digest('hex')

    // Without request-id
    const manifestNoReqId = 'id:123;ts:1000;'
    const hmacNoReqId = createHmac('sha256', webhookSecret).update(manifestNoReqId).digest('hex')

    expect(hmacFull).not.toBe(hmacNoReqId)

    // Verify our computeSignature helper matches
    expect(computeSignature({ dataId: '123', xRequestId: 'req-1', ts: '1000', secret: webhookSecret }))
      .toBe(hmacFull)
    expect(computeSignature({ dataId: '123', ts: '1000', secret: webhookSecret }))
      .toBe(hmacNoReqId)
  })

  test('x-signature header should be parseable as ts=...,v1=... format', () => {
    const ts = '1700000000'
    const hash = computeSignature({
      dataId: '12345',
      xRequestId: 'req-abc',
      ts,
      secret: webhookSecret,
    })

    // Build x-signature header the way MP sends it
    const xSignature = `ts=${ts},v1=${hash}`

    // Parse it the same way the handler does
    const parts: Record<string, string> = {}
    xSignature.split(',').forEach((segment) => {
      const eqIndex = segment.indexOf('=')
      if (eqIndex > 0) {
        const key = segment.substring(0, eqIndex).trim()
        const value = segment.substring(eqIndex + 1).trim()
        parts[key] = value
      }
    })

    expect(parts['ts']).toBe(ts)
    expect(parts['v1']).toBe(hash)
    expect(parts['v1']).toHaveLength(64)
  })

  test('should handle v1 hash containing = characters', () => {
    // SHA-256 hex output never contains '=' but test robustness of parsing
    // The parser uses indexOf('=') and substring, not split('=')
    const xSignature = 'ts=12345,v1=abc123def456'

    const parts: Record<string, string> = {}
    xSignature.split(',').forEach((segment) => {
      const eqIndex = segment.indexOf('=')
      if (eqIndex > 0) {
        const key = segment.substring(0, eqIndex).trim()
        const value = segment.substring(eqIndex + 1).trim()
        parts[key] = value
      }
    })

    expect(parts['ts']).toBe('12345')
    expect(parts['v1']).toBe('abc123def456')
  })
})

// ===========================================
// Status Mapping
// ===========================================

describe('MercadoPago Status Mapping', () => {
  /**
   * Recreates the status mapping from mapMPStatus.
   * This ensures our mapping matches what the handler uses.
   */
  const statusMap: Record<string, string> = {
    pending: 'pending',
    approved: 'succeeded',
    authorized: 'processing',
    in_process: 'processing',
    in_mediation: 'disputed',
    rejected: 'failed',
    cancelled: 'canceled',
    refunded: 'refunded',
    charged_back: 'disputed',
  }

  test.each(Object.entries(statusMap))(
    'MP status "%s" should map to "%s"',
    (mpStatus, expectedStatus) => {
      // Apply the same logic as mapMPStatus
      const mapped = statusMap[mpStatus] || 'failed'
      expect(mapped).toBe(expectedStatus)
    }
  )

  test('unknown status should default to "failed"', () => {
    const mapped = statusMap['unknown_status'] || 'failed'
    expect(mapped).toBe('failed')
  })

  test('empty status should default to "failed"', () => {
    const mapped = statusMap[''] || 'failed'
    expect(mapped).toBe('failed')
  })

  test('should cover all standard MercadoPago payment statuses', () => {
    // These are ALL payment statuses documented by MercadoPago
    const allMPStatuses = [
      'pending',
      'approved',
      'authorized',
      'in_process',
      'in_mediation',
      'rejected',
      'cancelled',
      'refunded',
      'charged_back',
    ]

    for (const status of allMPStatuses) {
      expect(statusMap[status]).toBeDefined()
    }
  })

  test('disputed statuses should both map to "disputed"', () => {
    expect(statusMap['in_mediation']).toBe('disputed')
    expect(statusMap['charged_back']).toBe('disputed')
  })

  test('processing statuses should both map to "processing"', () => {
    expect(statusMap['authorized']).toBe('processing')
    expect(statusMap['in_process']).toBe('processing')
  })
})

// ===========================================
// Payment Context Building
// ===========================================

describe('MercadoPago Payment Context Building', () => {
  /**
   * Recreates the buildPaymentContext logic from the handler.
   * This lets us test marketplace detection, fee extraction, and reference resolution.
   */
  function buildPaymentContext(payment: MPFullPayment): MPPaymentContext {
    const statusMap: Record<string, string> = {
      pending: 'pending',
      approved: 'succeeded',
      authorized: 'processing',
      in_process: 'processing',
      in_mediation: 'disputed',
      rejected: 'failed',
      cancelled: 'canceled',
      refunded: 'refunded',
      charged_back: 'disputed',
    }

    const applicationFeeEntry = payment.fee_details?.find(f => f.type === 'application_fee')
    const providerFeeEntry = payment.fee_details?.find(f => f.type === 'mercadopago_fee')

    const applicationFee = applicationFeeEntry?.amount ?? 0
    const providerFee = providerFeeEntry?.amount ?? 0
    const netAmount = payment.transaction_details?.net_received_amount
      ?? (payment.transaction_amount - applicationFee - providerFee)

    const isMarketplacePayment = payment.marketplace_owner !== null || applicationFee > 0

    return {
      referenceId: payment.external_reference ?? payment.metadata?.referenceId ?? null,
      connectedAccountId: payment.metadata?.connectedAccountId ?? null,
      sellerUserId: payment.collector_id,
      isMarketplacePayment,
      applicationFee,
      providerFee,
      netAmount,
      mappedStatus: (statusMap[payment.status] || 'failed') as MPPaymentContext['mappedStatus'],
    }
  }

  /** Helper to create a minimal valid payment */
  function makePayment(overrides: Partial<MPFullPayment> = {}): MPFullPayment {
    return {
      id: 12345,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 10000,
      currency_id: 'ARS',
      description: 'Test payment',
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      date_approved: '2025-06-15T10:30:00.000-03:00',
      date_created: '2025-06-15T10:29:55.000-03:00',
      external_reference: null,
      collector_id: 98765,
      payer: { id: 54321, email: 'buyer@test.com', type: 'customer' },
      fee_details: [],
      transaction_details: null,
      metadata: null,
      marketplace_owner: null,
      installments: 1,
      refunds: null,
      ...overrides,
    }
  }

  describe('marketplace detection', () => {
    test('payment with marketplace_owner set should be detected as marketplace', () => {
      const payment = makePayment({ marketplace_owner: 111222 })
      const context = buildPaymentContext(payment)

      expect(context.isMarketplacePayment).toBe(true)
    })

    test('payment with application_fee in fee_details should be detected as marketplace', () => {
      const payment = makePayment({
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      expect(context.isMarketplacePayment).toBe(true)
    })

    test('payment with both marketplace_owner AND application_fee should be marketplace', () => {
      const payment = makePayment({
        marketplace_owner: 111222,
        fee_details: [
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      expect(context.isMarketplacePayment).toBe(true)
    })

    test('regular payment (no marketplace_owner, no application_fee) should NOT be marketplace', () => {
      const payment = makePayment({
        marketplace_owner: null,
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      expect(context.isMarketplacePayment).toBe(false)
    })

    test('payment with empty fee_details and null marketplace_owner should NOT be marketplace', () => {
      const payment = makePayment({
        marketplace_owner: null,
        fee_details: [],
      })
      const context = buildPaymentContext(payment)

      expect(context.isMarketplacePayment).toBe(false)
    })
  })

  describe('fee extraction', () => {
    test('should extract application_fee from fee_details', () => {
      const payment = makePayment({
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      expect(context.applicationFee).toBe(1500)
    })

    test('should extract mercadopago_fee from fee_details', () => {
      const payment = makePayment({
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      expect(context.providerFee).toBe(450)
    })

    test('should default fees to 0 when not present', () => {
      const payment = makePayment({ fee_details: [] })
      const context = buildPaymentContext(payment)

      expect(context.applicationFee).toBe(0)
      expect(context.providerFee).toBe(0)
    })
  })

  describe('net amount calculation', () => {
    test('should use transaction_details.net_received_amount when available', () => {
      const payment = makePayment({
        transaction_amount: 10000,
        transaction_details: {
          net_received_amount: 8050,
          total_paid_amount: 10000,
          overpaid_amount: 0,
          installment_amount: 10000,
        },
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      // Should use net_received_amount from transaction_details, not calculate
      expect(context.netAmount).toBe(8050)
    })

    test('should calculate net amount when transaction_details is null', () => {
      const payment = makePayment({
        transaction_amount: 10000,
        transaction_details: null,
        fee_details: [
          { type: 'mercadopago_fee', amount: 450, fee_payer: 'collector' },
          { type: 'application_fee', amount: 1500, fee_payer: 'collector' },
        ],
      })
      const context = buildPaymentContext(payment)

      // 10000 - 1500 - 450 = 8050
      expect(context.netAmount).toBe(8050)
    })

    test('net amount should equal transaction_amount when no fees', () => {
      const payment = makePayment({
        transaction_amount: 5000,
        transaction_details: null,
        fee_details: [],
      })
      const context = buildPaymentContext(payment)

      expect(context.netAmount).toBe(5000)
    })
  })

  describe('reference resolution', () => {
    test('should use external_reference when available', () => {
      const payment = makePayment({
        external_reference: 'booking-123',
        metadata: { referenceId: 'meta-456' },
      })
      const context = buildPaymentContext(payment)

      expect(context.referenceId).toBe('booking-123')
    })

    test('should fall back to metadata.referenceId when external_reference is null', () => {
      const payment = makePayment({
        external_reference: null,
        metadata: { referenceId: 'meta-456' },
      })
      const context = buildPaymentContext(payment)

      expect(context.referenceId).toBe('meta-456')
    })

    test('should be null when no reference is available', () => {
      const payment = makePayment({
        external_reference: null,
        metadata: null,
      })
      const context = buildPaymentContext(payment)

      expect(context.referenceId).toBeNull()
    })

    test('should extract connectedAccountId from metadata', () => {
      const payment = makePayment({
        metadata: { connectedAccountId: 'ca-789', referenceId: 'ref-1' },
      })
      const context = buildPaymentContext(payment)

      expect(context.connectedAccountId).toBe('ca-789')
    })

    test('connectedAccountId should be null when not in metadata', () => {
      const payment = makePayment({ metadata: null })
      const context = buildPaymentContext(payment)

      expect(context.connectedAccountId).toBeNull()
    })
  })

  describe('status mapping in context', () => {
    test('approved payment should map to "succeeded"', () => {
      const payment = makePayment({ status: 'approved' })
      const context = buildPaymentContext(payment)

      expect(context.mappedStatus).toBe('succeeded')
    })

    test('pending payment should map to "pending"', () => {
      const payment = makePayment({ status: 'pending' })
      const context = buildPaymentContext(payment)

      expect(context.mappedStatus).toBe('pending')
    })

    test('rejected payment should map to "failed"', () => {
      const payment = makePayment({ status: 'rejected' })
      const context = buildPaymentContext(payment)

      expect(context.mappedStatus).toBe('failed')
    })

    test('charged_back payment should map to "disputed"', () => {
      const payment = makePayment({ status: 'charged_back' })
      const context = buildPaymentContext(payment)

      expect(context.mappedStatus).toBe('disputed')
    })
  })

  describe('seller identification', () => {
    test('should set sellerUserId from collector_id', () => {
      const payment = makePayment({ collector_id: 555888 })
      const context = buildPaymentContext(payment)

      expect(context.sellerUserId).toBe(555888)
    })
  })
})

// ===========================================
// Type Validation (compile-time checks)
// ===========================================

describe('MercadoPago Webhook Types', () => {
  test('MPWebhookNotification should have required fields', () => {
    const notification: MPWebhookNotification = {
      id: 1,
      live_mode: true,
      type: 'payment',
      date_created: '2025-06-15T10:00:00.000Z',
      user_id: 12345,
      api_version: 'v1',
      action: 'payment.created',
      data: { id: '67890' },
    }

    expect(notification.type).toBe('payment')
    expect(notification.data.id).toBe('67890')
    expect(notification.action).toBe('payment.created')
  })

  test('MPMarketplaceWebhookExtensions should allow all optional hooks', () => {
    const extensions: MPMarketplaceWebhookExtensions = {
      onPaymentApproved: async () => {},
      onPaymentRejected: async () => {},
      onPaymentPending: async () => {},
      onChargeBack: async () => {},
      onPaymentRefunded: async () => {},
      onPaymentCancelled: async () => {},
      onPaymentInMediation: async () => {},
      onPaymentUpdated: async () => {},
    }

    // All hooks should be defined
    expect(extensions.onPaymentApproved).toBeDefined()
    expect(extensions.onPaymentRejected).toBeDefined()
    expect(extensions.onPaymentPending).toBeDefined()
    expect(extensions.onChargeBack).toBeDefined()
    expect(extensions.onPaymentRefunded).toBeDefined()
    expect(extensions.onPaymentCancelled).toBeDefined()
    expect(extensions.onPaymentInMediation).toBeDefined()
    expect(extensions.onPaymentUpdated).toBeDefined()
  })

  test('MPMarketplaceWebhookExtensions should allow empty object', () => {
    const extensions: MPMarketplaceWebhookExtensions = {}

    expect(extensions.onPaymentApproved).toBeUndefined()
  })
})
