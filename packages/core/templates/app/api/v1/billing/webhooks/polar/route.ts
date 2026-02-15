/**
 * Polar.sh Webhook Handler
 *
 * Processes Polar webhook events for subscription lifecycle management.
 * CRITICAL: Verifies webhook signatures using ALL request headers.
 *
 * Polar event types:
 * - checkout.created / checkout.updated
 * - subscription.created / subscription.updated / subscription.canceled
 * - order.created / order.paid
 *
 * NOTE: This handler uses direct query() calls (bypassing RLS) because:
 * 1. Webhooks have no user context (no session, no auth)
 * 2. RLS policies require user membership which webhooks can't satisfy
 * 3. Webhook signature verification provides security at the API level
 */

import { NextRequest } from 'next/server'
import { query, queryOne } from '@nextsparkjs/core/lib/db'

// Polar webhook verification - import from gateway
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

export async function POST(request: NextRequest) {
  // 1. Get raw body and ALL headers (Polar needs full headers for verification)
  const payload = await request.text()
  const headers: Record<string, string> = {}

  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  // Verify required Polar webhook headers
  if (!headers['webhook-id'] || !headers['webhook-signature'] || !headers['webhook-timestamp']) {
    return Response.json(
      { error: 'Missing required webhook headers (webhook-id, webhook-signature, webhook-timestamp)' },
      { status: 400 }
    )
  }

  // 2. Verify webhook signature (MANDATORY for security)
  let event: { id: string; type: string; data: Record<string, unknown> }
  try {
    const gateway = getBillingGateway()
    event = gateway.verifyWebhookSignature(payload, headers)
  } catch (error) {
    console.error('[polar-webhook] Signature verification failed:', error)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 3. Check for duplicate events (idempotency)
  const eventId = event.id || headers['webhook-id']

  const existing = await queryOne(
    `SELECT id FROM "billing_events" WHERE metadata->>'polarEventId' = $1`,
    [eventId]
  )

  if (existing) {
    console.log(`[polar-webhook] Event ${eventId} already processed, skipping`)
    return Response.json({ received: true, status: 'duplicate' })
  }

  // 4. Handle events
  try {
    console.log(`[polar-webhook] Processing event type: ${event.type}`)

    switch (event.type) {
      case 'checkout.updated':
        await handleCheckoutUpdated(event.data)
        break

      case 'subscription.created':
        await handleSubscriptionCreated(event.data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data)
        break

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data)
        break

      case 'order.paid':
        await handleOrderPaid(event.data)
        break

      default:
        console.log(`[polar-webhook] Unhandled event type: ${event.type}`)
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('[polar-webhook] Handler error:', error)
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }
}

// ===========================================
// POLAR EVENT HANDLERS
// ===========================================

/**
 * Handle checkout.updated
 * Polar fires this when a checkout session is completed (status changes to 'succeeded')
 */
async function handleCheckoutUpdated(data: Record<string, unknown>) {
  const status = data.status as string
  if (status !== 'succeeded') {
    console.log(`[polar-webhook] Checkout status: ${status}, ignoring (only process succeeded)`)
    return
  }

  const metadata = data.metadata as Record<string, string> | undefined
  const teamId = metadata?.teamId
  if (!teamId) {
    console.warn('[polar-webhook] No teamId in checkout metadata')
    return
  }

  const subscriptionId = data.subscriptionId as string | undefined
  const customerId = data.customerId as string | undefined
  const planSlug = metadata?.planSlug
  const billingPeriod = metadata?.billingPeriod || 'monthly'

  console.log(`[polar-webhook] Checkout completed for team ${teamId}, plan: ${planSlug}`)

  // Get plan ID from slug
  let planId: string | null = null
  if (planSlug) {
    const planResult = await queryOne<{ id: string }>(
      `SELECT id FROM plans WHERE slug = $1 LIMIT 1`,
      [planSlug]
    )
    planId = planResult?.id || null
  }

  if (!planId) {
    console.warn(`[polar-webhook] Plan ${planSlug} not found in database, keeping current plan`)
  }

  // Update subscription with Polar IDs
  if (planId) {
    await query(
      `UPDATE subscriptions
       SET "externalSubscriptionId" = $1,
           "externalCustomerId" = $2,
           "paymentProvider" = 'polar',
           "planId" = $3,
           "billingInterval" = $4,
           status = 'active',
           "updatedAt" = NOW()
       WHERE "teamId" = $5
         AND status IN ('active', 'trialing', 'past_due')`,
      [subscriptionId || null, customerId || null, planId, billingPeriod, teamId]
    )
  } else {
    await query(
      `UPDATE subscriptions
       SET "externalSubscriptionId" = $1,
           "externalCustomerId" = $2,
           "paymentProvider" = 'polar',
           status = 'active',
           "updatedAt" = NOW()
       WHERE "teamId" = $3
         AND status IN ('active', 'trialing', 'past_due')`,
      [subscriptionId || null, customerId || null, teamId]
    )
  }

  // Log billing event
  const amount = data.amount as number | undefined
  const currency = data.currency as string | undefined
  await logBillingEvent({
    teamId,
    type: 'payment',
    status: 'succeeded',
    amount: amount || 0,
    currency: currency || 'usd',
    polarEventId: data.id as string || 'unknown',
  })
}

/**
 * Handle subscription.created
 * New subscription was created in Polar
 */
async function handleSubscriptionCreated(data: Record<string, unknown>) {
  const polarSubId = data.id as string
  const polarCustomerId = data.customerId as string | undefined
  const status = mapPolarStatus(data.status as string)

  console.log(`[polar-webhook] Subscription created: ${polarSubId}, status: ${status}`)

  // Try to find existing subscription by customer ID
  if (polarCustomerId) {
    await query(
      `UPDATE subscriptions
       SET "externalSubscriptionId" = $1,
           status = $2,
           "paymentProvider" = 'polar',
           "updatedAt" = NOW()
       WHERE "externalCustomerId" = $3`,
      [polarSubId, status, polarCustomerId]
    )
  }
}

/**
 * Handle subscription.updated
 * Subscription status or plan changed
 */
async function handleSubscriptionUpdated(data: Record<string, unknown>) {
  const polarSubId = data.id as string
  const status = mapPolarStatus(data.status as string)
  const cancelAtPeriodEnd = (data.cancelAtPeriodEnd as boolean) ?? false

  console.log(`[polar-webhook] Subscription updated ${polarSubId}, status: ${status}`)

  // Update subscription status
  await query(
    `UPDATE subscriptions
     SET status = $1,
         "cancelAtPeriodEnd" = $2,
         "updatedAt" = NOW()
     WHERE "externalSubscriptionId" = $3`,
    [status, cancelAtPeriodEnd, polarSubId]
  )
}

/**
 * Handle subscription.canceled
 * Subscription was canceled (revoked) in Polar
 */
async function handleSubscriptionCanceled(data: Record<string, unknown>) {
  const polarSubId = data.id as string

  console.log(`[polar-webhook] Subscription canceled ${polarSubId}`)

  await query(
    `UPDATE subscriptions
     SET status = 'canceled',
         "canceledAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "externalSubscriptionId" = $1`,
    [polarSubId]
  )
}

/**
 * Handle order.paid
 * Payment was completed for an order (Polar's equivalent of invoice.paid)
 */
async function handleOrderPaid(data: Record<string, unknown>) {
  const orderId = data.id as string
  const subscriptionId = data.subscriptionId as string | undefined
  const amount = data.amount as number | undefined
  const currency = data.currency as string | undefined

  console.log(`[polar-webhook] Order paid: ${orderId}`)

  if (subscriptionId) {
    // Mark subscription as active
    await query(
      `UPDATE subscriptions
       SET status = 'active',
           "updatedAt" = NOW()
       WHERE "externalSubscriptionId" = $1`,
      [subscriptionId]
    )
  }
}

// ===========================================
// HELPERS
// ===========================================

/**
 * Map Polar subscription status to our internal status
 */
function mapPolarStatus(polarStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
    unpaid: 'past_due',
    revoked: 'canceled',
  }
  return statusMap[polarStatus] || 'active'
}

/**
 * Log billing event for audit trail
 */
async function logBillingEvent(params: {
  teamId: string
  type: string
  status: string
  amount: number
  currency: string
  polarEventId: string
}) {
  const sub = await queryOne<{ id: string }>(
    `SELECT id FROM subscriptions WHERE "teamId" = $1 LIMIT 1`,
    [params.teamId]
  )

  if (!sub) {
    console.warn(`[polar-webhook] No subscription found for team ${params.teamId}, cannot log billing event`)
    return
  }

  await query(
    `INSERT INTO "billing_events" ("subscriptionId", type, status, amount, currency, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sub.id,
      params.type,
      params.status,
      params.amount,
      params.currency,
      JSON.stringify({ polarEventId: params.polarEventId })
    ]
  )
}
