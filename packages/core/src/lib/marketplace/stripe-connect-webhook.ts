/**
 * Stripe Connect Webhook Handler
 *
 * Handles Connect-specific events for marketplace payment splitting.
 * Uses a SEPARATE webhook endpoint and signing secret from regular billing webhooks.
 *
 * Events handled:
 * - account.updated: KYC/onboarding status changes
 * - payment_intent.succeeded/failed: Payment lifecycle
 * - charge.refunded: Refund processing
 * - charge.dispute.created/closed: Dispute handling
 * - payout.paid/failed: Payout lifecycle
 * - transfer.created/reversed: Transfer tracking
 */

import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { query, queryOne } from '../db'

// Lazy Stripe instance
let stripeInstance: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }
  return stripeInstance
}

export interface StripeConnectWebhookExtensions {
  /** Called when a payment succeeds for custom business logic */
  onPaymentSucceeded?: (paymentIntent: Stripe.PaymentIntent, connectedAccountId: string) => Promise<void>
  /** Called when a dispute is created */
  onDisputeCreated?: (dispute: Stripe.Dispute, connectedAccountId: string) => Promise<void>
}

export async function handleStripeConnectWebhook(
  request: NextRequest,
  extensions?: StripeConnectWebhookExtensions
): Promise<Response> {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json({ error: 'No signature provided' }, { status: 400 })
  }

  // Verify using CONNECT webhook secret (separate from billing webhook secret)
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET not configured')
    return Response.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('[stripe-connect-webhook] Signature verification failed:', error)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Connect events include event.account (the connected account ID)
  const connectedAccountId = event.account || ''

  // Idempotency check
  const existing = await queryOne(
    `SELECT id FROM "marketplaceWebhookEvents" WHERE provider = 'stripe_connect' AND "externalEventId" = $1`,
    [event.id]
  )
  if (existing) {
    return Response.json({ received: true, status: 'duplicate' })
  }

  // Log event
  await query(
    `INSERT INTO "marketplaceWebhookEvents" (provider, "externalEventId", "eventType", action, "resourceId", "rawPayload")
     VALUES ('stripe_connect', $1, $2, $3, $4, $5)`,
    [event.id, event.type, event.type, connectedAccountId, JSON.stringify(event.data)]
  )

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, connectedAccountId, extensions)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute, connectedAccountId, extensions)
        break

      case 'payout.paid':
      case 'payout.failed':
        await handlePayoutEvent(event.data.object as Stripe.Payout, event.type)
        break

      default:
        console.log(`[stripe-connect-webhook] Unhandled event: ${event.type}`)
    }

    // Mark as processed
    await query(
      `UPDATE "marketplaceWebhookEvents" SET processed = true, "processedAt" = NOW()
       WHERE provider = 'stripe_connect' AND "externalEventId" = $1`,
      [event.id]
    )

    return Response.json({ received: true })
  } catch (error) {
    console.error(`[stripe-connect-webhook] Error handling ${event.type}:`, error)

    await query(
      `UPDATE "marketplaceWebhookEvents" SET error = $1
       WHERE provider = 'stripe_connect' AND "externalEventId" = $2`,
      [error instanceof Error ? error.message : 'Unknown error', event.id]
    )

    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }
}

// ===========================================
// EVENT HANDLERS
// ===========================================

async function handleAccountUpdated(account: Stripe.Account) {
  const statusMap: Record<string, string> = {
    active: 'active',
    pending: 'in_progress',
    restricted: 'restricted',
    disabled: 'disabled',
  }

  let onboardingStatus = 'pending'
  if (account.requirements?.disabled_reason) onboardingStatus = 'disabled'
  else if (account.charges_enabled && account.payouts_enabled) onboardingStatus = 'active'
  else if (account.requirements?.past_due?.length) onboardingStatus = 'restricted'
  else if (account.details_submitted) onboardingStatus = 'in_progress'

  await query(
    `UPDATE "connectedAccounts"
     SET "onboardingStatus" = $1,
         "chargesEnabled" = $2,
         "payoutsEnabled" = $3,
         "updatedAt" = NOW()
     WHERE "externalAccountId" = $4`,
    [onboardingStatus, account.charges_enabled, account.payouts_enabled, account.id]
  )

  console.log(`[stripe-connect-webhook] Account ${account.id} updated: status=${onboardingStatus}, charges=${account.charges_enabled}`)
}

async function handlePaymentSucceeded(
  pi: Stripe.PaymentIntent,
  connectedAccountId: string,
  extensions?: StripeConnectWebhookExtensions
) {
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id

  await query(
    `UPDATE "marketplacePayments"
     SET status = 'succeeded',
         "externalChargeId" = $1,
         "paidAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "externalPaymentId" = $2`,
    [chargeId || null, pi.id]
  )

  console.log(`[stripe-connect-webhook] Payment ${pi.id} succeeded for account ${connectedAccountId}`)

  if (extensions?.onPaymentSucceeded) {
    await extensions.onPaymentSucceeded(pi, connectedAccountId)
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  await query(
    `UPDATE "marketplacePayments"
     SET status = 'failed',
         "statusDetail" = $1,
         "updatedAt" = NOW()
     WHERE "externalPaymentId" = $2`,
    [pi.last_payment_error?.message || 'Payment failed', pi.id]
  )

  console.log(`[stripe-connect-webhook] Payment ${pi.id} failed`)
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const refundedAmount = charge.amount_refunded
  const isFullRefund = charge.refunded

  await query(
    `UPDATE "marketplacePayments"
     SET status = $1,
         "refundedAmount" = $2,
         "updatedAt" = NOW()
     WHERE "externalChargeId" = $3`,
    [isFullRefund ? 'refunded' : 'partially_refunded', refundedAmount, charge.id]
  )

  console.log(`[stripe-connect-webhook] Charge ${charge.id} refunded: ${refundedAmount} (full=${isFullRefund})`)
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  connectedAccountId: string,
  extensions?: StripeConnectWebhookExtensions
) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id

  if (chargeId) {
    await query(
      `UPDATE "marketplacePayments"
       SET status = 'disputed',
           "statusDetail" = $1,
           "updatedAt" = NOW()
       WHERE "externalChargeId" = $2`,
      [`Dispute: ${dispute.reason}`, chargeId]
    )
  }

  console.error(`[stripe-connect-webhook] DISPUTE created for charge ${chargeId}, account ${connectedAccountId}, reason: ${dispute.reason}`)

  if (extensions?.onDisputeCreated) {
    await extensions.onDisputeCreated(dispute, connectedAccountId)
  }
}

async function handlePayoutEvent(payout: Stripe.Payout, eventType: string) {
  const status = eventType === 'payout.paid' ? 'paid' : 'failed'

  console.log(`[stripe-connect-webhook] Payout ${payout.id}: ${status}`)
  // Payout tracking can be extended with a dedicated payouts table if needed
}
