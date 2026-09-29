/**
 * Polar.sh Webhook Handler
 *
 * Processes Polar webhook events for subscription lifecycle management; the
 * handler is in ../../../../../_internal/polar-webhook. This default takes no
 * project extensions (lib/billing/polar-webhook-extensions): a host that has them
 * passes their loader to createPolarWebhookHandler.
 */

import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { createPolarWebhookHandler } from '../../../../../_internal/polar-webhook'

/**
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Polar signature verification is the primary security layer;
 * rate limiting protects against extreme flood attacks.
 * NOTE: Rate limiter only reads headers — raw body is NOT consumed here,
 * so request.text() inside the handler still works correctly.
 */
export const POST = withRateLimitTier(createPolarWebhookHandler(), 'webhook')
