/**
 * Polar.sh Webhook Handler
 *
 * Implementation: @nextsparkjs/core/routes/api/v1/billing/webhooks/polar/route (#203).
 * This project's one-time payment hook (lib/billing/polar-webhook-extensions.ts) is
 * loaded here, until the generated host replaces this file.
 */

import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'
import { createPolarWebhookHandler } from '@nextsparkjs/core/routes/_internal/polar-webhook'

async function loadExtensions(): Promise<PolarWebhookExtensions> {
  try {
    const mod = await import('@/lib/billing/polar-webhook-extensions')
    return mod.polarWebhookExtensions
  } catch {
    return {}
  }
}

export const POST = withRateLimitTier(createPolarWebhookHandler(loadExtensions), 'webhook')
