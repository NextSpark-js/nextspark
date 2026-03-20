/**
 * Stripe Connect Webhook Handler
 *
 * Handles Stripe Connect events for marketplace payment splitting.
 * Uses a SEPARATE signing secret from regular billing webhooks (STRIPE_CONNECT_WEBHOOK_SECRET).
 *
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 */

import { NextRequest } from 'next/server'
import { handleStripeConnectWebhook } from '@nextsparkjs/core/lib/marketplace/stripe-connect-webhook'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const POST = withRateLimitTier(
  async (request: NextRequest) => {
    return handleStripeConnectWebhook(request, {
      // Add custom handlers here:
      // onPaymentSucceeded: async (pi, accountId) => { ... },
      // onDisputeCreated: async (dispute, accountId) => { ... },
    })
  },
  'webhook'
)
