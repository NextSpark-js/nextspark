/**
 * Lemon Squeezy Webhook Handler (#268)
 *
 * Processes Lemon Squeezy webhook events for the subscription lifecycle:
 * 1. Verifies X-Signature (hex HMAC-SHA256 of the raw body) before parsing anything.
 * 2. Claims the event once in billing_webhook_events. Lemon Squeezy sends no event id, so the id is derived from
 *    (event_name, data.type, data.id, data.attributes.updated_at): see lemonSqueezyEventId in the gateway.
 * 3. Maps the event to the subscription row and billing_events.
 *
 * Binding to our records, never to ids from the payload alone:
 * - A subscription event updates the row whose "externalSubscriptionId" is the Lemon Squeezy subscription id. Only
 *   when there is none yet (subscription_created, or an event that arrived before it) it binds to the team named in
 *   the custom data, and only when the custom data's team token is valid (lemonsqueezy-webhook.ts) and the team's
 *   current subscription row is not bound to another Lemon Squeezy subscription.
 * - A payment event updates the row of its subscription_id; one-time orders need a valid team token.
 * - Events of another store (data.attributes.store_id is not LEMONSQUEEZY_STORE_ID) are ignored.
 * - An older event than the one last applied to a row (data.attributes.updated_at) does not move it back.
 *
 * Like the Stripe and Polar handlers it uses direct query() calls on the service connection: webhooks have no user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { processWebhookEventOnce, webhookOutcomeResponse } from '@nextsparkjs/core/lib/billing/webhook-events'
import { isValidLemonSqueezyTeamToken, type LemonSqueezyWebhookExtensions } from '@nextsparkjs/core/lib/billing/lemonsqueezy-webhook'

/** Loads a project's Lemon Squeezy webhook extensions; core's route passes none. */
export type LemonSqueezyWebhookExtensionsLoader = () => Promise<LemonSqueezyWebhookExtensions>

const noExtensions: LemonSqueezyWebhookExtensionsLoader = async () => ({})

interface Resource {
  type: string
  id: string
  attributes: Record<string, unknown>
}

interface LemonSqueezyEvent {
  id: string
  name: string
  data: Resource
  custom: Record<string, string>
}

/** Thrown for an event that is ours but arrived before the event that creates its row: answer 500 so it is retried. */
class RetryLater extends Error {}

/**
 * The Lemon Squeezy webhook Route Handler, before rate limiting. The project hook for one-time orders
 * (`extensions.onOneTimePaymentCompleted`) comes from `loadExtensions`, called only for those orders.
 */
export function createLemonSqueezyWebhookHandler(loadExtensions: LemonSqueezyWebhookExtensionsLoader = noExtensions) {
  return (request: NextRequest) => handleLemonSqueezyWebhook(request, loadExtensions)
}

