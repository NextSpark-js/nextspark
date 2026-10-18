/**
 * Paddle Billing Payment Gateway Implementation (#269)
 *
 * Implements BillingGateway on the Paddle Billing REST API (not Paddle Classic) with fetch: no SDK, so nothing is
 * added to a project that does not configure it (the factory imports this module only for `provider: 'paddle'`).
 *
 * Key differences from Stripe:
 * - `providerPriceIds` in billing.config.ts hold Paddle **price ids** (`pri_...`).
 * - Sandbox and live are separate Paddle accounts with separate API keys, webhook secrets and base URLs
 *   (sandbox-api.paddle.com / api.paddle.com). PADDLE_ENVIRONMENT picks one, and a key of the other one is refused.
 * - Checkout creates a transaction; its `checkout.url` is the account's default payment link plus `?_ptxn=<id>`. That
 *   page is the project's own, on an approved domain, and loads Paddle.js, which opens the checkout for the transaction.
 * - The team rides in the transaction's custom_data, which Paddle copies to the subscription created from it.
 * - The customer portal is a session of temporary links; it takes no return URL.
 * - Webhooks are signed with Paddle-Signature: `ts=<unix seconds>;h1=<hex HMAC-SHA256 of "<ts>:<raw body>">`, with one
 *   h1 per active secret while a secret is rotated. Every event carries a unique event_id.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import { PlanService } from '../../services/plan.service'
import { paddleTeamToken, paddleTeamTokenSecret } from '../paddle-webhook'
import type { BillingGateway } from './interface'
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

const API_URLS = { sandbox: 'https://sandbox-api.paddle.com', production: 'https://api.paddle.com' } as const
const DASHBOARD_URLS = { sandbox: 'https://sandbox-vendors.paddle.com', production: 'https://vendors.paddle.com' } as const
const REQUEST_TIMEOUT_MS = 15_000
/** Paddle's SDKs reject a signature whose timestamp is more than five seconds away from now. */
export const PADDLE_SIGNATURE_TOLERANCE_SECONDS = 5
/** The range PADDLE_WEBHOOK_TOLERANCE_SECONDS may set; outside it the default is used, with a warning at selection. */
const TOLERANCE_RANGE = { min: 5, max: 300 }

/**
 * The signature tolerance from PADDLE_WEBHOOK_TOLERANCE_SECONDS: an integer from 5 to 300, else the default (`valid` is
 * false when the variable is set to something else).
 */
export function paddleWebhookToleranceFromEnv(env: NodeJS.ProcessEnv = process.env): { seconds: number; valid: boolean } {
  const raw = env.PADDLE_WEBHOOK_TOLERANCE_SECONDS?.trim()
  if (!raw) return { seconds: PADDLE_SIGNATURE_TOLERANCE_SECONDS, valid: true }
  const seconds = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (seconds >= TOLERANCE_RANGE.min && seconds <= TOLERANCE_RANGE.max) return { seconds, valid: true }
  return { seconds: PADDLE_SIGNATURE_TOLERANCE_SECONDS, valid: false }
}

export type PaddleEnvironment = keyof typeof API_URLS

export interface PaddleConfig {
  apiKey: string
  webhookSecret: string
  environment: PaddleEnvironment
  /** The key of the checkout team token: PADDLE_TEAM_TOKEN_SECRET, else the webhook secret */
  teamTokenSecret: string
  /** How far a signature's timestamp may be from now: PADDLE_WEBHOOK_TOLERANCE_SECONDS, else 5 */
  webhookToleranceSeconds: number
}

/**
 * The Paddle settings from the environment. Throws one error naming every variable that is missing or malformed; the
 * error never contains a value. An API key whose prefix names the other environment is refused.
 */
export function paddleConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaddleConfig {
  const apiKey = env.PADDLE_API_KEY?.trim() ?? ''
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET?.trim() ?? ''
  const environment = env.PADDLE_ENVIRONMENT?.trim() ?? ''
  const problems: string[] = []
  if (!apiKey) problems.push('PADDLE_API_KEY is missing')
  if (!webhookSecret) problems.push('PADDLE_WEBHOOK_SECRET is missing')
  if (!environment) problems.push('PADDLE_ENVIRONMENT is missing (sandbox or production)')
  else if (environment !== 'sandbox' && environment !== 'production') problems.push('PADDLE_ENVIRONMENT must be sandbox or production')
  // keys made since 2025 say which environment they are for; older keys have no prefix and are not checked
  else if (environment === 'production' && apiKey.startsWith('pdl_sdbx_')) problems.push('PADDLE_API_KEY is a sandbox key but PADDLE_ENVIRONMENT is production')
  else if (environment === 'sandbox' && apiKey.startsWith('pdl_live_')) problems.push('PADDLE_API_KEY is a live key but PADDLE_ENVIRONMENT is sandbox')
  if (problems.length > 0) {
    throw new Error(`Paddle billing is misconfigured: ${problems.join('; ')}.`)
  }
  return {
    apiKey,
    webhookSecret,
    environment: environment as PaddleEnvironment,
    teamTokenSecret: paddleTeamTokenSecret(env) ?? webhookSecret,
    webhookToleranceSeconds: paddleWebhookToleranceFromEnv(env).seconds,
  }
}

