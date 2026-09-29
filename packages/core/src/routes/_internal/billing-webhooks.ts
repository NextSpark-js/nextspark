/**
 * Billing webhook Route Handlers with a project's extensions (#203).
 *
 * A project declares its extension modules in nextspark.config.ts
 * (`billing.webhookExtensions`); the generated host's webhook routes import them statically and
 * pass them here. Core's own routes (`api/v1/billing/webhooks/{stripe,polar}`) are the same
 * handlers without extensions.
 *
 * Rate limiting: 500 requests/hour per IP (tier: webhook). Signature verification is the primary
 * security layer. The rate limiter only reads headers, so the raw body the handlers need is intact.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook, type StripeWebhookExtensions } from '@nextsparkjs/core/lib/billing/stripe-webhook'
import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { createPolarWebhookHandler } from './polar-webhook'

/** The Stripe webhook `POST`, with the project's one-time payment extensions. */
export function createStripeWebhookRoute(extensions: StripeWebhookExtensions = {}) {
  return withRateLimitTier(
    async (request: NextRequest): Promise<NextResponse> => {
      return handleStripeWebhook(request, extensions) as unknown as NextResponse
    },
    'webhook'
  )
}

/** The Polar webhook `POST`, with the project's one-time payment extensions. */
export function createPolarWebhookRoute(extensions: PolarWebhookExtensions = {}) {
  return withRateLimitTier(createPolarWebhookHandler(async () => extensions), 'webhook')
}
