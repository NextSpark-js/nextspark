/**
 * MercadoPago Split Gateway Implementation
 *
 * Implements MarketplaceGateway for MercadoPago Marketplace split payments.
 *
 * Model: OAuth-connected sellers + marketplace_fee
 * - Payment is processed in the SELLER's account (they are the collector)
 * - marketplace_fee is extracted and sent to the platform's account
 * - OAuth flow connects sellers to the platform
 *
 * Key differences from Stripe Connect:
 * - Amounts are in FULL currency units (not cents): 10000 ARS = 10000, not 100.00
 * - OAuth is used for onboarding (not Account Links)
 * - Tokens expire in ~180 days and must be refreshed
 * - The seller is the collector (inverse of Stripe's destination charges)
 *
 * Country support: Argentina (MLA), Brazil (MLB), Mexico (MLM), Colombia (MCO)
 */

import type { MarketplaceGateway } from '../interface'
import type {
  CreateConnectedAccountParams,
  CreateOnboardingLinkParams,
  CreateMarketplacePaymentParams,
  CreateMarketplaceCheckoutParams,
  RefundMarketplacePaymentParams,
  CreatePayoutParams,
  ConnectedAccountResult,
  OnboardingLinkResult,
  DashboardLinkResult,
  MarketplacePaymentResult,
  RefundResult,
  PayoutResult,
  AccountBalanceResult,
} from '../interface'
import type { MarketplacePaymentStatus } from '../types'

// ===========================================
// MercadoPago SDK setup
// ===========================================

// MercadoPago SDK v2 types
interface MPPaymentCreateBody {
  transaction_amount: number
  description: string
  payment_method_id?: string
  token?: string
  installments?: number
  payer: { email: string; identification?: { type: string; number: string } }
  marketplace_fee?: number
  notification_url?: string
  external_reference?: string
  metadata?: Record<string, string>
}

interface MPPreferenceCreateBody {
  items: Array<{
    id: string
    title: string
    quantity: number
    unit_price: number
    currency_id: string
  }>
  marketplace_fee?: number
  payer?: { email: string }
  back_urls?: { success: string; failure: string; pending: string }
  auto_return?: string
  notification_url?: string
  external_reference?: string
  expires?: boolean
  expiration_date_to?: string
  metadata?: Record<string, string>
}

interface MPPaymentResponse {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  currency_id: string
  fee_details?: Array<{ type: string; amount: number }>
  transaction_details?: { net_received_amount: number }
  payment_method_id: string
  payment_type_id: string
  date_approved: string | null
  external_reference: string | null
  metadata?: Record<string, string>
}

interface MPPreferenceResponse {
  id: string
  init_point: string
  sandbox_init_point: string
}

// ===========================================
// Helpers
// ===========================================

function getMPBaseUrl(): string {
  return 'https://api.mercadopago.com'
}

function getAuthBaseUrl(): string {
  return 'https://auth.mercadopago.com'
}