/**
 * True when the Paddle-Signature header (`ts=...;h1=...[;h1=...]`) signs `rawBody` with `secret` and its timestamp is
 * within `toleranceSeconds` of `nowSeconds`. Each h1 is the hex HMAC-SHA256 of `<ts>:<raw body>`; any one matching is
 * enough (Paddle sends one per secret during a rotation). Constant-time; a malformed header is rejected before comparing.
 */
export function isValidPaddleSignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = PADDLE_SIGNATURE_TOLERANCE_SECONDS
): boolean {
  if (!header) return false
  let ts: string | null = null
  const signatures: Buffer[] = []
  for (const part of header.split(';')) {
    const [key, value, ...rest] = part.trim().split('=')
    if (rest.length > 0 || value === undefined) return false
    if (key === 'ts') {
      if (ts !== null || !/^\d{1,12}$/.test(value)) return false
      ts = value
    } else if (key === 'h1') {
      if (!/^[0-9a-f]{64}$/i.test(value)) return false
      signatures.push(Buffer.from(value, 'hex'))
    }
  }
  if (ts === null || signatures.length === 0) return false
  if (Math.abs(nowSeconds - Number(ts)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${ts}:`).update(rawBody).digest()
  // every h1 is compared, so the time taken does not tell which one matched
  return signatures.map(signature => timingSafeEqual(expected, signature)).includes(true)
}

type Entity = Record<string, unknown> & { id: string }

/** Calls the Paddle API; throws with the API's error code and detail (never the key) on a non-2xx answer. */
async function paddleRequest(config: PaddleConfig, method: string, path: string, body?: unknown): Promise<Entity> {
  const response = await fetch(`${API_URLS[config.environment]}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'Paddle-Version': '1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await response.json().catch(() => null)) as {
    data?: Entity
    error?: { code?: string; detail?: string; errors?: { field?: string; message?: string }[] }
  } | null
  if (!response.ok || !json?.data) {
    const error = json?.error
    const fields = error?.errors?.map(item => `${item.field}: ${item.message}`).join(', ')
    const detail = [error?.code, error?.detail, fields].filter(Boolean).join(': ')
    throw new Error(`Paddle API ${method} ${path} failed with status ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return json.data
}

function subscriptionResult(subscription: Entity): SubscriptionResult {
  const scheduled = subscription.scheduled_change as { action?: string } | null | undefined
  return {
    id: subscription.id,
    status: String(subscription.status ?? ''),
    cancelAtPeriodEnd: scheduled?.action === 'cancel',
  }
}

function customerResult(customer: Entity): CustomerResult {
  return {
    id: customer.id,
    email: (customer.email as string | null | undefined) ?? null,
    name: (customer.name as string | null | undefined) ?? null,
  }
}

/** Every plan price id in the billing config. */
function planPriceIds(): Set<string> {
  return new Set(BILLING_REGISTRY.plans.flatMap(plan => [plan.providerPriceIds?.monthly, plan.providerPriceIds?.yearly])
    .filter((id): id is string => typeof id === 'string' && id !== ''))
}

/** Our proration behaviors on Paddle's proration_billing_mode. */
const PRORATION_MODES = {
  // Stripe's default: the difference is prorated and billed with the next renewal
  create_prorations: 'prorated_next_billing_period',
  // the prorated difference is charged now
  always_invoice: 'prorated_immediately',
  // no proration: the new price applies from the next renewal
  none: 'full_next_billing_period',
} as const

/**
 * Paddle Billing implementation of the BillingGateway interface.
 * The constructor validates the environment, so a misconfiguration fails when the factory selects the gateway.
 */
export class PaddleGateway implements BillingGateway {
  private readonly config: PaddleConfig

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.config = paddleConfigFromEnv(env)
    if (!paddleWebhookToleranceFromEnv(env).valid) {
      console.warn(
        `[paddle] PADDLE_WEBHOOK_TOLERANCE_SECONDS must be an integer from ${TOLERANCE_RANGE.min} to ${TOLERANCE_RANGE.max}; ` +
        `using the default of ${PADDLE_SIGNATURE_TOLERANCE_SECONDS} seconds`
      )
    }
    if (this.config.environment === 'sandbox' && env.NODE_ENV === 'production') {
      console.warn('[paddle] PADDLE_ENVIRONMENT is sandbox in a production build: checkouts take no real payments (fine for staging, not for a live site)')
    }
  }

  private request(method: string, path: string, body?: unknown) {
    return paddleRequest(this.config, method, path, body)
  }

  /**
   * POST /transactions for one price. The custom data (with the team token of this team and price) is copied to the
   * subscription and comes back in the webhooks (routes/_internal/paddle-webhook.ts).
   */
  private async createTransaction(priceId: string, data: Record<string, string> & { teamId: string }, quantity: number, customerId?: string): Promise<CheckoutSessionResult> {
    const custom = { ...data, teamToken: paddleTeamToken(data.teamId, priceId, this.config.teamTokenSecret) }
    const transaction = await this.request('POST', '/transactions', {
      items: [{ price_id: priceId, quantity }],
      custom_data: custom,
      // the team's customer id may be another provider's (a team switching providers): only Paddle's are passed
      ...(customerId?.startsWith('ctm_') && { customer_id: customerId }),
    })
    const url = (transaction.checkout as { url?: string | null } | null | undefined)?.url
    if (!url) {
      throw new Error(`Paddle returned no checkout URL for transaction ${transaction.id}: set a default payment link (Paddle > Checkout > Checkout settings)`)
    }
    return { id: transaction.id, url }
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, planSlug, billingPeriod, customerId } = params
    if (!BILLING_REGISTRY.plans.some(plan => plan.slug === planSlug)) {
      throw new Error(`Plan ${planSlug} not found in BILLING_REGISTRY`)
    }
    const priceId = PlanService.getPriceId(planSlug, billingPeriod)
    if (!priceId) {
      throw new Error(`No price ID configured for ${planSlug} ${billingPeriod}`)
    }
    // The success URL is set by Paddle.js on the payment link page (checkout.settings.successUrl); a transaction has none.
    return this.createTransaction(priceId, { teamId, planSlug, billingPeriod }, 1, customerId)
  }

  async createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<CheckoutSessionResult> {
    const { teamId, priceId, quantity = 1, customerId, metadata } = params
    // teamId last: project metadata cannot replace it (nor teamToken, which createTransaction sets)
    return this.createTransaction(priceId, { ...metadata, teamId }, quantity, customerId)
  }

  async createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult> {
    // The links are temporary and must not be stored; the portal takes no return URL.
    const session = await this.request('POST', `/customers/${encodeURIComponent(params.customerId)}/portal-sessions`, {})
    const url = (session.urls as { general?: { overview?: string } } | undefined)?.general?.overview
    if (!url) {
      throw new Error(`Paddle returned no customer portal URL for customer ${params.customerId}`)
    }
    return { url }
  }

  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult {
    const signature = typeof signatureOrHeaders === 'string'
      ? signatureOrHeaders
      : signatureOrHeaders['paddle-signature'] ?? signatureOrHeaders['Paddle-Signature']
    if (!isValidPaddleSignature(payload, signature, this.config.webhookSecret, undefined, this.config.webhookToleranceSeconds)) {
      throw new Error('Paddle webhook verification failed: the signature does not match the body, or its timestamp is outside the tolerance')
    }
    const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf-8')) as Record<string, unknown>
    if (typeof body.event_id !== 'string' || !body.event_id || typeof body.event_type !== 'string' || !body.data || typeof body.data !== 'object') {
      throw new Error('Paddle webhook has no event_id, event_type or data')
    }
    return { id: body.event_id, type: body.event_type, data: body }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    return customerResult(await this.request('GET', `/customers/${encodeURIComponent(customerId)}`))
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    return customerResult(await this.request('POST', '/customers', {
      email: params.email,
      ...(params.name && { name: params.name }),
      ...(params.metadata && { custom_data: params.metadata }),
    }))
  }

  async updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    const { subscriptionId, newPriceId, prorationBehavior = 'create_prorations' } = params
    const path = `/subscriptions/${encodeURIComponent(subscriptionId)}`
    // PATCH replaces the whole item list: keep the items that are not a plan's (add-ons), swap the plan's price
    const current = await this.request('GET', path)
    const plans = planPriceIds()
    const kept = ((current.items ?? []) as { price?: { id?: string }; quantity?: number }[])
      .filter(item => item.price?.id && !plans.has(item.price.id))
      .map(item => ({ price_id: item.price!.id, quantity: item.quantity ?? 1 }))
    const updated = await this.request('PATCH', path, {
      items: [{ price_id: newPriceId, quantity: 1 }, ...kept],
      proration_billing_mode: PRORATION_MODES[prorationBehavior],
    })
    return subscriptionResult(updated)
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult> {
    // a scheduled change (action cancel): the subscription stays active until the end of the billing period
    const subscription = await this.request('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: 'next_billing_period' })
    return { ...subscriptionResult(subscription), cancelAtPeriodEnd: true }
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult> {
    return subscriptionResult(await this.request('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: 'immediately' }))
  }

  async reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    // removes the scheduled cancellation before it takes effect
    return subscriptionResult(await this.request('PATCH', `/subscriptions/${encodeURIComponent(subscriptionId)}`, { scheduled_change: null }))
  }

  getProviderName(): string {
    return 'Paddle'
  }

  getResourceHintDomains(): { preconnect: string[]; dnsPrefetch: string[] } {
    // The checkout opens on the project's payment link page, which loads Paddle.js itself.
    return { preconnect: [], dnsPrefetch: [] }
  }

  getSubscriptionDashboardUrl(externalSubscriptionId: string | null | undefined): string | null {
    if (!externalSubscriptionId) return null
    // Paddle documents no deep link to one subscription: link to the dashboard of the environment.
    return DASHBOARD_URLS[this.config.environment]
  }
}
