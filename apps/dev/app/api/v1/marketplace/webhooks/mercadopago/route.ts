/**
 * MercadoPago Marketplace Webhook Route
 *
 * Handles MercadoPago webhook notifications for marketplace split payments.
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Signature verification via x-signature HMAC-SHA256 is the primary security layer.
 *
 * Configure this URL in MercadoPago Dashboard > Webhooks:
 *   https://yourdomain.com/api/v1/marketplace/webhooks/mercadopago
 *
 * Events to enable: payment
 */

import { NextRequest } from 'next/server'
import { handleMPMarketplaceWebhook } from '@nextsparkjs/core/lib/marketplace/mercadopago-webhook'
import { mpMarketplaceWebhookExtensions } from '@/lib/marketplace/mp-webhook-extensions'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const POST = withRateLimitTier(
  async (request: NextRequest) => {
    return handleMPMarketplaceWebhook(request, mpMarketplaceWebhookExtensions)
  },
  'webhook'
)
