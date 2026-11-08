/**
 * The webhook entry points. Both start the same way: read the raw bytes, verify the signature, and only then look at
 * the content. There is no other way into the event processing: the apply functions are not exported.
 *
 * Idempotency: every event goes through `dedupe` (core's processWebhookEventOnce in production), which runs it at most
 * once. A Stripe event is keyed by its id. MercadoPago's body is unsigned, so its key is built from what the API
 * answered: the payment id, its status and the refunded amount. A repeated notification of the same state is a
 * duplicate, and a later change of state is new.
 */

import { majorToMinor } from '../money'
import { stripeAccountStatus, type StripeAccountFields } from '../stripe/gateway'
import type { MercadoPagoPayment } from '../mercadopago/gateway'
import type { AccountStatusResult, MarketplaceProvider, PaymentStatus, RawWebhookRequest } from '../gateway'
import { verifyMercadoPagoSignature, verifyStripeSignature, WebhookSignatureError } from './signature'

export interface StoredPayment {
  id: string
  provider: MarketplaceProvider
  accountId: string
  providerAccountId: string
  amountCents: number
  commissionCents: number
  currency: string
}

export interface WebhookStore {
  findPayment(id: string): Promise<StoredPayment | null>
  findPaymentByProviderPaymentId(provider: MarketplaceProvider, providerPaymentId: string): Promise<StoredPayment | null>
  /** Moves the payment to `status` when PAYMENT_STATUS_SOURCES allows it; `refundedCents` never goes down. */
  transitionPayment(id: string, status: PaymentStatus, fields?: { providerPaymentId?: string; refundedCents?: number }): Promise<void>
  /** Updates a seller's status, unless it disconnected. */
  updateSellerStatus(provider: MarketplaceProvider, providerAccountId: string, status: AccountStatusResult): Promise<void>
  disconnectSeller(provider: MarketplaceProvider, providerAccountId: string): Promise<void>
  getSellerAccessToken(accountId: string): Promise<string | null>
}

/** Runs `handle` at most once for the event and answers the provider. */
export type WebhookDedupe = (gateway: string, eventId: string, eventType: string, handle: () => Promise<void>) => Promise<Response>

export interface StripeWebhookDeps {
  secrets: string[]
  store: WebhookStore
  dedupe: WebhookDedupe
}

export interface MercadoPagoWebhookDeps {
  secrets: string[]
  store: WebhookStore
  dedupe: WebhookDedupe
  getPayment(paymentId: string, accessToken: string): Promise<MercadoPagoPayment>
}

const invalidSignature = () => Response.json({ error: 'Invalid signature' }, { status: 400 })
const ignored = () => Response.json({ received: true, status: 'ignored' })
const failed = () => Response.json({ error: 'Webhook processing failed' }, { status: 500 })

export async function readRawWebhook(request: Request): Promise<RawWebhookRequest> {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })
  return { rawBody: Buffer.from(await request.arrayBuffer()), headers, url: new URL(request.url) }
}

/** The error's name only: what is thrown while handling an event can quote the secret or a token. */
function logFailure(provider: string, stage: string, error: unknown): void {
  console.error(`[marketplace-payments] ${provider} webhook ${stage} failed (${error instanceof Error ? error.name : 'Error'})`)
}

