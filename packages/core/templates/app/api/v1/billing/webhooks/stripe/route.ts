/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events for subscription lifecycle management.
 * CRITICAL: Verifies webhook signatures for security.
 *
 * P2: Stripe Integration
 *
 * NOTE: This handler uses direct query() calls (bypassing RLS) because:
 * 1. Webhooks have no user context (no session, no auth)
 * 2. RLS policies require user membership which webhooks can't satisfy
 * 3. Webhook signature verification provides security at the API level
 */

import { NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@nextsparkjs/core/lib/billing/gateways/stripe'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import type Stripe from 'stripe'
import type { InvoiceStatus } from '@nextsparkjs/core/lib/billing/types'

export async function POST(request: NextRequest) {
  // 1. Get raw body and signature
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json({ error: 'No signature provided' }, { status: 400 })
  }

  // 2. Verify webhook signature (MANDATORY for security)
  let event: Stripe.Event
  try {
    event = verifyWebhookSignature(payload, signature)
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed:', error)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 3. Check for duplicate events (idempotency)
  const eventId = event.id

  const existing = await queryOne(
    `SELECT id FROM "billing_events" WHERE metadata->>'stripeEventId' = $1`,
    [eventId]
  )

  if (existing) {
    console.log(`[stripe-webhook] Event ${eventId} already processed, skipping`)
    return Response.json({ received: true, status: 'duplicate' })
  }

  // 4. Handle events
  try {
    console.log(`[stripe-webhook] Processing event type: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('[stripe-webhook] Handler error:', error)
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }
}

/**
 * Handle checkout.session.completed
 * User successfully completed checkout, create or update subscription
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.teamId || session.client_reference_id
  if (!teamId) {
    throw new Error('No team ID in checkout session')
  }

  const subscriptionId = session.subscription as string
  const customerId = session.customer as string
  const planSlug = session.metadata?.planSlug
  const billingPeriod = session.metadata?.billingPeriod || 'monthly'

  console.log(`[stripe-webhook] Checkout completed for team ${teamId}, plan: ${planSlug}`)

  // Get plan ID from slug (CRITICAL: must update plan after checkout!)
  let planId: string | null = null
  if (planSlug) {
    const planResult = await queryOne<{ id: string }>(
      `SELECT id FROM plans WHERE slug = $1 LIMIT 1`,
      [planSlug]
    )
    planId = planResult?.id || null
  }

  if (!planId) {
    console.warn(`[stripe-webhook] Plan ${planSlug} not found in database, keeping current plan`)
  }

  // Update subscription with Stripe IDs AND new plan (direct query - webhook has no user context)
  if (planId) {
    await query(
      `UPDATE subscriptions
       SET "externalSubscriptionId" = $1,
           "externalCustomerId" = $2,
           "paymentProvider" = 'stripe',
           "planId" = $3,
           "billingInterval" = $4,
           status = 'active',
           "updatedAt" = NOW()
       WHERE "teamId" = $5
         AND status IN ('active', 'trialing', 'past_due')`,
      [subscriptionId, customerId, planId, billingPeriod, teamId]
    )
  } else {
    // Fallback: update without changing plan (should not happen normally)
    await query(
      `UPDATE subscriptions
       SET "externalSubscriptionId" = $1,
           "externalCustomerId" = $2,
           "paymentProvider" = 'stripe',
           status = 'active',
           "updatedAt" = NOW()
       WHERE "teamId" = $3
         AND status IN ('active', 'trialing', 'past_due')`,
      [subscriptionId, customerId, teamId]
    )
  }

  // Log billing event
  await logBillingEvent({
    teamId,
    type: 'payment',
    status: 'succeeded',
    amount: session.amount_total || 0,
    currency: session.currency || 'usd',
    stripeEventId: session.id
  })
}

/**
 * Handle invoice.paid
 * Subscription payment succeeded, update period dates and sync invoice
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Stripe webhook expands subscription field which is not in base type
  const expandedInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  const subscriptionId = typeof expandedInvoice.subscription === 'string'
    ? expandedInvoice.subscription
    : expandedInvoice.subscription?.id

  if (!subscriptionId) {
    console.log('[stripe-webhook] Invoice has no subscription ID, skipping')
    return
  }

  console.log(`[stripe-webhook] Invoice paid for subscription ${subscriptionId}`)

  // Only update period if invoice has period info (direct query - webhook has no user context)
  if (invoice.lines?.data?.[0]) {
    const line = invoice.lines.data[0]
    await query(
      `UPDATE subscriptions
       SET status = 'active',
           "currentPeriodStart" = to_timestamp($1),
           "currentPeriodEnd" = to_timestamp($2),
           "updatedAt" = NOW()
       WHERE "externalSubscriptionId" = $3`,
      [line.period.start, line.period.end, subscriptionId]
    )
  } else {
    // Just mark as active without updating periods
    await query(
      `UPDATE subscriptions
       SET status = 'active',
           "updatedAt" = NOW()
       WHERE "externalSubscriptionId" = $1`,
      [subscriptionId]
    )
  }

  // Sync invoice to local database
  await syncInvoiceToDatabase(invoice, 'paid')
}

/**
 * Handle invoice.payment_failed
 * Payment failed, mark subscription as past_due and sync invoice
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Stripe webhook expands subscription field which is not in base type
  const expandedInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  const subscriptionId = typeof expandedInvoice.subscription === 'string'
    ? expandedInvoice.subscription
    : expandedInvoice.subscription?.id

  if (!subscriptionId) {
    console.log('[stripe-webhook] Invoice has no subscription ID, skipping')
    return
  }

  console.log(`[stripe-webhook] Payment failed for subscription ${subscriptionId}`)

  await query(
    `UPDATE subscriptions
     SET status = 'past_due',
         "updatedAt" = NOW()
     WHERE "externalSubscriptionId" = $1`,
    [subscriptionId]
  )

  // Sync invoice to local database with failed status
  await syncInvoiceToDatabase(invoice, 'failed')
}

/**
 * Handle customer.subscription.updated
 * Subscription status or settings changed (including plan changes)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
    paused: 'paused'
  }

  const ourStatus = statusMap[subscription.status] || 'active'

  console.log(
    `[stripe-webhook] Subscription updated ${subscription.id}, status: ${subscription.status} -> ${ourStatus}`
  )

  // Stripe webhook includes current_period_end which is not in base type
  const expandedSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number
    current_period_start?: number
  }

  // Check if plan changed by looking up price ID
  const priceId = subscription.items.data[0]?.price.id
  let planUpdateClause = ''
  const params: (string | number | boolean | null)[] = [
    ourStatus,
    subscription.cancel_at_period_end,
    expandedSubscription.current_period_end ?? null,
  ]

  if (priceId) {
    // Find plan by Stripe price ID (monthly or yearly)
    const planResult = await queryOne<{ id: string }>(
      `SELECT id FROM plans
       WHERE "stripePriceIdMonthly" = $1 OR "stripePriceIdYearly" = $1
       LIMIT 1`,
      [priceId]
    )

    if (planResult) {
      planUpdateClause = ', "planId" = $5'
      params.push(subscription.id, planResult.id)
    } else {
      params.push(subscription.id)
    }
  } else {
    params.push(subscription.id)
  }

  await query(
    `UPDATE subscriptions
     SET status = $1,
         "cancelAtPeriodEnd" = $2,
         "currentPeriodEnd" = to_timestamp($3),
         "updatedAt" = NOW()${planUpdateClause}
     WHERE "externalSubscriptionId" = $4`,
    params
  )
}

/**
 * Handle customer.subscription.deleted
 * Subscription was canceled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[stripe-webhook] Subscription deleted ${subscription.id}`)

  await query(
    `UPDATE subscriptions
     SET status = 'canceled',
         "canceledAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "externalSubscriptionId" = $1`,
    [subscription.id]
  )
}

/**
 * Log billing event for audit trail
 * Uses direct query (bypasses RLS) since webhooks have no user context
 */
async function logBillingEvent(params: {
  teamId: string
  type: string
  status: string
  amount: number
  currency: string
  stripeEventId: string
}) {
  // Get subscription ID (direct query - webhook has no user context)
  const sub = await queryOne<{ id: string }>(
    `SELECT id FROM subscriptions WHERE "teamId" = $1 LIMIT 1`,
    [params.teamId]
  )

  if (!sub) {
    console.warn(`[stripe-webhook] No subscription found for team ${params.teamId}, cannot log billing event`)
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
      JSON.stringify({ stripeEventId: params.stripeEventId })
    ]
  )
}

/**
 * Sync Stripe invoice to local database
 * Uses direct query (bypasses RLS) since webhooks have no user context
 */
async function syncInvoiceToDatabase(
  invoice: Stripe.Invoice,
  status: InvoiceStatus
) {
  // Stripe webhook expands subscription field which is not in base type
  const expandedInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  // Get subscription ID from invoice
  const subscriptionId = typeof expandedInvoice.subscription === 'string'
    ? expandedInvoice.subscription
    : expandedInvoice.subscription?.id

  if (!subscriptionId) {
    console.warn('[stripe-webhook] Invoice has no subscription, cannot sync to invoices table')
    return
  }

  // Find team from subscription (using direct query - no RLS needed for system operation)
  const subResult = await query<{ teamId: string }>(
    `SELECT "teamId" FROM subscriptions WHERE "externalSubscriptionId" = $1`,
    [subscriptionId]
  )

  if (!subResult.rows[0]) {
    console.warn(`[stripe-webhook] No subscription found for ${subscriptionId}, cannot sync invoice`)
    return
  }

  const teamId = subResult.rows[0].teamId
  const invoiceNumber = invoice.number || invoice.id

  // Upsert invoice (ON CONFLICT for idempotency)
  // Uses direct query to bypass RLS (webhook has no user context)
  // NOTE: invoice.total is in cents from Stripe, invoices.amount is DECIMAL(10,2) in dollars
  const amountInDollars = invoice.total / 100

  await query(
    `INSERT INTO invoices (
      id, "teamId", "invoiceNumber", date, amount, currency, status, "pdfUrl", description
    ) VALUES (
      gen_random_uuid()::text, $1, $2, to_timestamp($3), $4, $5, $6::invoice_status, $7, $8
    )
    ON CONFLICT ("teamId", "invoiceNumber") DO UPDATE SET
      status = EXCLUDED.status,
      "pdfUrl" = EXCLUDED."pdfUrl",
      "updatedAt" = NOW()`,
    [
      teamId,
      invoiceNumber,
      invoice.created,
      amountInDollars,  // Convert from cents to dollars for DECIMAL(10,2) column
      invoice.currency.toUpperCase(),
      status,
      invoice.invoice_pdf || invoice.hosted_invoice_url || null,
      invoice.description || `Invoice ${invoiceNumber}`
    ]
  )

  console.log(`[stripe-webhook] Invoice ${invoiceNumber} synced for team ${teamId} with status ${status}`)
}
