/**
 * Core Stripe Webhook Handler
 *
 * Provides handleStripeWebhook() — a reusable function that handles the full
 * Stripe subscription lifecycle. Themes/projects call this from their route file
 * and can extend it with onOneTimePaymentCompleted for their custom one-time purchases.
 *
 * Usage in route.ts:
 *   import { handleStripeWebhook } from '@nextsparkjs/core/lib/billing/stripe-webhook'
 *   export async function POST(request: NextRequest) {
 *     return handleStripeWebhook(request)
 *   }
 *
 * With theme extension:
 *   export async function POST(request: NextRequest) {
 *     return handleStripeWebhook(request, {
 *       onOneTimePaymentCompleted: async (session, { teamId, userId }) => {
 *         // theme-specific one-time payment logic
 *       }
 *     })
 *   }
 */

import { NextRequest } from 'next/server'
import { getBillingGateway } from './gateways/factory'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { query, queryOne } from '../db'
import type Stripe from 'stripe'
import type { InvoiceStatus, OneTimePaymentContext } from './types'

export type { OneTimePaymentContext }

/**
 * Provider-agnostic representation of a Stripe checkout session.
 * Avoids leaking `Stripe.Checkout.Session` SDK type to project code.
 */
export interface StripeSessionData {
  id: string
  amountTotal: number | null
  currency: string | null
  customerId: string | null
  subscriptionId: string | null
  metadata: Record<string, string>
  clientReferenceId: string | null
}

export interface StripeWebhookExtensions {
  /**
   * Called when a Stripe checkout.session.completed event fires for a session
   * that is NOT a subscription checkout (no planSlug in metadata).
   * Use this for credit packs, one-time purchases, etc.
   */
  onOneTimePaymentCompleted?: (
    session: StripeSessionData,
    context: OneTimePaymentContext
  ) => Promise<void>
}

export async function handleStripeWebhook(
  request: NextRequest,
  extensions?: StripeWebhookExtensions
): Promise<Response> {
  // 1. Get raw body and signature
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json({ error: 'No signature provided' }, { status: 400 })
  }

  // 2. Verify webhook signature (MANDATORY for security)
  // We use the factory singleton to avoid creating a new instance per request.
  // The result is cast to Stripe.Event since this is the Stripe-specific handler
  // and verifyWebhookSignature internally uses Stripe SDK's constructEvent.
  let event: Stripe.Event
  try {
    const verified = getBillingGateway().verifyWebhookSignature(payload, signature)
    // The webhook event data contains the full Stripe event structure
    event = { id: verified.id, type: verified.type, data: verified.data } as Stripe.Event
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
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, extensions)
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
 * - If session has a planSlug → subscription checkout, update subscription in DB
 * - Otherwise → one-time payment, delegate to extensions.onOneTimePaymentCompleted
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  extensions?: StripeWebhookExtensions
) {
  const teamId = session.metadata?.teamId || session.client_reference_id
  if (!teamId) {
    console.warn('[stripe-webhook] checkout.session.completed has no teamId in metadata — skipping (likely a test/synthetic event)')
    return
  }

  const planSlug = session.metadata?.planSlug
  const userId = session.metadata?.userId || 'system'

  // One-time payment (no planSlug = not a subscription checkout)
  if (!planSlug) {
    if (extensions?.onOneTimePaymentCompleted) {
      console.log(`[stripe-webhook] One-time payment for team ${teamId}, delegating to theme extension`)
      const sessionData: StripeSessionData = {
        id: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        metadata: (session.metadata ?? {}) as Record<string, string>,
        clientReferenceId: session.client_reference_id ?? null,
      }
      await extensions.onOneTimePaymentCompleted(sessionData, { teamId, userId })
    } else {
      console.log(`[stripe-webhook] One-time payment for team ${teamId} — no handler registered, skipping`)
    }
    return
  }

  // Subscription checkout
  const subscriptionId = session.subscription as string
  const customerId = session.customer as string
  const billingPeriod = session.metadata?.billingPeriod || 'monthly'

  console.log(`[stripe-webhook] Checkout completed for team ${teamId}, plan: ${planSlug}`)

  // Get plan ID from slug (CRITICAL: must update plan after checkout!)
  let planId: string | null = null
  const planResult = await queryOne<{ id: string }>(
    `SELECT id FROM plans WHERE slug = $1 LIMIT 1`,
    [planSlug]
  )
  planId = planResult?.id || null

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
    stripeEventId: session.id,
  })
}

