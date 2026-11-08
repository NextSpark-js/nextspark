/**
 * MercadoPago webhook: signature verified in handleMercadoPagoWebhook before anything else.
 */

import { NextRequest } from 'next/server'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { isMercadoPagoConfigured, mercadoPagoWebhookSecrets } from '../../../lib/env'
import { mercadoPagoGateway, webhookDedupe } from '../../../lib/runtime'
import { webhookStore } from '../../../lib/store'
import { handleMercadoPagoWebhook } from '../../../lib/webhooks/handler'

export const POST = withRateLimitTier(
  (request: NextRequest) =>
    handleMercadoPagoWebhook(request, {
      secrets: isMercadoPagoConfigured() ? mercadoPagoWebhookSecrets() : [],
      store: webhookStore,
      dedupe: webhookDedupe,
      getPayment: (paymentId, accessToken) => mercadoPagoGateway().getPayment(paymentId, accessToken),
    }),
  'webhook'
)
