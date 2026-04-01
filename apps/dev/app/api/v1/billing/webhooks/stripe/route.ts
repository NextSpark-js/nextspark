/**
 * Stripe Webhook Handler
 *
 * Handles Stripe subscription lifecycle events.
 * To add one-time payment handling (credit packs, LTD, upsells),
 * create lib/billing/stripe-webhook-extensions.ts in your project.
 *
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Stripe signature verification is the primary security layer;
 * rate limiting protects against extreme flood attacks.
 * NOTE: Rate limiter only reads headers — raw body is NOT consumed here,
 * so Stripe's rawBody requirement is preserved.
 */

import { NextRequest } from 'next/server'
import { handleStripeWebhook } from '@nextsparkjs/core/lib/billing/stripe-webhook'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

async function loadExtensions() {
  try {
    const mod = await import('@/lib/billing/stripe-webhook-extensions')
    return mod.stripeWebhookExtensions
  } catch {
    return {}
  }
}

export const POST = withRateLimitTier(
  async (request: NextRequest) => {
    const extensions = await loadExtensions()
    return handleStripeWebhook(request, extensions)
  },
  'webhook'
)
