/**
 * Paddle Webhook Handler
 *
 * Processes Paddle Billing webhook events for subscription lifecycle management; the
 * handler is in ../../../../../_internal/paddle-webhook.
 */

import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { createPaddleWebhookHandler } from '../../../../../_internal/paddle-webhook'

/**
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Signature verification (Paddle-Signature) is the primary security layer;
 * rate limiting protects against extreme flood attacks.
 * NOTE: Rate limiter only reads headers, so the raw body is intact for the handler.
 */
export const POST = withRateLimitTier(createPaddleWebhookHandler(), 'webhook')
