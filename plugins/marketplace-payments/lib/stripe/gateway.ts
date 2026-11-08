/**
 * Stripe Connect: Express accounts and destination charges. The charge is made on the platform, the seller receives
 * the rest through `transfer_data.destination`, and the platform keeps `application_fee_amount`.
 *
 * It calls the REST API with fetch: the handful of calls below do not need the SDK, and the plugin adds no dependency.
 */

import { PROVIDER_TIMEOUT_MS, ProviderApiError } from '../provider-error'
import { STRIPE_API_VERSION } from './api-version'
import type {
  AccountStatusResult,
  MarketplaceGateway,
  OnboardingParams,
  OnboardingResult,
  RefundParams,
  RefundResult,
  SellerRef,
  SplitCheckoutParams,
  SplitCheckoutResult,
} from '../gateway'

const API_BASE = 'https://api.stripe.com'

export interface StripeConnectOptions {
  secretKey: string
  fetch?: typeof globalThis.fetch
}

/** Stripe's form encoding of a nested object: a[b][0][c]=v. An undefined value is left out. */
export function stripeFormEncode(params: Record<string, unknown>): string {
  const out = new URLSearchParams()
  const add = (key: string, value: unknown): void => {
    if (value === undefined || value === null) return
    if (typeof value === 'object') {
      for (const [child, nested] of Object.entries(value as object)) add(`${key}[${child}]`, nested)
    } else {
      out.append(key, String(value))
    }
  }
  for (const [key, value] of Object.entries(params)) add(key, value)
  return out.toString()
}

/** The fields of a Stripe account that the seller's status depends on. */
export interface StripeAccountFields {
  charges_enabled?: boolean
  payouts_enabled?: boolean
  country?: string
  requirements?: { disabled_reason?: string | null } | null
}

export function stripeAccountStatus(account: StripeAccountFields): AccountStatusResult {
  const chargesEnabled = account.charges_enabled === true
  const payoutsEnabled = account.payouts_enabled === true
  const status = chargesEnabled && payoutsEnabled ? 'active' : account.requirements?.disabled_reason ? 'restricted' : 'pending'
  return { status, chargesEnabled, payoutsEnabled, country: account.country }
}

export function createStripeConnectGateway(options: StripeConnectOptions): MarketplaceGateway {
  const doFetch = options.fetch ?? globalThis.fetch

  async function call<T>(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const response = await doFetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.secretKey}`,
        'Stripe-Version': STRIPE_API_VERSION,
        ...(params && { 'Content-Type': 'application/x-www-form-urlencoded' }),
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: params ? stripeFormEncode(params) : undefined,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as (T & { error?: { code?: string; type?: string } }) | null
    if (!response.ok || !body) throw new ProviderApiError('stripe', response.status, body?.error?.code ?? body?.error?.type)
    return body
  }

  return {
    provider: 'stripe',

    async startOnboarding(params: OnboardingParams): Promise<OnboardingResult> {
      let accountId = params.providerAccountId
      let created: string | undefined
      if (!accountId) {
        const account = await call<{ id: string }>(
          'POST',
          '/v1/accounts',
          {
            type: 'express',
            email: params.email,
            country: params.country,
            capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
            metadata: { teamId: params.teamId },
          },
          // a double click, or a retry after a lost answer, does not open a second account
          `marketplace-account-${params.teamId}`
        )
        accountId = created = account.id
      }
      const link = await call<{ url: string }>('POST', '/v1/account_links', {
        account: accountId,
        type: 'account_onboarding',
        return_url: params.returnUrl,
        refresh_url: params.refreshUrl ?? params.returnUrl,
      })
      return { redirectUrl: link.url, providerAccountId: created }
    },

    async getAccountStatus(seller: SellerRef): Promise<AccountStatusResult> {
      return stripeAccountStatus(await call<StripeAccountFields>('GET', `/v1/accounts/${encodeURIComponent(seller.providerAccountId)}`))
    },

    async createSplitCheckout(params: SplitCheckoutParams, seller: SellerRef): Promise<SplitCheckoutResult> {
      const session = await call<{ id: string; url: string }>(
        'POST',
        '/v1/checkout/sessions',
        {
          mode: 'payment',
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          client_reference_id: params.paymentId,
          metadata: { marketplacePaymentId: params.paymentId },
          line_items: [
            {
              quantity: 1,
              price_data: { currency: params.currency.toLowerCase(), unit_amount: params.amountCents, product_data: { name: params.description } },
            },
          ],
          payment_intent_data: {
            // Stripe refuses a fee of 0: with no commission the field is left out
            application_fee_amount: params.commissionCents > 0 ? params.commissionCents : undefined,
            transfer_data: { destination: seller.providerAccountId },
            metadata: { marketplacePaymentId: params.paymentId },
          },
        },
        `marketplace-checkout-${params.paymentId}`
      )
      return { checkoutUrl: session.url, providerCheckoutId: session.id }
    },

    async refund(params: RefundParams): Promise<RefundResult> {
      const refund = await call<{ id: string }>(
        'POST',
        '/v1/refunds',
        {
          payment_intent: params.providerPaymentId,
          amount: params.amountCents,
          // on a destination charge the money went to the seller: take it back, and give back the platform's share
          reverse_transfer: true,
          refund_application_fee: true,
        },
        params.idempotencyKey
      )
      return { providerRefundId: refund.id }
    },
  }
}
