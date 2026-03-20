/**
 * MercadoPago Marketplace Webhook Handler
 *
 * Handles MercadoPago webhook notifications for marketplace (split) payments.
 * Follows the "fetch full resource" pattern: MP webhooks only send the resource ID,
 * so the handler fetches the complete payment object from the API.
 *
 * Key behaviors:
 * - Signature verification via x-signature HMAC-SHA256
 * - Idempotency via marketplaceWebhookEvents table
 * - Full payment fetch from MP API (webhook body only has resource ID)
 * - Status mapping to MarketplacePaymentStatus
 * - Extension point for theme-specific logic
 *
 * Webhook vs IPN:
 * - This uses Webhooks (v2), the current recommended system as of 2025
 * - IPN is legacy/deprecated. Do not use for new integrations.
 *
 * Retry behavior (MercadoPago):
 * - Retries on any non-2xx response (~10 attempts over ~4 days, exponential backoff)
 * - First retry ~5 minutes after failure
 * - Return 200 for events you want to skip (not 400, which triggers retries)
 *
 * Usage in route.ts:
 *   import { handleMPMarketplaceWebhook } from '@nextsparkjs/core/lib/marketplace/mercadopago-webhook'
 *   export async function POST(request: NextRequest) {
 *     return handleMPMarketplaceWebhook(request)
 *   }
 *
 * With extensions:
 *   export async function POST(request: NextRequest) {
 *     return handleMPMarketplaceWebhook(request, {
 *       onPaymentApproved: async (payment, context) => { ... },
 *       onPaymentRejected: async (payment, context) => { ... },
 *       onChargeBack: async (payment, context) => { ... },
 *     })
 *   }
 */

import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { query, queryOne } from '../db'
import type { MarketplacePaymentStatus } from './types'

// ===========================================
// Types
// ===========================================

/**
 * MercadoPago webhook notification body.
 * This is the minimal payload MP sends — NOT the full payment.
 */
export interface MPWebhookNotification {
  /** Notification ID (not the payment ID) */
  id: number
  /** Whether this is a production notification */
  live_mode: boolean
  /** Resource type: "payment", "plan", "subscription", "invoice" */
  type: string
  /** ISO 8601 datetime */
  date_created: string
  /** MercadoPago user_id of the application owner (your marketplace account) */
  user_id: number
  /** API version */
  api_version: string
  /** Event action: "payment.created", "payment.updated", etc. */
  action: string
  /** Contains only the resource ID — you MUST fetch the full resource */
  data: {
    id: string
  }
}

/**
 * Full payment object fetched from MP API after receiving webhook.
 * This is a subset of the fields — only those relevant to marketplace processing.
 */
export interface MPFullPayment {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  currency_id: string
  description: string | null
  payment_method_id: string
  payment_type_id: string
  date_approved: string | null
  date_created: string
  external_reference: string | null
  /** Seller's MP user ID (the one who collected the payment) */
  collector_id: number
  /** Payer info */
  payer: {
    id: number | null
    email: string | null
    type: string | null
  }
  /** Fee breakdown — key for detecting marketplace payments */
  fee_details: Array<{
    /** "mercadopago_fee" (MP processing fee) or "application_fee" (your marketplace_fee) */
    type: string
    amount: number
    fee_payer: string
  }>
  /** Net amount details */
  transaction_details: {
    net_received_amount: number
    total_paid_amount: number
    overpaid_amount: number
    installment_amount: number
  } | null
  /** Metadata set when creating the payment/preference */
  metadata: Record<string, string> | null
  /** Marketplace owner's collector ID — present ONLY for marketplace payments */
  marketplace_owner: number | null
  /** Number of installments (common in LATAM) */
  installments: number
  /** Refund details if any */
  refunds: Array<{
    id: number
    amount: number
    status: string
    date_created: string
  }> | null
}

/**
 * Parsed payment context passed to extension callbacks.
 */
