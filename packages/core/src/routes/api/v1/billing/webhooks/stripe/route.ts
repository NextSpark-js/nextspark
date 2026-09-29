/**
 * Stripe Webhook Handler
 *
 * Handles Stripe subscription lifecycle events. This default takes no project
 * extensions: a host whose project has lib/billing/stripe-webhook-extensions.ts
 * (one-time payments: credit packs, LTD, upsells) passes them to
 * handleStripeWebhook itself.
 *
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Stripe signature verification is the primary security layer;
 * rate limiting protects against extreme flood attacks.
 * NOTE: Rate limiter only reads headers — raw body is NOT consumed here,
 * so Stripe's rawBody requirement is preserved.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook } from '@nextsparkjs/core/lib/billing/stripe-webhook'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const POST = withRateLimitTier(
  async (request: NextRequest): Promise<NextResponse> => {
    return handleStripeWebhook(request, {}) as unknown as NextResponse
  },
  'webhook'
)