async function mpFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getMPBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MercadoPago API error (${response.status}): ${error}`)
  }

  return response.json() as Promise<T>
}

/**
 * Map MercadoPago payment status to our MarketplacePaymentStatus
 */
function mapMPPaymentStatus(status: string): MarketplacePaymentStatus {
  const statusMap: Record<string, MarketplacePaymentStatus> = {
    pending: 'pending',
    approved: 'succeeded',
    authorized: 'processing',
    in_process: 'processing',
    in_mediation: 'disputed',
    rejected: 'failed',
    cancelled: 'canceled',
    refunded: 'refunded',
    charged_back: 'disputed',
  }
  return statusMap[status] || 'failed'
}

// ===========================================
// Token storage interface
// ===========================================

/**
 * Interface for retrieving seller OAuth tokens.
 * Implementations should handle encryption and refresh logic.
 */
export interface MPTokenProvider {
  getAccessToken(externalAccountId: string): Promise<string>
}

// Default: reads from environment (for platform-level operations)
let tokenProvider: MPTokenProvider = {
  async getAccessToken(): Promise<string> {
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) throw new Error('MP_ACCESS_TOKEN is not configured')
    return token
  },
}

/**
 * Set a custom token provider for retrieving seller access tokens.
 * Call this during app initialization.
 */
export function setMPTokenProvider(provider: MPTokenProvider): void {
  tokenProvider = provider
}

// ===========================================
// Gateway Implementation
// ===========================================

export class MercadoPagoSplitGateway implements MarketplaceGateway {
  readonly provider = 'mercadopago_split'

  // --- Account Management ---

  async createConnectedAccount(params: CreateConnectedAccountParams): Promise<ConnectedAccountResult> {
    // In MercadoPago, "creating" a connected account means generating
    // an OAuth authorization URL. The account already exists in MP.
    // We return a pending result; actual connection happens via OAuth callback.
    return {
      id: `pending_${params.teamId}`,
      email: params.email,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingStatus: 'pending',
    }
  }

  async createOnboardingLink(params: CreateOnboardingLinkParams): Promise<OnboardingLinkResult> {
    const appId = process.env.MP_APP_ID
    if (!appId) throw new Error('MP_APP_ID is not configured')

    const redirectUri = encodeURIComponent(params.returnUrl)
    const state = encodeURIComponent(params.externalAccountId) // Pass account reference as state

    const url = `${getAuthBaseUrl()}/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`

    return { url }
  }

  async getAccountStatus(externalAccountId: string): Promise<ConnectedAccountResult> {
    const accessToken = await tokenProvider.getAccessToken(externalAccountId)

    const user = await mpFetch<{
      id: number
      email: string
      nickname: string
      status: { site_status: string }
    }>(accessToken, '/users/me')

    const isActive = user.status.site_status === 'active'

    return {
      id: String(user.id),
      email: user.email,
      chargesEnabled: isActive,
      payoutsEnabled: isActive,
      detailsSubmitted: true,
      onboardingStatus: isActive ? 'active' : 'restricted',
    }
  }

  async createDashboardLink(_externalAccountId: string): Promise<DashboardLinkResult> {
    // MercadoPago doesn't have embedded dashboards like Stripe Express.
    // Redirect to the seller's MP account.
    return { url: 'https://www.mercadopago.com/activities' }
  }

  // --- Payments ---

  async createMarketplaceCheckout(params: CreateMarketplaceCheckoutParams): Promise<MarketplacePaymentResult> {
    const sellerToken = await tokenProvider.getAccessToken(params.externalAccountId)

    const preferenceBody: MPPreferenceCreateBody = {
      items: [
        {
          id: params.referenceId,
          title: params.description,
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency.toUpperCase(),
        },
      ],
      marketplace_fee: params.applicationFee,
      payer: params.customerEmail ? { email: params.customerEmail } : undefined,
      back_urls: {
        success: params.successUrl,
        failure: params.cancelUrl,
        pending: params.successUrl,
      },
      auto_return: 'approved',
      notification_url: process.env.MP_WEBHOOK_URL || undefined,
      external_reference: params.referenceId,
      metadata: {
        connectedAccountId: params.connectedAccountId,
        ...params.metadata,
      },
    }

    const preference = await mpFetch<MPPreferenceResponse>(
      sellerToken,
      '/checkout/preferences',
      { method: 'POST', body: JSON.stringify(preferenceBody) }
    )

    const isProduction = process.env.NODE_ENV === 'production'

    return {
      id: preference.id,
      status: 'pending',
      url: isProduction ? preference.init_point : preference.sandbox_init_point,
    }
  }

  async createMarketplacePayment(params: CreateMarketplacePaymentParams): Promise<MarketplacePaymentResult> {
    const sellerToken = await tokenProvider.getAccessToken(params.externalAccountId)

    const paymentBody: MPPaymentCreateBody = {
      transaction_amount: params.amount,
      description: params.description || `Payment for ${params.referenceId}`,
      payer: {
        email: params.customerEmail || '',
      },
      marketplace_fee: params.applicationFee,
      notification_url: process.env.MP_WEBHOOK_URL || undefined,
      external_reference: params.referenceId,
      metadata: {
        connectedAccountId: params.connectedAccountId,
        ...params.metadata,
      },
    }

    const payment = await mpFetch<MPPaymentResponse>(
      sellerToken,
      '/v1/payments',
      { method: 'POST', body: JSON.stringify(paymentBody) }
    )

    return {
      id: String(payment.id),
      status: mapMPPaymentStatus(payment.status),
      statusDetail: payment.status_detail,
    }
  }

  async getPaymentStatus(externalPaymentId: string): Promise<MarketplacePaymentResult> {
    // For payment status, we need the platform token (not seller token)
    const platformToken = process.env.MP_ACCESS_TOKEN
    if (!platformToken) throw new Error('MP_ACCESS_TOKEN is not configured')

    const payment = await mpFetch<MPPaymentResponse>(
      platformToken,
      `/v1/payments/${externalPaymentId}`
    )

    return {
      id: String(payment.id),
      status: mapMPPaymentStatus(payment.status),
      statusDetail: payment.status_detail,
    }
  }

  // --- Refunds ---

  async refundPayment(params: RefundMarketplacePaymentParams): Promise<RefundResult> {
    const platformToken = process.env.MP_ACCESS_TOKEN
    if (!platformToken) throw new Error('MP_ACCESS_TOKEN is not configured')

    const body = params.amount ? { amount: params.amount } : {}

    const refund = await mpFetch<{
      id: number
      amount: number
      status: string
    }>(
      platformToken,
      `/v1/payments/${params.externalPaymentId}/refunds`,
      { method: 'POST', body: JSON.stringify(body) }
    )

    return {
      id: String(refund.id),
      amount: refund.amount,
      status: refund.status,
      feeRefunded: 0, // MP handles fee refund proportionally by default
    }
  }

  // --- Payouts ---

  async createPayout(_params: CreatePayoutParams): Promise<PayoutResult> {
    // MercadoPago handles payouts automatically based on the seller's account settings.
    // Manual payouts are not supported via the marketplace API.
    throw new Error('MercadoPago handles payouts automatically. Manual payouts are not supported via the marketplace API.')
  }

  async getAccountBalance(externalAccountId: string): Promise<AccountBalanceResult> {
    const sellerToken = await tokenProvider.getAccessToken(externalAccountId)

    const balance = await mpFetch<{
      available_balance: number
      unavailable_balance: number
      currency_id: string
    }>(sellerToken, '/users/me/mercadopago_account/balance')

    return {
      available: balance.available_balance,
      pending: balance.unavailable_balance,
      currency: balance.currency_id.toLowerCase(),
    }
  }

  // --- Webhooks ---

  verifyWebhookSignature(
    _payload: string | Buffer,
    signatureOrHeaders: string | Record<string, string>
  ): { id: string; type: string; account?: string; data: Record<string, unknown> } {
    // MercadoPago webhook verification uses x-signature header with HMAC-SHA256
    const headers = typeof signatureOrHeaders === 'string'
      ? {} as Record<string, string>
      : signatureOrHeaders

    const xSignature = headers['x-signature']
    const xRequestId = headers['x-request-id']
    const webhookSecret = process.env.MP_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new Error('MP_WEBHOOK_SECRET is not configured')
    }

    if (!xSignature) {
      throw new Error('Missing x-signature header in MercadoPago webhook')
    }

    // Parse the body to get data.id for signature verification
    const body = typeof _payload === 'string' ? JSON.parse(_payload) : JSON.parse(_payload.toString('utf-8'))
    const dataId = body.data?.id

    if (dataId && xRequestId) {
      // Verify HMAC signature
      // x-signature format: "ts=1234567890,v1=hash_value"
      const parts: Record<string, string> = {}
      xSignature.split(',').forEach((part: string) => {
        const [key, value] = part.split('=')
        if (key && value) parts[key.trim()] = value.trim()
      })

      const ts = parts['ts']
      const expectedHash = parts['v1']

      if (ts && expectedHash) {
        const { createHmac } = require('crypto') as typeof import('crypto')
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
        const hmac = createHmac('sha256', webhookSecret)
          .update(manifest)
          .digest('hex')

        if (hmac !== expectedHash) {
          throw new Error('MercadoPago webhook signature verification failed')
        }
      }
    }

    return {
      id: String(body.id || ''),
      type: body.type || '',
      account: body.user_id ? String(body.user_id) : undefined,
      data: body.data || {},
    }
  }
}

// ===========================================
// OAuth Token Exchange Helper
// ===========================================

/**
 * Exchange an OAuth authorization code for access/refresh tokens.
 * Call this from your OAuth callback route.
 */
export async function exchangeMPAuthorizationCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId: number
  publicKey: string
}> {
  const appId = process.env.MP_APP_ID
  const clientSecret = process.env.MP_CLIENT_SECRET

  if (!appId || !clientSecret) {
    throw new Error('MP_APP_ID and MP_CLIENT_SECRET are required for OAuth')
  }

  const response = await fetch(`${getMPBaseUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: appId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MercadoPago OAuth token exchange failed: ${error}`)
  }

  const data = await response.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    user_id: number
    public_key: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userId: data.user_id,
    publicKey: data.public_key,
  }
}

/**
 * Refresh an expiring MP OAuth token.
 * Call this proactively before tokens expire (~180 days).
 */
export async function refreshMPToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const appId = process.env.MP_APP_ID
  const clientSecret = process.env.MP_CLIENT_SECRET

  if (!appId || !clientSecret) {
    throw new Error('MP_APP_ID and MP_CLIENT_SECRET are required for OAuth')
  }

  const response = await fetch(`${getMPBaseUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: appId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MercadoPago token refresh failed: ${error}`)
  }

  const data = await response.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