export interface MPPaymentContext {
  /** Our internal reference ID (from external_reference or metadata) */
  referenceId: string | null
  /** Connected account ID from metadata */
  connectedAccountId: string | null
  /** Seller's MP user ID */
  sellerUserId: number
  /** Whether this is a marketplace payment (has marketplace_owner or application_fee) */
  isMarketplacePayment: boolean
  /** The application fee (marketplace_fee) amount, if present */
  applicationFee: number
  /** MercadoPago's own processing fee */
  providerFee: number
  /** Net amount the seller receives */
  netAmount: number
  /** Our mapped status */
  mappedStatus: MarketplacePaymentStatus
}

/**
 * Extension hooks for theme-specific marketplace webhook logic.
 */
export interface MPMarketplaceWebhookExtensions {
  /** Called when a marketplace payment is approved (status = approved) */
  onPaymentApproved?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a marketplace payment is rejected */
  onPaymentRejected?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a payment goes into pending state (cash payments like rapipago/boleto/oxxo) */
  onPaymentPending?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a chargeback is initiated */
  onChargeBack?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a payment is refunded */
  onPaymentRefunded?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a payment is cancelled */
  onPaymentCancelled?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called when a dispute/mediation is opened */
  onPaymentInMediation?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
  /** Called for any payment status update (after the specific handler above) */
  onPaymentUpdated?: (payment: MPFullPayment, context: MPPaymentContext) => Promise<void>
}

// ===========================================
// Signature Verification
// ===========================================

/**
 * Verify MercadoPago webhook x-signature header.
 *
 * Algorithm:
 * 1. Parse ts (timestamp) and v1 (hash) from x-signature: "ts=123,v1=abc"
 * 2. Build manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 * 3. HMAC-SHA256(manifest, webhook_secret)
 * 4. Compare hex digest with v1
 *
 * Only parts that are present are included in the manifest.
 * In practice, all three (id, request-id, ts) are always present for v2 webhooks.
 */
