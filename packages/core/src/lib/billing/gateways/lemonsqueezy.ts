/**
 * Lemon Squeezy Payment Gateway Implementation (#268)
 *
 * Implements BillingGateway on Lemon Squeezy's REST API (JSON:API, https://api.lemonsqueezy.com/v1) with fetch: no
 * SDK, so nothing is added to a project that does not configure it (the factory imports this module only for
 * `provider: 'lemonsqueezy'`).
 *
 * Key differences from Stripe:
 * - `providerPriceIds` in billing.config.ts hold Lemon Squeezy **variant ids** (numeric strings).
 * - Checkout passes the team through `checkout_data.custom`, which Lemon Squeezy returns in every order and
 *   subscription webhook as `meta.custom_data`.
 * - Cancelling (DELETE /v1/subscriptions/:id) always keeps a grace period until `ends_at`: there is no immediate
 *   cancellation, so cancelSubscriptionImmediately throws BillingOperationNotSupportedError (400 NOT_SUPPORTED).
 * - The customer portal is a pre-signed URL (valid 24 hours) on the customer object; it takes no return URL.
 * - Webhooks are signed with X-Signature: the hex HMAC-SHA256 of the raw body with the webhook's signing secret.
 *   Deliveries carry no event id, so lemonSqueezyEventId() derives one.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { PlanService } from '../../services/plan.service'
import { lemonSqueezyTeamToken, lemonSqueezyTeamTokenSecret } from '../lemonsqueezy-webhook'
import type { BillingGateway } from './interface'
import { BillingOperationNotSupportedError } from './errors'
import type {
  CheckoutSessionResult,
  PortalSessionResult,
  SubscriptionResult,
  CustomerResult,
  WebhookEventResult,
  CreateCheckoutParams,
  CreatePortalParams,
  CreateCustomerParams,
  UpdateSubscriptionParams,
  CreateOneTimeCheckoutParams,
} from './types'

const API_URL = 'https://api.lemonsqueezy.com/v1'
const REQUEST_TIMEOUT_MS = 15_000

export interface LemonSqueezyConfig {
  apiKey: string
  storeId: string
  webhookSecret: string
  /** The key of the checkout team token: LEMONSQUEEZY_TEAM_TOKEN_SECRET, else the webhook secret */
  teamTokenSecret: string
}

/** Below this length the webhook secret only gets a warning: Lemon Squeezy accepts 6 characters. */
const RECOMMENDED_SECRET_LENGTH = 16

/**
 * The Lemon Squeezy settings from the environment. Throws one error naming every variable that is missing or
 * malformed; the error never contains a value.
 */
export function lemonSqueezyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LemonSqueezyConfig {
  const apiKey = env.LEMONSQUEEZY_API_KEY?.trim() ?? ''
  const storeId = env.LEMONSQUEEZY_STORE_ID?.trim() ?? ''
  const webhookSecret = env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() ?? ''
  const problems: string[] = []
  if (!apiKey) problems.push('LEMONSQUEEZY_API_KEY is missing')
  if (!storeId) problems.push('LEMONSQUEEZY_STORE_ID is missing')
  else if (!/^\d+$/.test(storeId)) problems.push('LEMONSQUEEZY_STORE_ID must be the numeric store id')
  if (!webhookSecret) problems.push('LEMONSQUEEZY_WEBHOOK_SECRET is missing')
  if (problems.length > 0) {
    throw new Error(`Lemon Squeezy billing is misconfigured: ${problems.join('; ')}.`)
  }
  return { apiKey, storeId, webhookSecret, teamTokenSecret: lemonSqueezyTeamTokenSecret(env) ?? webhookSecret }
}

/** A JSON:API resource as Lemon Squeezy returns it. */
interface Resource {
  type: string
  id: string
  attributes: Record<string, unknown>
}

/**
 * True when `signature` (the X-Signature header) is the hex HMAC-SHA256 of the raw body with `secret`.
 * Constant-time; a header that is not 64 hex characters is rejected before comparing.
 */
