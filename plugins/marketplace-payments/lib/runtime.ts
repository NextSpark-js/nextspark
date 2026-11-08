/**
 * The production wiring of the gateways and the webhook idempotency.
 */

import { processWebhookEventOnce, webhookOutcomeResponse } from '@nextsparkjs/core/lib/billing/webhook-events'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { resolveAppUrl } from '@nextsparkjs/core/lib/utils/base-url'
import { mercadoPagoClientId, mercadoPagoClientSecret, mercadoPagoSandbox, stripeSecretKey } from './env'
import { createMercadoPagoGateway, type MercadoPagoGateway } from './mercadopago/gateway'
import { createStripeConnectGateway } from './stripe/gateway'
import type { MarketplaceGateway, MarketplaceProvider } from './gateway'
import type { WebhookDedupe } from './webhooks/handler'

export const API_BASE_PATH = '/api/plugins/marketplace-payments'
export const SETTINGS_PATH = '/dashboard/settings/marketplace'

const appUrl = () => resolveAppUrl().replace(/\/+$/, '')

export const appLink = (path: string) => `${appUrl()}${withBasePath(path)}`

export function mercadoPagoGateway(): MercadoPagoGateway {
  return createMercadoPagoGateway({
    clientId: mercadoPagoClientId(),
    clientSecret: mercadoPagoClientSecret(),
    redirectUri: appLink(`${API_BASE_PATH}/oauth/mercadopago/callback`),
    sandbox: mercadoPagoSandbox(),
  })
}

export function gatewayFor(provider: MarketplaceProvider): MarketplaceGateway {
  return provider === 'stripe' ? createStripeConnectGateway({ secretKey: stripeSecretKey() }) : mercadoPagoGateway()
}

/** The notification URL of one MercadoPago payment. `source_news=webhooks` asks for signed webhooks, not legacy IPN. */
export function mercadoPagoNotificationUrl(paymentId: string): string {
  return appLink(`${API_BASE_PATH}/webhooks/mercadopago?ref=${encodeURIComponent(paymentId)}&source_news=webhooks`)
}

export const webhookDedupe: WebhookDedupe = async (gateway, eventId, eventType, handle) =>
  webhookOutcomeResponse(await processWebhookEventOnce(gateway, eventId, eventType, handle))
