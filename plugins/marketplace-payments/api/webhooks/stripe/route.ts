/**
 * Stripe Connect webhook: signature verified in handleStripeWebhook before anything else.
 */

import { NextRequest } from 'next/server'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { stripeWebhookSecrets } from '../../../lib/env'
import { webhookDedupe } from '../../../lib/runtime'
import { webhookStore } from '../../../lib/store'
import { handleStripeWebhook } from '../../../lib/webhooks/handler'

export const POST = withRateLimitTier(
  (request: NextRequest) => handleStripeWebhook(request, { secrets: stripeWebhookSecrets(), store: webhookStore, dedupe: webhookDedupe }),
  'webhook'
)