export function isValidLemonSqueezySignature(rawBody: string | Buffer, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

/**
 * The id a delivery is deduplicated by. Lemon Squeezy sends no event id (meta has event_name, custom_data, test_mode
 * and webhook_id, which names the endpoint, not the event), so it is derived from the event, the object it carries and
 * the raw body: `<event_name>:<data.type>:<data.id>:<data.attributes.updated_at>:<sha256 hex of the raw body>`.
 * A redelivery is byte-identical, so it has the same id. `updated_at` has a resolution of one second, so two changes
 * of one object within a second share the first four parts; the body hash tells them apart.
 */
export function lemonSqueezyEventId(body: { meta?: { event_name?: unknown }; data?: Partial<Resource> }, rawBody: string | Buffer): string {
  const data = body.data ?? {}
  const parts = [body.meta?.event_name, data.type, data.id, data.attributes?.updated_at].map(part => String(part ?? ''))
  return [...parts, createHash('sha256').update(rawBody).digest('hex')].join(':')
}

/** Calls the Lemon Squeezy API; throws with the API's error detail (never the key) on a non-2xx answer. */
async function lemonSqueezyRequest(config: LemonSqueezyConfig, method: string, path: string, body?: unknown): Promise<Resource> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await response.json().catch(() => null)) as { data?: Resource; errors?: { detail?: string; title?: string }[] } | null
  if (!response.ok || !json?.data) {
    const detail = json?.errors?.map(error => error.detail || error.title).filter(Boolean).join('; ')
    throw new Error(`Lemon Squeezy API ${method} ${path} failed with status ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return json.data
}

function subscriptionResult(subscription: Resource): SubscriptionResult {
  return {
    id: subscription.id,
    status: String(subscription.attributes.status ?? ''),
    // a cancelled subscription stays usable until ends_at: that is a cancellation at period end
    cancelAtPeriodEnd: subscription.attributes.cancelled === true,
  }
}

function customerResult(customer: Resource): CustomerResult {
  return {
    id: customer.id,
    email: (customer.attributes.email as string | null | undefined) ?? null,
    name: (customer.attributes.name as string | null | undefined) ?? null,
  }
}

/**
 * Lemon Squeezy implementation of the BillingGateway interface.
 * The constructor validates the environment, so a misconfiguration fails when the factory selects the gateway.
 */
export class LemonSqueezyGateway implements BillingGateway {
  private readonly config: LemonSqueezyConfig

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.config = lemonSqueezyConfigFromEnv(env)
    if (this.config.webhookSecret.length < RECOMMENDED_SECRET_LENGTH) {
      console.warn(`[lemonsqueezy] LEMONSQUEEZY_WEBHOOK_SECRET is shorter than ${RECOMMENDED_SECRET_LENGTH} characters; use a longer random secret`)
    }
  }

  private request(method: string, path: string, body?: unknown) {
    return lemonSqueezyRequest(this.config, method, path, body)
  }

  /**
   * POST /v1/checkouts for one variant. The custom data comes back in the webhooks as meta.custom_data, with the
   * team token (of this team and variant) that lets the webhook trust its teamId (lemonsqueezy-webhook.ts).
   */
  private async createCheckout(variantId: string, data: Record<string, string> & { teamId: string }, successUrl: string, email?: string, quantity?: number): Promise<CheckoutSessionResult> {
    const custom = { ...data, teamToken: lemonSqueezyTeamToken(data.teamId, variantId, this.config.teamTokenSecret) }
    const checkout = await this.request('POST', '/checkouts', {
      data: {
        type: 'checkouts',
        attributes: {
          product_options: { redirect_url: successUrl, enabled_variants: [Number(variantId)] },
          checkout_data: {
            custom,
            ...(email && { email }),
            ...(quantity && quantity !== 1 && { variant_quantities: [{ variant_id: Number(variantId), quantity }] }),
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: this.config.storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    })
    return { id: checkout.id, url: (checkout.attributes.url as string | undefined) ?? null }
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, planSlug, billingPeriod, successUrl, customerEmail } = params
    if (!BILLING_REGISTRY.plans.some(plan => plan.slug === planSlug)) {
      throw new Error(`Plan ${planSlug} not found in BILLING_REGISTRY`)
    }
    const variantId = PlanService.getPriceId(planSlug, billingPeriod)
    if (!variantId) {
      throw new Error(`No variant ID configured for ${planSlug} ${billingPeriod}`)
    }
    // Lemon Squeezy has no cancel URL (the hosted checkout has its own back link) and identifies customers by email.
    return this.createCheckout(variantId, { teamId, planSlug, billingPeriod }, successUrl, customerEmail)
  }

  async createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, priceId, quantity = 1, successUrl, customerEmail, metadata } = params
    // teamId last: project metadata cannot replace it (nor teamToken, which createCheckout sets)
    return this.createCheckout(priceId, { ...metadata, teamId }, successUrl, customerEmail, quantity)
  }

  async createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult> {
    // The portal URL is pre-signed for 24 hours and has its own way back to the store; it takes no return URL.
    const customer = await this.request('GET', `/customers/${encodeURIComponent(params.customerId)}`)
    const url = (customer.attributes.urls as { customer_portal?: string | null } | undefined)?.customer_portal
    if (!url) {
      throw new Error(`Lemon Squeezy customer ${params.customerId} has no customer portal URL (no subscription in the store)`)
    }
    return { url }
  }

  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult {
    const signature = typeof signatureOrHeaders === 'string'
      ? signatureOrHeaders
      : signatureOrHeaders['x-signature'] ?? signatureOrHeaders['X-Signature']
    if (!isValidLemonSqueezySignature(payload, signature, this.config.webhookSecret)) {
      throw new Error('Lemon Squeezy webhook verification failed: the signature does not match the body')
    }
    const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf-8')) as Record<string, unknown>
    const meta = body.meta as { event_name?: unknown } | undefined
    if (typeof meta?.event_name !== 'string' || !body.data || typeof body.data !== 'object') {
      throw new Error('Lemon Squeezy webhook has no meta.event_name or data')
    }
    return { id: lemonSqueezyEventId(body, payload), type: meta.event_name, data: body }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    return customerResult(await this.request('GET', `/customers/${encodeURIComponent(customerId)}`))
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    // Lemon Squeezy requires a name; it has no metadata on customers.
    const customer = await this.request('POST', '/customers', {
      data: {
        type: 'customers',
        attributes: { name: params.name || params.email, email: params.email },
        relationships: { store: { data: { type: 'stores', id: this.config.storeId } } },
      },
    })
    return customerResult(customer)
  }

  private updateSubscription(subscriptionId: string, attributes: Record<string, unknown>) {
    return this.request('PATCH', `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      data: { type: 'subscriptions', id: subscriptionId, attributes },
    })
  }

  async updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    const { subscriptionId, newPriceId, prorationBehavior = 'create_prorations' } = params
    // create_prorations: Lemon Squeezy's default (prorated on the next invoice)
    const updated = await this.updateSubscription(subscriptionId, {
      variant_id: Number(newPriceId),
      ...(prorationBehavior === 'none' && { disable_prorations: true }),
      ...(prorationBehavior === 'always_invoice' && { invoice_immediately: true }),
    })
    return subscriptionResult(updated)
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult> {
    // DELETE cancels with a grace period: the subscription stays active until ends_at and can be resumed before it
    const cancelled = await this.request('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
    return { ...subscriptionResult(cancelled), cancelAtPeriodEnd: true }
  }

  async cancelSubscriptionImmediately(_subscriptionId: string): Promise<SubscriptionResult> {
    throw new BillingOperationNotSupportedError(
      'Lemon Squeezy cannot cancel a subscription immediately: a cancelled subscription runs until the end of its billing period. Cancel at period end instead.'
    )
  }

  async reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    // resumes a cancelled subscription before its ends_at
    return subscriptionResult(await this.updateSubscription(subscriptionId, { cancelled: false }))
  }

  getProviderName(): string {
    return 'Lemon Squeezy'
  }

  getResourceHintDomains(): { preconnect: string[]; dnsPrefetch: string[] } {
    // Redirect-based checkout and server-side API calls: no browser-side resources to hint.
    return { preconnect: [], dnsPrefetch: [] }
  }

  getSubscriptionDashboardUrl(externalSubscriptionId: string | null | undefined): string | null {
    if (!externalSubscriptionId) return null
    // Lemon Squeezy documents no deep link to one subscription: link to the subscriptions page.
    return 'https://app.lemonsqueezy.com/subscriptions'
  }
}
