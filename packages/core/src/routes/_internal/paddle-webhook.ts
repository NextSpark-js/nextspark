/**
 * Paddle Webhook Handler (#269)
 *
 * Processes Paddle Billing webhook events for the subscription lifecycle:
 * 1. Verifies Paddle-Signature (`ts=...;h1=...`: HMAC-SHA256 of `<ts>:<raw body>`, timestamp within five seconds)
 *    before parsing anything.
 * 2. Claims the event once in billing_webhook_events by Paddle's event_id, which every delivery of an event shares.
 * 3. Maps the event to the subscription row and billing_events.
 *
 * Binding to our records, never to ids from the payload alone:
 * - A subscription event updates the row whose "externalSubscriptionId" is the Paddle subscription id. Only when there
 *   is none yet (subscription.created, or another event that arrived before it), and only for a subscription with a
 *   plan's price, it binds to the team named in the custom data when the team token is valid for that team and price
 *   (lib/billing/paddle-webhook.ts): to the row subscription-binding.ts picks for the team. An event older than the
 *   last one applied to an ended row binds nothing. A canceled subscription still binds: its cancel may arrive before
 *   its created, and the created that follows is then refused as older.
 * - A transaction event (a payment) is recorded on the row of its subscription_id. Before the subscription is bound,
 *   or for a one-time purchase, a verified team's payment is recorded on the team's row without changing it.
 * - An event older than the one last applied to a row (occurred_at) does not move it back: Paddle does not guarantee
 *   the order of delivery.
 * Events that look like ours (a team id in the custom data) but cannot be applied are logged as errors.
 *
 * Sandbox and live are separate Paddle accounts, each with its own notification destination secret. A deployment
 * verifies with the secret of its PADDLE_ENVIRONMENT only, so an event of the other environment fails the signature.
 *
 * Like the Stripe and Polar handlers it uses direct query() calls on the service connection: webhooks have no user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@nextsparkjs/core/lib/db'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { builtInWebhookRouteClosed } from '@nextsparkjs/core/lib/billing/provider-mode'
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'
import { processWebhookEventOnce, webhookOutcomeResponse } from '@nextsparkjs/core/lib/billing/webhook-events'
import { isValidPaddleTeamToken, paddleTeamTokenSecret } from '@nextsparkjs/core/lib/billing/paddle-webhook'
import { subscriptionRowForNewSubscription } from '@nextsparkjs/core/lib/billing/subscription-binding'

type Entity = Record<string, unknown> & { id: string }

interface PaddleEvent {
  id: string
  name: string
  occurredAt: string
  data: Entity
  custom: Record<string, string>
}

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.canceled',
  'subscription.paused', 'subscription.resumed', 'subscription.past_due', 'subscription.trialing',
])
const TRANSACTION_EVENTS = new Set(['transaction.completed', 'transaction.paid', 'transaction.payment_failed'])

/** The Paddle webhook Route Handler, before rate limiting. */
export function createPaddleWebhookHandler() {
  return (request: NextRequest) => handlePaddleWebhook(request)
}