function verifyMPWebhookSignature(params: {
  xSignature: string
  xRequestId: string
  dataId: string
  webhookSecret: string
}): void {
  const { xSignature, xRequestId, dataId, webhookSecret } = params

  // Parse "ts=1234567890,v1=abc123def456..."
  const parts: Record<string, string> = {}
  xSignature.split(',').forEach((segment) => {
    const eqIndex = segment.indexOf('=')
    if (eqIndex > 0) {
      const key = segment.substring(0, eqIndex).trim()
      const value = segment.substring(eqIndex + 1).trim()
      parts[key] = value
    }
  })

  const ts = parts['ts']
  const expectedHash = parts['v1']

  if (!expectedHash) {
    throw new Error('Missing v1 hash in x-signature header')
  }

  // Build manifest string — only include parts that are present
  let manifest = ''
  if (dataId) manifest += `id:${dataId};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  if (ts) manifest += `ts:${ts};`

  const computedHash = createHmac('sha256', webhookSecret)
    .update(manifest)
    .digest('hex')

  if (computedHash !== expectedHash) {
    throw new Error('MercadoPago webhook signature verification failed')
  }
}

// ===========================================
// Status Mapping
// ===========================================

function mapMPStatus(status: string): MarketplacePaymentStatus {
  const statusMap: Record<string, MarketplacePaymentStatus> = {
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
  return statusMap[status] || 'failed'
}

// ===========================================
// Full Resource Fetch
// ===========================================

/**
 * Fetch the full payment resource from MercadoPago API.
 *
 * CRITICAL: MP webhooks only send the resource ID in data.id.
 * You MUST fetch the full payment to get status, amounts, fees, etc.
 * Use the platform access token (not seller token) to read any payment.
 */
async function fetchFullPayment(paymentId: string): Promise<MPFullPayment> {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN is not configured')
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch payment ${paymentId}: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<MPFullPayment>
}

// ===========================================
// Payment Context Builder
// ===========================================

function buildPaymentContext(payment: MPFullPayment): MPPaymentContext {
  const applicationFeeEntry = payment.fee_details?.find(f => f.type === 'application_fee')
  const providerFeeEntry = payment.fee_details?.find(f => f.type === 'mercadopago_fee')

  const applicationFee = applicationFeeEntry?.amount ?? 0
  const providerFee = providerFeeEntry?.amount ?? 0
  const netAmount = payment.transaction_details?.net_received_amount ?? (payment.transaction_amount - applicationFee - providerFee)

  // Detect marketplace payment:
  // - marketplace_owner is present (set by MP when payment is created with marketplace_fee)
  // - OR there is an application_fee in fee_details
  const isMarketplacePayment = payment.marketplace_owner !== null || applicationFee > 0

  return {
    referenceId: payment.external_reference ?? payment.metadata?.referenceId ?? null,
    connectedAccountId: payment.metadata?.connectedAccountId ?? null,
    sellerUserId: payment.collector_id,
    isMarketplacePayment,
    applicationFee,
    providerFee,
    netAmount,
    mappedStatus: mapMPStatus(payment.status),
  }
}

// ===========================================
// Main Handler
// ===========================================

export async function handleMPMarketplaceWebhook(
  request: NextRequest,
  extensions?: MPMarketplaceWebhookExtensions
): Promise<Response> {
  // 1. Read raw body and headers
  const rawBody = await request.text()
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  // 2. Parse body
  let notification: MPWebhookNotification
  try {
    notification = JSON.parse(rawBody) as MPWebhookNotification
  } catch {
    // Return 200 even for unparseable bodies — returning 400 triggers MP retries
    console.error('[mp-marketplace-webhook] Failed to parse request body')
    return Response.json({ received: true, status: 'parse_error' })
  }

  // 3. Only process payment notifications
  if (notification.type !== 'payment') {
    console.log(`[mp-marketplace-webhook] Ignoring non-payment notification: ${notification.type}/${notification.action}`)
    return Response.json({ received: true, status: 'ignored' })
  }

  const dataId = notification.data?.id
  if (!dataId) {
    console.error('[mp-marketplace-webhook] Missing data.id in notification')
    return Response.json({ received: true, status: 'missing_data_id' })
  }

  // 4. Verify webhook signature (MANDATORY for security)
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[mp-marketplace-webhook] MP_WEBHOOK_SECRET is not configured')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (xSignature && xRequestId) {
    try {
      verifyMPWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
        webhookSecret,
      })
    } catch (error) {
      console.error('[mp-marketplace-webhook] Signature verification failed:', error)
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    // In production, reject requests without signature headers.
    // MP v2 webhooks always include these headers.
    if (process.env.NODE_ENV === 'production') {
      console.error('[mp-marketplace-webhook] Missing x-signature or x-request-id headers')
      return Response.json({ error: 'Missing signature headers' }, { status: 401 })
    }
    console.warn('[mp-marketplace-webhook] Missing signature headers (allowed in non-production)')
  }

  // 5. Idempotency — check if we already processed this notification
  const notificationId = String(notification.id)
  const existing = await queryOne(
    `SELECT id FROM "marketplaceWebhookEvents" WHERE "externalEventId" = $1`,
    [notificationId]
  )

  if (existing) {
    console.log(`[mp-marketplace-webhook] Notification ${notificationId} already processed, skipping`)
    return Response.json({ received: true, status: 'duplicate' })
  }

  // 6. Fetch the full payment from MercadoPago API
  //    This is the critical "fetch full resource" pattern.
  //    The webhook body only has the payment ID — we must call the API to get everything.
  let payment: MPFullPayment
  try {
    payment = await fetchFullPayment(dataId)
  } catch (error) {
    console.error(`[mp-marketplace-webhook] Failed to fetch payment ${dataId}:`, error)
    // Return 500 so MP retries this notification
    return Response.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }

  const context = buildPaymentContext(payment)

  console.log(
    `[mp-marketplace-webhook] Processing payment ${payment.id}: ` +
    `status=${payment.status}, marketplace=${context.isMarketplacePayment}, ` +
    `amount=${payment.transaction_amount} ${payment.currency_id}, ` +
    `fee=${context.applicationFee}, ref=${context.referenceId}`
  )

  // 7. Record the webhook event (for idempotency and audit trail)
  try {
    await query(
      `INSERT INTO "marketplaceWebhookEvents" (
        "externalEventId", provider, "eventType", action, "resourceId",
        processed, "processedAt", "rawPayload"
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [
        notificationId,
        'mercadopago_split',
        notification.type,
        notification.action,
        dataId,
        true,
        JSON.stringify(notification),
      ]
    )
  } catch (error) {
    console.error('[mp-marketplace-webhook] Failed to record webhook event:', error)
    // Continue processing — the payment update is more important than the audit record
  }

  // 8. Update the marketplace payment record in our database
  try {
    await upsertMarketplacePayment(payment, context)
  } catch (error) {
    console.error(`[mp-marketplace-webhook] Failed to update payment record:`, error)
    // Continue to extension callbacks — partial processing is better than none
  }

  // 9. Call extension callbacks based on payment status
  try {
    switch (payment.status) {
      case 'approved':
        await extensions?.onPaymentApproved?.(payment, context)
        break
      case 'rejected':
        await extensions?.onPaymentRejected?.(payment, context)
        break
      case 'pending':
        await extensions?.onPaymentPending?.(payment, context)
        break
      case 'charged_back':
        await extensions?.onChargeBack?.(payment, context)
        break
      case 'refunded':
        await extensions?.onPaymentRefunded?.(payment, context)
        break
      case 'cancelled':
        await extensions?.onPaymentCancelled?.(payment, context)
        break
      case 'in_mediation':
        await extensions?.onPaymentInMediation?.(payment, context)
        break
    }

    // Always call the generic onPaymentUpdated if provided
    await extensions?.onPaymentUpdated?.(payment, context)
  } catch (error) {
    console.error('[mp-marketplace-webhook] Extension handler error:', error)
    // Return 500 so MP retries — the extension logic may be critical
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

// ===========================================
// Database Helpers
// ===========================================

/**
 * Upsert a marketplace payment record.
 * Uses the MP payment ID as the unique key.
 * Creates the record on payment.created, updates on payment.updated.
 */
async function upsertMarketplacePayment(
  payment: MPFullPayment,
  context: MPPaymentContext
): Promise<void> {
  const refundedAmount = payment.refunds?.reduce((sum, r) => {
    return r.status === 'approved' ? sum + r.amount : sum
  }, 0) ?? 0

  await query(
    `INSERT INTO "marketplacePayments" (
      "externalPaymentId",
      "connectedAccountId",
      "referenceId",
      "totalAmount",
      "applicationFee",
      "providerFee",
      "businessAmount",
      currency,
      status,
      "statusDetail",
      "paymentMethod",
      "paymentType",
      "refundedAmount",
      metadata,
      "paidAt",
      "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT ("externalPaymentId") DO UPDATE SET
      status = EXCLUDED.status,
      "statusDetail" = EXCLUDED."statusDetail",
      "refundedAmount" = EXCLUDED."refundedAmount",
      "paidAt" = COALESCE(EXCLUDED."paidAt", "marketplacePayments"."paidAt"),
      "updatedAt" = NOW()`,
    [
      String(payment.id),
      context.connectedAccountId,
      context.referenceId,
      payment.transaction_amount,
      context.applicationFee,
      context.providerFee,
      context.netAmount,
      payment.currency_id.toLowerCase(),
      context.mappedStatus,
      payment.status_detail,
      payment.payment_method_id,
      payment.payment_type_id,
      refundedAmount,
      JSON.stringify(payment.metadata ?? {}),
      payment.date_approved ? new Date(payment.date_approved) : null,
    ]
  )
}
