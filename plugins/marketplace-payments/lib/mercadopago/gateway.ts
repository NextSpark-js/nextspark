/**
 * MercadoPago split payments: a seller connects with OAuth, a checkout is created with the seller's token, and the
 * platform keeps `marketplace_fee`.
 */

import { minorToMajor } from '../money'
import { PROVIDER_TIMEOUT_MS, ProviderApiError } from '../provider-error'
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

const API_BASE = 'https://api.mercadopago.com'
const AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization'

export interface MercadoPagoOptions {
  clientId: string
  clientSecret: string
  /** The OAuth callback URL registered in the MercadoPago application. */
  redirectUri: string
  /** Send buyers to `sandbox_init_point` instead of `init_point`. */
  sandbox?: boolean
  fetch?: typeof globalThis.fetch
}

export interface MercadoPagoTokens {
  accessToken: string
  refreshToken: string
  /** The seller's MercadoPago user id. */
  providerAccountId: string
  expiresAt: Date
}

/** The fields read from a payment. */
export interface MercadoPagoPayment {
  id: number | string
  status: string
  external_reference?: string | null
  collector_id?: number | string | null
  transaction_amount?: number
  currency_id?: string
  transaction_amount_refunded?: number
  fee_details?: { type: string; amount: number }[]
}

export interface MercadoPagoGateway extends MarketplaceGateway {
  exchangeCode(code: string): Promise<MercadoPagoTokens>
  refreshAccessToken(refreshToken: string): Promise<MercadoPagoTokens>
  getPayment(paymentId: string, accessToken: string): Promise<MercadoPagoPayment>
}

function sellerToken(seller: SellerRef): string {
  if (!seller.accessToken) throw new Error('A MercadoPago call needs the seller access token')
  return seller.accessToken
}

export function createMercadoPagoGateway(options: MercadoPagoOptions): MercadoPagoGateway {
  const doFetch = options.fetch ?? globalThis.fetch

  async function call<T>(method: 'GET' | 'POST', path: string, token: string | null, body?: unknown, idempotencyKey?: string): Promise<T> {
    const response = await doFetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
    const parsed = (await response.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
    if (!response.ok || !parsed) throw new ProviderApiError('mercadopago', response.status, parsed?.error ?? parsed?.code)
    return parsed
  }

  async function tokenRequest(grant: Record<string, string>): Promise<MercadoPagoTokens> {
    const body = await call<{ access_token: string; refresh_token: string; user_id: number | string; expires_in: number }>('POST', '/oauth/token', null, {
      client_id: options.clientId,
      client_secret: options.clientSecret,
      ...grant,
    })
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      providerAccountId: String(body.user_id),
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    }
  }

  return {
    provider: 'mercadopago',

    async startOnboarding(params: OnboardingParams): Promise<OnboardingResult> {
      if (!params.state) throw new Error('The MercadoPago OAuth flow needs a state')
      const url = new URL(AUTHORIZE_URL)
      url.search = new URLSearchParams({
        client_id: options.clientId,
        response_type: 'code',
        platform_id: 'mp',
        state: params.state,
        redirect_uri: options.redirectUri,
      }).toString()
      return { redirectUrl: url.toString() }
    },

    exchangeCode(code: string): Promise<MercadoPagoTokens> {
      return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: options.redirectUri })
    },

    refreshAccessToken(refreshToken: string): Promise<MercadoPagoTokens> {
      return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
    },

    async getAccountStatus(seller: SellerRef): Promise<AccountStatusResult> {
      try {
        const user = await call<{ country_id?: string }>('GET', '/users/me', sellerToken(seller))
        return { status: 'active', chargesEnabled: true, payoutsEnabled: true, country: user.country_id }
      } catch (error) {
        if (error instanceof ProviderApiError && error.status === 401) {
          return { status: 'disconnected', chargesEnabled: false, payoutsEnabled: false }
        }
        throw error
      }
    },

    async createSplitCheckout(params: SplitCheckoutParams, seller: SellerRef): Promise<SplitCheckoutResult> {
      const preference = await call<{ id: string; init_point: string; sandbox_init_point?: string }>(
        'POST',
        '/checkout/preferences',
        sellerToken(seller),
        {
          items: [{ title: params.description, quantity: 1, unit_price: minorToMajor(params.amountCents, params.currency), currency_id: params.currency.toUpperCase() }],
          marketplace_fee: minorToMajor(params.commissionCents, params.currency),
          external_reference: params.paymentId,
          notification_url: params.notificationUrl,
          back_urls: { success: params.successUrl, pending: params.successUrl, failure: params.cancelUrl },
          // MercadoPago refuses auto_return on a URL that is not https
          ...(params.successUrl.startsWith('https:') && { auto_return: 'approved' }),
        },
        `marketplace-checkout-${params.paymentId}`
      )
      return {
        checkoutUrl: options.sandbox && preference.sandbox_init_point ? preference.sandbox_init_point : preference.init_point,
        providerCheckoutId: preference.id,
      }
    },

    async refund(params: RefundParams, seller: SellerRef): Promise<RefundResult> {
      const refund = await call<{ id: number | string }>(
        'POST',
        `/v1/payments/${encodeURIComponent(params.providerPaymentId)}/refunds`,
        sellerToken(seller),
        params.amountCents === undefined ? {} : { amount: minorToMajor(params.amountCents, params.currency) },
        params.idempotencyKey
      )
      return { providerRefundId: String(refund.id) }
    },

    getPayment(paymentId: string, accessToken: string): Promise<MercadoPagoPayment> {
      return call<MercadoPagoPayment>('GET', `/v1/payments/${encodeURIComponent(paymentId)}`, accessToken)
    },
  }
}
