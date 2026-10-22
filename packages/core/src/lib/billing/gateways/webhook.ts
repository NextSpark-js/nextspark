/**
 * Webhook verification for a project's own webhook route.
 *
 * Core ships no webhook endpoint for a custom gateway. The project adds its route (for example
 * `src/app/api/billing/webhook/route.ts`) and starts it with this helper, so nothing is processed before the
 * gateway's `verifyWebhookSignature` accepts the request:
 *
 *   const verified = await verifyBillingWebhook(request)
 *   if (!verified.ok) return verified.response
 *   // verified.event is { id, type, data }
 */

import { getBillingGateway } from './factory'
import { isBillingGatewayDisabled } from '../provider-mode'
import type { WebhookEventResult } from './types'

export type VerifiedBillingWebhook =
  | { ok: true; event: WebhookEventResult }
  | { ok: false; response: Response }

export async function verifyBillingWebhook(request: Request): Promise<VerifiedBillingWebhook> {
  if (isBillingGatewayDisabled()) {
    return { ok: false, response: Response.json({ error: 'Not found' }, { status: 404 }) }
  }

  // The raw body and every header: the signature is over the bytes as sent, and providers sign with different headers
  const payload = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  try {
    const gateway = await getBillingGateway()
    const event = gateway.verifyWebhookSignature(payload, headers)
    if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') {
      throw new Error('verified event has no id or type')
    }
    return { ok: true, event }
  } catch (error) {
    // The error name only: what a gateway throws can carry the secret or the signature it compared
    console.error(`[billing-webhook] Signature verification failed (${error instanceof Error ? error.name : 'Error'})`)
    return { ok: false, response: Response.json({ error: 'Invalid signature' }, { status: 400 }) }
  }
}
