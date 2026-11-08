/**
 * Server-side entry points for charging a buyer. No route of the plugin takes an amount: the project's server code
 * prices its own goods and calls these functions, and the commission is computed here.
 */

import { calculateCommission, type CommissionConfig } from './commission'
import { defaultCommission } from './env'
import { gatewayFor, mercadoPagoNotificationUrl } from './runtime'
import { attachCheckout, createPendingPayment, findAccount, getPaymentForRefund, getSellerAccessToken, webhookStore } from './store'
import type { MarketplaceGateway, MarketplaceProvider, RefundResult, SellerRef } from './gateway'

export class SellerNotReadyError extends Error {
  constructor() {
    super('The seller is not connected or cannot take charges')
    this.name = 'SellerNotReadyError'
  }
}

export interface MarketplaceCheckoutParams {
  sellerTeamId: string
  provider: MarketplaceProvider
  /** Computed by the project's server code, in minor units. */
  amountCents: number
  currency: string
  description: string
  successUrl: string
  cancelUrl: string
  /** Overrides MARKETPLACE_COMMISSION_* for this payment (a per-seller or per-product rate). */
  commission?: CommissionConfig
}

async function sellerRef(account: { id: string; providerAccountId: string }, provider: MarketplaceProvider): Promise<SellerRef> {
  if (provider === 'stripe') return { providerAccountId: account.providerAccountId }
  const accessToken = await getSellerAccessToken(account.id)
  if (!accessToken) throw new SellerNotReadyError()
  return { providerAccountId: account.providerAccountId, accessToken }
}

export async function createMarketplaceCheckout(params: MarketplaceCheckoutParams, gateway: MarketplaceGateway = gatewayFor(params.provider)): Promise<{ paymentId: string; checkoutUrl: string }> {
  const account = await findAccount(params.sellerTeamId, params.provider)
  if (!account || account.status !== 'active' || !account.chargesEnabled) throw new SellerNotReadyError()
  const seller = await sellerRef(account, params.provider)

  const { commissionCents } = calculateCommission(params.amountCents, params.commission ?? defaultCommission())
  const paymentId = await createPendingPayment({
    teamId: params.sellerTeamId,
    accountId: account.id,
    provider: params.provider,
    amountCents: params.amountCents,
    commissionCents,
    currency: params.currency,
    description: params.description,
  })

  try {
    const checkout = await gateway.createSplitCheckout(
      {
        paymentId,
        amountCents: params.amountCents,
        commissionCents,
        currency: params.currency,
        description: params.description,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        notificationUrl: params.provider === 'mercadopago' ? mercadoPagoNotificationUrl(paymentId) : undefined,
      },
      seller
    )
    await attachCheckout(paymentId, checkout.providerCheckoutId)
    return { paymentId, checkoutUrl: checkout.checkoutUrl }
  } catch (error) {
    await webhookStore.transitionPayment(paymentId, 'failed')
    throw error
  }
}

/** Refunds a payment, whole or in part. The payment's status follows from the provider's webhook. */
export async function refundMarketplacePayment(
  params: { paymentId: string; amountCents?: number; idempotencyKey: string },
  gateway?: MarketplaceGateway
): Promise<RefundResult> {
  const payment = await getPaymentForRefund(params.paymentId)
  if (!payment?.providerPaymentId) throw new Error('The payment cannot be refunded yet')
  const seller = await sellerRef({ id: payment.accountId, providerAccountId: payment.providerAccountId }, payment.provider)
  return (gateway ?? gatewayFor(payment.provider)).refund(
    { providerPaymentId: payment.providerPaymentId, amountCents: params.amountCents, currency: payment.currency, idempotencyKey: params.idempotencyKey },
    seller
  )
}