async function handlePaddleWebhook(request: NextRequest): Promise<NextResponse> {
  // Provider 'none', a custom gateway, or a built-in name a registered gateway replaces: this route is closed
  if (builtInWebhookRouteClosed('paddle')) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 1. The raw bytes: the signature is over the body exactly as sent
  const payload = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('paddle-signature')
  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
  }

  // 2. Verify the signature and its timestamp (MANDATORY), then parse
  let event: PaddleEvent
  try {
    const gateway = await getBillingGateway()
    const verified = gateway.verifyWebhookSignature(payload, signature)
    const body = verified.data as { occurred_at?: unknown; data: Entity }
    const data = body.data
    event = { id: verified.id, name: verified.type, occurredAt: String(body.occurred_at ?? ''), data, custom: stringValues(data.custom_data) }
  } catch (error) {
    console.error('[paddle-webhook] Signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // An event this handler applies needs its entity id and occurred_at to be bound and ordered. 400, so the delivery
  // shows as failed in Paddle's notification log, and nothing is claimed.
  const handled = SUBSCRIPTION_EVENTS.has(event.name) || TRANSACTION_EVENTS.has(event.name)
  if (handled && (!idOrNull(event.data.id) || Number.isNaN(Date.parse(event.occurredAt)))) {
    console.error(`[paddle-webhook] Event ${event.id} (${event.name}) has no data.id or occurred_at, refused`)
    return NextResponse.json({ error: 'Event has no data.id or occurred_at' }, { status: 400 })
  }

  // 3. Claim the event and handle it once (see lib/billing/webhook-events.ts)
  try {
    const outcome = await processWebhookEventOnce('paddle', event.id, event.name, () => handleEvent(event))
    if (outcome !== 'processed') console.log(`[paddle-webhook] Event ${event.id}: ${outcome}, skipping`)
    return webhookOutcomeResponse(outcome) as NextResponse
  } catch (error) {
    console.error('[paddle-webhook] Handler error:', error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}

async function handleEvent(event: PaddleEvent) {
  console.log(`[paddle-webhook] Processing event type: ${event.name}`)
  if (SUBSCRIPTION_EVENTS.has(event.name)) await handleSubscriptionEvent(event)
  else if (TRANSACTION_EVENTS.has(event.name)) await handleTransactionEvent(event)
  else console.log(`[paddle-webhook] Unhandled event type: ${event.name}`)
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

interface SubscriptionRow {
  id: string
  teamId: string
}

/** Every subscription event carries the whole subscription entity: the row is set from its current state. */
async function handleSubscriptionEvent(event: PaddleEvent) {
  const subscription = event.data
  const row = await subscriptionRowFor(event, subscription.id)
  if (!row) return

  const status = mapStatus(String(subscription.status))
  const scheduled = subscription.scheduled_change as { action?: string } | null | undefined
  const cancelAtPeriodEnd = scheduled?.action === 'cancel' && status !== 'canceled'
  const period = subscription.current_billing_period as { starts_at?: unknown; ends_at?: unknown } | null | undefined
  const plan = planForPrice(planPriceOf(subscription))
  const planId = plan
    ? (await queryOne<{ id: string }>(`SELECT id FROM plans WHERE slug = $1 LIMIT 1`, [plan.slug]))?.id ?? null
    : null
  if (!planId) console.warn(`[paddle-webhook] Subscription ${subscription.id} has no plan's price in the database, keeping the current plan`)

  // The occurred_at guard is in the UPDATE: it compares with microseconds, and holds against the row as locked.
  const updated = await query(
    `UPDATE subscriptions
     SET "externalSubscriptionId" = $1,
         "externalCustomerId" = COALESCE($2, "externalCustomerId"),
         "paymentProvider" = 'paddle',
         status = $3,
         "cancelAtPeriodEnd" = $4,
         "canceledAt" = CASE WHEN $3 = 'canceled' THEN COALESCE($5::timestamptz, "canceledAt", NOW())
                             WHEN $4 THEN COALESCE("canceledAt", NOW())
                             ELSE NULL END,
         "currentPeriodStart" = COALESCE($6::timestamptz, "currentPeriodStart"),
         "currentPeriodEnd" = COALESCE($7::timestamptz, "currentPeriodEnd"),
         "trialEndsAt" = CASE WHEN $3 = 'trialing' THEN COALESCE($8::timestamptz, $7::timestamptz) ELSE "trialEndsAt" END,
         "planId" = COALESCE($9, "planId"),
         "billingInterval" = COALESCE($10, "billingInterval"),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('paddleOccurredAt', $11::text),
         "updatedAt" = NOW()
     WHERE id = $12
       AND NOT ("paymentProvider" IS NOT DISTINCT FROM 'paddle' AND "externalSubscriptionId" IS NOT DISTINCT FROM $1
                AND COALESCE((metadata->>'paddleOccurredAt')::timestamptz > $11::timestamptz, false))`,
    [
      subscription.id,
      idOrNull(subscription.customer_id),
      status,
      cancelAtPeriodEnd,
      stringOrNull(subscription.canceled_at),
      stringOrNull(period?.starts_at),
      stringOrNull(period?.ends_at),
      trialEndOf(subscription),
      planId,
      plan?.interval ?? null,
      event.occurredAt,
      row.id,
    ]
  )
  if (updated.rowCount === 0) {
    console.log(`[paddle-webhook] Event ${event.id} is older than the subscription's last applied event, ignoring`)
    return
  }

  if (event.name !== 'subscription.updated') {
    await logBillingEvent(row.id, 'lifecycle', 'succeeded', 0, currencyOf(subscription.currency_code), {
      event: event.name,
      paddleEventId: event.id,
      paddleSubscriptionId: subscription.id,
    })
  }
  console.log(`[paddle-webhook] Subscription ${subscription.id} of team ${row.teamId}: ${subscription.status} -> ${status}`)
}

/** The row bound to Paddle subscription `externalId`, locked; null when none is. */
async function boundRow(externalId: string): Promise<SubscriptionRow | null> {
  return queryOne<SubscriptionRow>(
    `SELECT id, "teamId" FROM subscriptions
     WHERE "paymentProvider" = 'paddle' AND "externalSubscriptionId" = $1
     ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
    [externalId]
  )
}

/**
 * The subscription row an event about Paddle subscription `externalId` applies to, locked for the update: the row
 * already bound to it; or else, for a subscription with a plan's price and a team token valid for that team and price,
 * the row subscription-binding.ts picks for the team. Null (and a log line) when there is none.
 */
async function subscriptionRowFor(event: PaddleEvent, externalId: string): Promise<SubscriptionRow | null> {
  const claimed = event.custom.teamId
  const bound = await boundRow(externalId)
  if (bound) {
    if (claimed && claimed !== bound.teamId) {
      console.warn(`[paddle-webhook] Event ${event.id}: the custom data names another team than the subscription's, ignoring`)
      return null
    }
    return bound
  }

  const planPrice = planPriceOf(event.data)
  if (!planPrice) {
    // a subscription with no plan's price (a recurring add-on, another product) never takes over a team's row
    const log = claimed ? console.error : console.warn
    log(`[paddle-webhook] Event ${event.id}: subscription ${externalId} has no plan's price; not applied`)
    return null
  }
  const teamId = verifiedTeamId(event, [planPrice])
  if (!teamId) {
    if (claimed) {
      console.error(`[paddle-webhook] Event ${event.id}: subscription ${externalId} names team ${claimed} without a valid team token; not applied`)
    } else {
      console.warn(`[paddle-webhook] Event ${event.id}: subscription ${externalId} is not ours and has no verified team, ignoring`)
    }
    return null
  }
  return subscriptionRowForNewSubscription(teamId, {
    gateway: 'paddle',
    eventId: event.id,
    bind: { provider: 'paddle', externalSubscriptionId: externalId },
    // a late event of an older subscription does not reactivate a row a newer one has bound and ended
    notOlderThan: { at: event.occurredAt, metadataKey: 'paddleOccurredAt' },
  })
}

// ===========================================
// PAYMENTS (transactions)
// ===========================================

/**
 * transaction.paid and transaction.completed both report one captured payment: it is recorded once per transaction.
 * transaction.payment_failed records each failed attempt. The subscription's status is left to the subscription
 * events (subscription.past_due, .updated), which Paddle sends with every status change.
 */
async function handleTransactionEvent(event: PaddleEvent) {
  const transaction = event.data
  const externalId = idOrNull(transaction.subscription_id)
  const succeeded = event.name !== 'transaction.payment_failed'
  const totals = (transaction.details as { totals?: { grand_total?: unknown } } | undefined)?.totals
  const record = async (subscriptionId: string, unbound: boolean) => {
    if (succeeded) {
      // paid and completed may arrive together: both lock the same row first (boundRow or the binding helper, FOR
      // UPDATE), so the second one runs this SELECT after the first committed and sees its row
      const recorded = await queryOne<{ id: string }>(
        `SELECT id FROM "billing_events" WHERE type = 'payment' AND status = 'succeeded' AND "externalPaymentId" = $1 LIMIT 1`,
        [transaction.id]
      )
      if (recorded) {
        console.log(`[paddle-webhook] Payment of transaction ${transaction.id} already recorded`)
        return
      }
    }
    await logBillingEvent(
      subscriptionId,
      'payment',
      succeeded ? 'succeeded' : 'failed',
      cents(totals?.grand_total),
      currencyOf(transaction.currency_code),
      {
        paddleEventId: event.id,
        origin: transaction.origin ?? null,
        invoiceNumber: transaction.invoice_number ?? null,
        ...(unbound && { paddleSubscriptionId: externalId }),
      },
      transaction.id
    )
    console.log(`[paddle-webhook] Payment ${succeeded ? 'succeeded' : 'failed'} for transaction ${transaction.id}`)
  }

  const row = externalId ? await boundRow(externalId) : null
  if (row) {
    if (event.custom.teamId && event.custom.teamId !== row.teamId) {
      console.warn(`[paddle-webhook] Event ${event.id}: the custom data names another team than the subscription's, ignoring`)
      return
    }
    await record(row.id, false)
    return
  }

  // The first payment can arrive before subscription.created binds the subscription, and a one-time purchase has no
  // subscription. The token is checked against the transaction's plan price, or its prices when it has none; the
  // payment is recorded on the team's row, and the row itself is left to the subscription events.
  const planPrice = planPriceOf(transaction)
  const teamId = verifiedTeamId(event, planPrice ? [planPrice] : itemPriceIds(transaction))
  if (!teamId) {
    const log = event.custom.teamId ? console.error : console.warn
    log(`[paddle-webhook] Event ${event.id}: transaction ${transaction.id} is not ours and has no verified team, ignoring`)
    return
  }
  const teamRow = await subscriptionRowForNewSubscription(teamId, { gateway: 'paddle', eventId: event.id })
  if (!teamRow) return
  await record(teamRow.id, true)
}

// ===========================================
// HELPERS
// ===========================================

/** Paddle subscription status -> ours. A scheduled cancellation keeps the status (active) until it takes effect. */
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    paused: 'paused',
    canceled: 'canceled',
  }
  return statusMap[status] ?? 'active'
}

function itemPriceIds(entity: Entity): string[] {
  return ((entity.items ?? []) as { price?: { id?: unknown }; price_id?: unknown }[])
    .map(item => idOrNull(item.price?.id ?? item.price_id))
    .filter((id): id is string => id !== null)
}

/** The first price of the entity's items that is a plan's, or null. */
function planPriceOf(entity: Entity): string | null {
  return itemPriceIds(entity).find(priceId => planForPrice(priceId) !== null) ?? null
}

/** The plan and interval whose providerPriceIds hold this price id. */
function planForPrice(priceId: string | null): { slug: string; interval: 'monthly' | 'yearly' } | null {
  if (!priceId) return null
  for (const plan of BILLING_REGISTRY.plans) {
    if (plan.providerPriceIds?.monthly === priceId) return { slug: plan.slug, interval: 'monthly' }
    if (plan.providerPriceIds?.yearly === priceId) return { slug: plan.slug, interval: 'yearly' }
  }
  return null
}

/** The end of the trial of the subscription's plan item, when it has trial dates. */
function trialEndOf(subscription: Entity): string | null {
  const items = (subscription.items ?? []) as { price?: { id?: unknown }; trial_dates?: { ends_at?: unknown } | null }[]
  const planPrice = planPriceOf(subscription)
  const item = items.find(entry => idOrNull(entry.price?.id) === planPrice) ?? items[0]
  return stringOrNull(item?.trial_dates?.ends_at)
}

/**
 * The custom data's teamId when its team token is valid for that team and one of `priceIds`, else null. A token that
 * is present but does not match is logged as an error: hand-written custom data, or a token secret that changed after
 * the checkout opened.
 */
function verifiedTeamId(event: PaddleEvent, priceIds: string[]): string | null {
  const { teamId, teamToken } = event.custom
  const secret = paddleTeamTokenSecret()
  if (!teamId || !teamToken || !secret) return null
  if (isValidPaddleTeamToken(teamId, priceIds, teamToken, secret)) return teamId
  console.error(`[paddle-webhook] Event ${event.id}: the team token of team ${teamId} does not match`)
  return null
}

async function logBillingEvent(
  subscriptionId: string,
  type: 'payment' | 'lifecycle',
  status: 'succeeded' | 'failed',
  amount: number,
  currency: string,
  metadata: Record<string, unknown>,
  externalPaymentId: string | null = null
) {
  await query(
    `INSERT INTO "billing_events" ("subscriptionId", type, status, amount, currency, "externalPaymentId", metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [subscriptionId, type, status, amount, currency, externalPaymentId, JSON.stringify(metadata)]
  )
}

/** Custom data values as strings; objects are dropped. */
function stringValues(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!value || typeof value !== 'object') return result
  for (const [key, item] of Object.entries(value)) {
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

/** Paddle amounts are strings in the currency's lowest unit. */
function cents(value: unknown): number {
  const amount = Math.round(Number(value))
  return Number.isFinite(amount) ? amount : 0
}

function currencyOf(value: unknown): string {
  return typeof value === 'string' && value ? value.toLowerCase() : 'usd'
}