/** Runs a verification: true only when it did not throw, whatever it threw. */
function passes(provider: string, verify: () => void): boolean {
  try {
    verify()
    return true
  } catch (error) {
    if (!(error instanceof WebhookSignatureError)) logFailure(provider, 'verification', error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

interface StripeEvent {
  id: string
  type: string
  account?: string
  data: { object: Record<string, any> }
}

export async function handleStripeWebhook(request: Request, deps: StripeWebhookDeps): Promise<Response> {
  const raw = await readRawWebhook(request)
  if (!passes('stripe', () => verifyStripeSignature(raw.rawBody, raw.headers['stripe-signature'], deps.secrets))) return invalidSignature()

  let event: StripeEvent
  try {
    event = JSON.parse(raw.rawBody.toString('utf8'))
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (typeof event?.id !== 'string' || typeof event?.type !== 'string' || !event.data?.object) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    return await deps.dedupe('marketplace:stripe', event.id, event.type, () => applyStripeEvent(event, deps.store))
  } catch (error) {
    logFailure('stripe', 'processing', error)
    return failed()
  }
}

async function stripePayment(store: WebhookStore, object: Record<string, any>, paymentIntent: unknown): Promise<StoredPayment | null> {
  const id = object.metadata?.marketplacePaymentId
  const byId = typeof id === 'string' ? await store.findPayment(id) : null
  if (byId) return byId.provider === 'stripe' ? byId : null
  return typeof paymentIntent === 'string' ? store.findPaymentByProviderPaymentId('stripe', paymentIntent) : null
}

async function applyStripeEvent(event: StripeEvent, store: WebhookStore): Promise<void> {
  const object = event.data.object
  switch (event.type) {
    case 'account.updated':
      return store.updateSellerStatus('stripe', object.id, stripeAccountStatus(object as StripeAccountFields))
    case 'account.application.deauthorized':
      if (event.account) await store.disconnectSeller('stripe', event.account)
      return
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (object.payment_status !== 'paid') return
      const payment = await stripePayment(store, object, null)
      if (!payment) return
      if (object.amount_total !== payment.amountCents || String(object.currency).toUpperCase() !== payment.currency.toUpperCase()) {
        console.warn(`[marketplace-payments] Stripe amount mismatch on payment ${payment.id}: not marked as paid`)
        return
      }
      return store.transitionPayment(payment.id, 'succeeded', { providerPaymentId: object.payment_intent })
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const payment = await stripePayment(store, object, null)
      if (payment) await store.transitionPayment(payment.id, event.type === 'checkout.session.expired' ? 'cancelled' : 'failed')
      return
    }
    case 'charge.refunded': {
      const payment = await stripePayment(store, object, object.payment_intent)
      if (!payment) return
      return store.transitionPayment(payment.id, object.amount_refunded >= object.amount ? 'refunded' : 'partially_refunded', { refundedCents: object.amount_refunded })
    }
    case 'charge.dispute.created': {
      const payment = await stripePayment(store, object, object.payment_intent)
      if (payment) await store.transitionPayment(payment.id, 'disputed')
      return
    }
    case 'charge.dispute.closed': {
      const payment = await stripePayment(store, object, object.payment_intent)
      if (!payment) return
      if (object.status === 'won') return store.transitionPayment(payment.id, 'succeeded')
      if (object.status === 'lost') return store.transitionPayment(payment.id, 'refunded', { refundedCents: payment.amountCents })
      return
    }
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// MercadoPago
// ---------------------------------------------------------------------------

export async function handleMercadoPagoWebhook(request: Request, deps: MercadoPagoWebhookDeps): Promise<Response> {
  const raw = await readRawWebhook(request)
  let dataId = ''
  const verified = passes('mercadopago', () => {
    dataId = verifyMercadoPagoSignature(
      { signature: raw.headers['x-signature'], requestId: raw.headers['x-request-id'], dataId: raw.url.searchParams.get('data.id') },
      deps.secrets
    )
  })
  if (!verified) return invalidSignature()

  // Only data.id is signed. `type` picks what to read, and `ref` picks whose token reads it; both can only make the
  // handler ask the API about a payment, and what the API answers is checked against our row below.
  // A seller's deauthorization is not read from these requests, because its user id would come from the unsigned
  // body: a revoked seller is found by the token refresh (invalid_grant).
  if (raw.url.searchParams.get('type') !== 'payment') return ignored()
  const ref = raw.url.searchParams.get('ref')
  if (!ref) return ignored()

  try {
    const payment = await deps.store.findPayment(ref)
    if (!payment || payment.provider !== 'mercadopago') return ignored()
    const token = await deps.store.getSellerAccessToken(payment.accountId)
    if (!token) {
      console.warn(`[marketplace-payments] MercadoPago event for payment ${payment.id} of a seller without a token`)
      return ignored()
    }

    const remote = await deps.getPayment(dataId, token)
    if (String(remote.external_reference ?? '') !== payment.id || String(remote.collector_id ?? '') !== payment.providerAccountId) {
      console.warn(`[marketplace-payments] MercadoPago payment does not belong to payment ${payment.id}: ignored`)
      return ignored()
    }

    const refunded = remote.transaction_amount_refunded ?? 0
    const eventId = `payment:${dataId}:${remote.status}:${refunded}`
    return await deps.dedupe('marketplace:mercadopago', eventId, 'payment', () => applyMercadoPagoPayment(remote, payment, dataId, deps.store))
  } catch (error) {
    logFailure('mercadopago', 'processing', error)
    return failed()
  }
}

/** The platform's fee MercadoPago recorded on the payment, in cents. */
function recordedFeeCents(remote: MercadoPagoPayment, currency: string): number {
  const fee = remote.fee_details?.find(detail => detail.type === 'application_fee')
  return fee ? majorToMinor(fee.amount, currency) : 0
}

async function applyMercadoPagoPayment(remote: MercadoPagoPayment, payment: StoredPayment, dataId: string, store: WebhookStore): Promise<void> {
  const refundedCents = majorToMinor(remote.transaction_amount_refunded ?? 0, payment.currency)
  switch (remote.status) {
    case 'approved': {
      // A seller holds a token that can create a payment with our reference: the amount and the fee must be ours.
      const amountMatches = majorToMinor(remote.transaction_amount ?? -1, payment.currency) === payment.amountCents
      const currencyMatches = String(remote.currency_id).toUpperCase() === payment.currency.toUpperCase()
      if (!amountMatches || !currencyMatches || recordedFeeCents(remote, payment.currency) !== payment.commissionCents) {
        console.warn(`[marketplace-payments] MercadoPago amount mismatch on payment ${payment.id}: not marked as paid`)
        return
      }
      if (refundedCents > 0) return store.transitionPayment(payment.id, 'partially_refunded', { providerPaymentId: dataId, refundedCents })
      return store.transitionPayment(payment.id, 'succeeded', { providerPaymentId: dataId })
    }
    case 'refunded':
      return store.transitionPayment(payment.id, 'refunded', { providerPaymentId: dataId, refundedCents: payment.amountCents })
    case 'charged_back':
    case 'in_mediation':
      return store.transitionPayment(payment.id, 'disputed', { providerPaymentId: dataId })
    case 'rejected':
      return store.transitionPayment(payment.id, 'failed', { providerPaymentId: dataId })
    case 'cancelled':
      return store.transitionPayment(payment.id, 'cancelled', { providerPaymentId: dataId })
    default:
      // pending, authorized, in_process: nothing to record yet
      return
  }
}
