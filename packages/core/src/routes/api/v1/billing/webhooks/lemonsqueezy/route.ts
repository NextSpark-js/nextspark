/**
 * Lemon Squeezy Webhook Handler
 *
 * Processes Lemon Squeezy webhook events for subscription lifecycle management; the
 * handler is in ../../../../../_internal/lemonsqueezy-webhook. This default takes no
 * project extensions: a host whose project declares
 * `billing.webhookExtensions.lemonsqueezy` passes their loader to
 * createLemonSqueezyWebhookHandler.
 */

import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { createLemonSqueezyWebhookHandler } from '../../../../../_internal/lemonsqueezy-webhook'

/**
 * Rate limiting: 500 requests/hour per IP (tier: webhook).
 * Signature verification (X-Signature) is the primary security layer;
 * rate limiting protects against extreme flood attacks.
 * NOTE: Rate limiter only reads headers, so the raw body is intact for the handler.
 */
export const POST = withRateLimitTier(createLemonSqueezyWebhookHandler(), 'webhook')