async function handleLemonSqueezyWebhook(request: NextRequest, loadExtensions: LemonSqueezyWebhookExtensionsLoader): Promise<NextResponse> {
  // 1. The raw bytes: the signature is over the body exactly as sent
  const payload = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-signature')
  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
  }

  // 2. Verify the signature (MANDATORY), then parse
  let event: LemonSqueezyEvent
  try {
    const gateway = await getBillingGateway()
    const verified = gateway.verifyWebhookSignature(payload, signature)
    const body = verified.data as { meta?: { custom_data?: Record<string, unknown> }; data: Resource }
    event = { id: verified.id, name: verified.type, data: body.data, custom: stringValues(body.meta?.custom_data) }
  } catch (error) {
    console.error('[lemonsqueezy-webhook] Signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 3. Claim the event and handle it once (see lib/billing/webhook-events.ts)
  try {
    const outcome = await processWebhookEventOnce('lemonsqueezy', event.id, event.name, () => handleEvent(event, loadExtensions))
    if (outcome !== 'processed') console.log(`[lemonsqueezy-webhook] Event ${event.id}: ${outcome}, skipping`)
    return webhookOutcomeResponse(outcome) as NextResponse
  } catch (error) {
    console.error('[lemonsqueezy-webhook] Handler error:', error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}

async function handleEvent(event: LemonSqueezyEvent, loadExtensions: LemonSqueezyWebhookExtensionsLoader) {
  console.log(`[lemonsqueezy-webhook] Processing event type: ${event.name}`)

  const storeId = event.data.attributes.store_id
  if (storeId !== undefined && storeId !== null && String(storeId) !== process.env.LEMONSQUEEZY_STORE_ID?.trim()) {
    console.warn(`[lemonsqueezy-webhook] Event ${event.id} is for another store, ignoring`)
    return
  }

  switch (event.name) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_cancelled':
    case 'subscription_resumed':
    case 'subscription_expired':
    case 'subscription_paused':
    case 'subscription_unpaused':
      await handleSubscriptionEvent(event)
      break

    case 'subscription_payment_success':
    case 'subscription_payment_failed':
      await handlePaymentEvent(event)
      break

    case 'order_created':
      await handleOrderCreated(event, loadExtensions)
      break

    default:
      console.log(`[lemonsqueezy-webhook] Unhandled event type: ${event.name}`)
  }
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

interface SubscriptionRow {
  id: string
  teamId: string
  paymentProvider: string | null
  externalSubscriptionId: string | null
  syncedAt: string | null
}

const ROW_COLUMNS = `id, "teamId", "paymentProvider", "externalSubscriptionId", metadata->>'lemonSqueezyUpdatedAt' AS "syncedAt"`

/** Lifecycle events logged to billing_events; subscription_updated carries the same changes and is not logged. */
const LIFECYCLE_EVENTS = new Set([
  'subscription_created', 'subscription_cancelled', 'subscription_resumed', 'subscription_expired',
  'subscription_paused', 'subscription_unpaused',
])

/** Every subscription event carries the whole subscription object: the row is set from its current attributes. */
async function handleSubscriptionEvent(event: LemonSqueezyEvent) {
  const subscription = event.data
  const attributes = subscription.attributes
  const row = await subscriptionRowFor(event, subscription.id)
  if (!row) return

  const updatedAt = typeof attributes.updated_at === 'string' ? attributes.updated_at : null
  if (updatedAt && row.syncedAt && Date.parse(updatedAt) < Date.parse(row.syncedAt)) {
    console.log(`[lemonsqueezy-webhook] Event ${event.id} is older than the subscription's last update, ignoring`)
    return
  }

  const status = mapStatus(String(attributes.status))
  const cancelled = attributes.cancelled === true
  const plan = planForVariant(attributes.variant_id)
  const planId = plan
    ? (await queryOne<{ id: string }>(`SELECT id FROM plans WHERE slug = $1 LIMIT 1`, [plan.slug]))?.id ?? null
    : null
  if (!planId) console.warn(`[lemonsqueezy-webhook] Variant ${attributes.variant_id} is not a plan's variant in the database, keeping the current plan`)

  await query(
    `UPDATE subscriptions
     SET "externalSubscriptionId" = $1,
         "externalCustomerId" = COALESCE($2, "externalCustomerId"),
         "paymentProvider" = 'lemonsqueezy',
         status = $3,
         "cancelAtPeriodEnd" = $4,
         "canceledAt" = CASE WHEN $5 THEN COALESCE("canceledAt", NOW()) ELSE NULL END,
         "currentPeriodEnd" = COALESCE($6::timestamptz, "currentPeriodEnd"),
         "trialEndsAt" = $7::timestamptz,
         "planId" = COALESCE($8, "planId"),
         "billingInterval" = COALESCE($9, "billingInterval"),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lemonSqueezyUpdatedAt', $10::text),
         "updatedAt" = NOW()
     WHERE id = $11`,
    [
      subscription.id,
      idOrNull(attributes.customer_id),
      status,
      // a cancelled subscription runs until ends_at: a cancellation at period end; once expired it is over
      cancelled && status !== 'expired',
      cancelled || status === 'expired',
      stringOrNull(attributes.ends_at) ?? stringOrNull(attributes.renews_at),
      stringOrNull(attributes.trial_ends_at),
      planId,
      plan?.interval ?? null,
      updatedAt,
      row.id,
    ]
  )

  if (LIFECYCLE_EVENTS.has(event.name)) {
    await logBillingEvent(row.id, 'lifecycle', 'succeeded', 0, 'usd', {
      event: event.name,
      lemonSqueezyEventId: event.id,
      lemonSqueezySubscriptionId: subscription.id,
    })
  }
  console.log(`[lemonsqueezy-webhook] Subscription ${subscription.id} of team ${row.teamId}: ${attributes.status} -> ${status}`)
}

/**
 * The subscription row an event about Lemon Squeezy subscription `externalId` applies to, locked for the update:
 * the row already bound to it, or else the current row of the team in the custom data, when its token is valid and
 * that row is not bound to another Lemon Squeezy subscription. Null (and a warning) when there is none.
 */
async function subscriptionRowFor(event: LemonSqueezyEvent, externalId: string): Promise<SubscriptionRow | null> {
  const claimed = event.custom.teamId
  const bound = await queryOne<SubscriptionRow>(
    `SELECT ${ROW_COLUMNS} FROM subscriptions
     WHERE "paymentProvider" = 'lemonsqueezy' AND "externalSubscriptionId" = $1
     ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
    [externalId]
  )
  if (bound) {
    if (claimed && claimed !== bound.teamId) {
      console.warn(`[lemonsqueezy-webhook] Event ${event.id}: the custom data names another team than the subscription's, ignoring`)
      return null
    }
    return bound
  }

  const teamId = verifiedTeamId(event)
  if (!teamId) {
    console.warn(`[lemonsqueezy-webhook] Event ${event.id}: subscription ${externalId} is not ours and has no verified team, ignoring`)
    return null
  }
  const current = await queryOne<SubscriptionRow>(
    `SELECT ${ROW_COLUMNS} FROM subscriptions
     WHERE "teamId" = $1 AND status IN ('active', 'trialing', 'past_due')
     LIMIT 1 FOR UPDATE`,
    [teamId]
  )
  if (!current) {
    console.warn(`[lemonsqueezy-webhook] Event ${event.id}: team ${teamId} has no current subscription row, ignoring`)
    return null
  }
  if (current.paymentProvider === 'lemonsqueezy' && current.externalSubscriptionId && current.externalSubscriptionId !== externalId) {
    console.warn(`[lemonsqueezy-webhook] Event ${event.id}: team ${teamId} already has Lemon Squeezy subscription ${current.externalSubscriptionId}, not binding ${externalId}`)
    return null
  }
  // a row that tracked another subscription starts over: an older event of the new one may arrive later
  return { ...current, syncedAt: current.externalSubscriptionId === externalId ? current.syncedAt : null }
}

// ===========================================
// PAYMENTS (subscription invoices)
// ===========================================

async function handlePaymentEvent(event: LemonSqueezyEvent) {
  const invoice = event.data
  const attributes = invoice.attributes
  const externalId = idOrNull(attributes.subscription_id)
  const row = externalId
    ? await queryOne<SubscriptionRow>(
        `SELECT ${ROW_COLUMNS} FROM subscriptions
         WHERE "paymentProvider" = 'lemonsqueezy' AND "externalSubscriptionId" = $1
         ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
        [externalId]
      )
    : null

  if (!row) {
    // the first payment can arrive before subscription_created bound the row: a verified team means it is ours
    if (verifiedTeamId(event)) throw new RetryLater(`subscription ${externalId} is not bound yet; retrying ${event.name} later`)
    console.warn(`[lemonsqueezy-webhook] Event ${event.id}: subscription ${externalId} is not ours, ignoring`)
    return
  }
  if (event.custom.teamId && event.custom.teamId !== row.teamId) {
    console.warn(`[lemonsqueezy-webhook] Event ${event.id}: the custom data names another team than the subscription's, ignoring`)
    return
  }

  const succeeded = event.name === 'subscription_payment_success'
  if (succeeded) {
    await query(`UPDATE subscriptions SET status = 'active', "updatedAt" = NOW() WHERE id = $1 AND status = 'past_due'`, [row.id])
  } else {
    await query(`UPDATE subscriptions SET status = 'past_due', "updatedAt" = NOW() WHERE id = $1 AND status IN ('active', 'trialing')`, [row.id])
  }

  const urls = attributes.urls as { invoice_url?: string | null } | undefined
  await logBillingEvent(
    row.id,
    'payment',
    succeeded ? 'succeeded' : 'failed',
    cents(attributes.total),
    currencyOf(attributes.currency),
    { lemonSqueezyEventId: event.id, billingReason: attributes.billing_reason ?? null },
    invoice.id,
    urls?.invoice_url ?? null
  )
  console.log(`[lemonsqueezy-webhook] Payment ${succeeded ? 'succeeded' : 'failed'} for subscription ${externalId}`)
}

// ===========================================
// ORDERS
// ===========================================

/**
 * order_created: a plan's order is handled by the subscription events Lemon Squeezy sends with it. Any other paid
 * order is a one-time purchase: logged for the team in its verified custom data, then handed to the project's
 * extension.
 */
async function handleOrderCreated(event: LemonSqueezyEvent, loadExtensions: LemonSqueezyWebhookExtensionsLoader) {
  const order = event.data
  const attributes = order.attributes
  const item = (attributes.first_order_item ?? {}) as Record<string, unknown>

  if (attributes.status !== 'paid') {
    console.log(`[lemonsqueezy-webhook] Order ${order.id} status: ${attributes.status}, ignoring (only paid orders)`)
    return
  }
  if (planForVariant(item.variant_id)) {
    console.log(`[lemonsqueezy-webhook] Order ${order.id} is a plan's order, handled by its subscription events`)
    return
  }

  const teamId = verifiedTeamId(event)
  const team = teamId ? await queryOne<{ id: string }>(`SELECT id FROM teams WHERE id = $1`, [teamId]) : null
  if (!teamId || !team) {
    console.warn(`[lemonsqueezy-webhook] One-time order ${order.id} has no verified team of ours, ignoring`)
    return
  }

  const total = cents(attributes.total)
  const currency = currencyOf(attributes.currency)
  const sub = await queryOne<{ id: string }>(
    `SELECT id FROM subscriptions WHERE "teamId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [teamId]
  )
  if (sub) {
    await logBillingEvent(sub.id, 'payment', 'succeeded', total, currency, { lemonSqueezyEventId: event.id, oneTime: true }, order.id)
  } else {
    console.warn(`[lemonsqueezy-webhook] One-time order ${order.id}: team ${teamId} has no subscription row, billing event skipped`)
  }

  const extensions = await loadExtensions()
  if (extensions.onOneTimePaymentCompleted) {
    await extensions.onOneTimePaymentCompleted(
      {
        id: order.id,
        identifier: stringOrNull(attributes.identifier),
        total,
        currency,
        metadata: event.custom,
        customerId: idOrNull(attributes.customer_id),
        productId: idOrNull(item.product_id),
        variantId: idOrNull(item.variant_id),
      },
      { teamId, userId: event.custom.userId ?? '' }
    )
  } else {
    console.log(`[lemonsqueezy-webhook] One-time order ${order.id}: no extension handler configured`)
  }
}

// ===========================================
// HELPERS
// ===========================================

/** Lemon Squeezy subscription status -> ours. A cancelled subscription keeps access until ends_at. */
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    on_trial: 'trialing',
    active: 'active',
    paused: 'paused',
    past_due: 'past_due',
    unpaid: 'past_due',
    cancelled: 'active',
    expired: 'expired',
  }
  return statusMap[status] ?? 'active'
}

/** The plan and interval whose providerPriceIds hold this variant id. */
function planForVariant(variantId: unknown): { slug: string; interval: 'monthly' | 'yearly' } | null {
  const id = idOrNull(variantId)
  if (!id) return null
  for (const plan of BILLING_REGISTRY.plans) {
    if (plan.providerPriceIds?.monthly === id) return { slug: plan.slug, interval: 'monthly' }
    if (plan.providerPriceIds?.yearly === id) return { slug: plan.slug, interval: 'yearly' }
  }
  return null
}

/** The custom data's teamId when its team token is valid, else null. */
function verifiedTeamId(event: LemonSqueezyEvent): string | null {
  const { teamId, teamToken } = event.custom
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
  if (!teamId || !secret) return null
  if (isValidLemonSqueezyTeamToken(teamId, teamToken, secret)) return teamId
  console.warn(`[lemonsqueezy-webhook] Event ${event.id}: the custom data's team token is missing or invalid`)
  return null
}

async function logBillingEvent(
  subscriptionId: string,
  type: 'payment' | 'lifecycle',
  status: 'succeeded' | 'failed',
  amount: number,
  currency: string,
  metadata: Record<string, unknown>,
  externalPaymentId: string | null = null,
  invoiceUrl: string | null = null
) {
  await query(
    `INSERT INTO "billing_events" ("subscriptionId", type, status, amount, currency, "externalPaymentId", "invoiceUrl", metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [subscriptionId, type, status, amount, currency, externalPaymentId, invoiceUrl, JSON.stringify(metadata)]
  )
}

/** Custom data values as strings (Lemon Squeezy may return numbers); objects are dropped. */
function stringValues(value: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value ?? {})) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') result[key] = String(item)
  }
  return result
}

function idOrNull(value: unknown): string | null {
  return typeof value === 'number' || (typeof value === 'string' && value !== '') ? String(value) : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function cents(value: unknown): number {
  const amount = Math.round(Number(value))
  return Number.isFinite(amount) ? amount : 0
}

function currencyOf(value: unknown): string {
  return typeof value === 'string' && value ? value.toLowerCase() : 'usd'
}