/**
 * Handle invoice.paid
 * Subscription payment succeeded, update period dates and sync invoice
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
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
    await query(
      `UPDATE subscriptions
       SET status = 'active',
           "updatedAt" = NOW()
       WHERE "externalSubscriptionId" = $1`,
      [subscriptionId]
    )
  }

  await syncInvoiceToDatabase(invoice, 'paid')
}

/**
 * Handle invoice.payment_failed
 * Payment failed, mark subscription as past_due and sync invoice
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
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

  await syncInvoiceToDatabase(invoice, 'failed')
}

/**
 * Handle customer.subscription.updated
 * Subscription status or settings changed (including plan changes)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
    paused: 'paused',
  }

  const ourStatus = statusMap[subscription.status] || 'active'

  console.log(
    `[stripe-webhook] Subscription updated ${subscription.id}, status: ${subscription.status} -> ${ourStatus}`
  )

  // Stripe API v2026+ may not include current_period_end directly on the subscription object.
  // Handle both old and new API versions gracefully.
  const expandedSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number
    current_period_start?: number
  }

  const periodEnd = expandedSubscription.current_period_end ?? null
  const priceId = subscription.items.data[0]?.price.id

  // Build dynamic SET clause and params
  let paramIdx = 1
  const setClauses: string[] = [
    `status = $${paramIdx++}`,
    `"cancelAtPeriodEnd" = $${paramIdx++}`,
  ]
  const params: (string | number | boolean | null)[] = [
    ourStatus,
    subscription.cancel_at_period_end,
  ]

  // Only update currentPeriodEnd if available (removed in Stripe API v2026)
  if (periodEnd !== null) {
    setClauses.push(`"currentPeriodEnd" = to_timestamp($${paramIdx++})`)
    params.push(periodEnd)
  }

  setClauses.push(`"updatedAt" = NOW()`)

  if (priceId) {
    // Find plan by price ID from billing registry (providerPriceIds)
    const planConfig = BILLING_REGISTRY.plans.find(p =>
      p.providerPriceIds?.monthly === priceId || p.providerPriceIds?.yearly === priceId
    )

    if (planConfig) {
      const planResult = await queryOne<{ id: string }>(
        `SELECT id FROM plans WHERE slug = $1 LIMIT 1`,
        [planConfig.slug]
      )

      if (planResult) {
        setClauses.push(`"planId" = $${paramIdx++}`)
        params.push(planResult.id)
      }
    }
  }

  // subscriptionId is always the last param for the WHERE clause
  const subIdIdx = paramIdx++
  params.push(subscription.id)

  await query(
    `UPDATE subscriptions
     SET ${setClauses.join(', ')}
     WHERE "externalSubscriptionId" = $${subIdIdx}`,
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
      JSON.stringify({ stripeEventId: params.stripeEventId }),
    ]
  )
}

/**
 * Sync Stripe invoice to local database
 * Uses direct query (bypasses RLS) since webhooks have no user context
 */
async function syncInvoiceToDatabase(invoice: Stripe.Invoice, status: InvoiceStatus) {
  const expandedInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  const subscriptionId = typeof expandedInvoice.subscription === 'string'
    ? expandedInvoice.subscription
    : expandedInvoice.subscription?.id

  if (!subscriptionId) {
    console.warn('[stripe-webhook] Invoice has no subscription, cannot sync to invoices table')
    return
  }

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
      amountInDollars,
      invoice.currency.toUpperCase(),
      status,
      invoice.invoice_pdf || invoice.hosted_invoice_url || null,
      invoice.description || `Invoice ${invoiceNumber}`,
    ]
  )

  console.log(`[stripe-webhook] Invoice ${invoiceNumber} synced for team ${teamId} with status ${status}`)
}
