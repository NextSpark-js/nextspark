/**
 * Webhook event deduplication shared by every billing gateway (#266).
 *
 * A gateway's webhook handler calls processWebhookEventOnce() right after it verifies the signature.
 * The event is claimed in "billing_webhook_events" with INSERT ... ON CONFLICT on UNIQUE (gateway, "eventId"),
 * so of two concurrent deliveries only one gets the row back and runs `handle`:
 * - `handle` succeeds: the row is marked processed, and every later delivery is a duplicate;
 * - `handle` throws: the row is deleted and the error rethrown, so the handler answers 500 and the
 *   gateway's retry processes the event;
 * - the process dies mid-way: the row stays 'processing'; once its claim is older than the lease, the next
 *   retry takes it over.
 * A delivery that arrives while another one holds a live claim gets 'in_progress': answer it with a non-2xx
 * so the gateway retries it later, because the delivery holding the claim may still fail.
 *
 * Usage in a gateway's handler:
 *   const outcome = await processWebhookEventOnce('paddle', event.id, event.type, () => handleEvent(event))
 *   return webhookOutcomeResponse(outcome)
 */

import { query, queryOne } from '../db'

/** How long a claim blocks other deliveries before a retry may take it over. */
export const WEBHOOK_CLAIM_LEASE_SECONDS = 300

export type WebhookEventOutcome = 'processed' | 'duplicate' | 'in_progress'

/**
 * Runs `handle` for an event unless another delivery already processed it or is processing it.
 * Rethrows what `handle` throws, after releasing the claim.
 */
export async function processWebhookEventOnce(
  gateway: string,
  eventId: string,
  eventType: string | null,
  handle: () => Promise<void>
): Promise<WebhookEventOutcome> {
  // A conflict updates (and returns) the row only when its claim is a dead delivery's; otherwise nothing comes back.
  const claim = await queryOne<{ id: string; claimedAt: string }>(
    `INSERT INTO "billing_webhook_events" (gateway, "eventId", "eventType")
     VALUES ($1, $2, $3)
     ON CONFLICT (gateway, "eventId") DO UPDATE
       SET "claimedAt" = clock_timestamp()
       WHERE "billing_webhook_events".status = 'processing'
         AND "billing_webhook_events"."claimedAt" < clock_timestamp() - make_interval(secs => $4)
     RETURNING id, "claimedAt"::text AS "claimedAt"`,
    [gateway, eventId, eventType, WEBHOOK_CLAIM_LEASE_SECONDS]
  )

  if (!claim) {
    const existing = await queryOne<{ status: string }>(
      `SELECT status FROM "billing_webhook_events" WHERE gateway = $1 AND "eventId" = $2`,
      [gateway, eventId]
    )
    return existing?.status === 'processed' ? 'duplicate' : 'in_progress'
  }

  // "claimedAt" (as text: a JS Date drops its microseconds) identifies this claim, so a delivery whose lease ran out
  // does not touch the claim that replaced it.
  try {
    await handle()
  } catch (error) {
    await query(
      `DELETE FROM "billing_webhook_events" WHERE id = $1 AND "claimedAt" = $2::timestamptz`,
      [claim.id, claim.claimedAt]
    )
    throw error
  }

  await query(
    `UPDATE "billing_webhook_events" SET status = 'processed', "processedAt" = now()
     WHERE id = $1 AND "claimedAt" = $2::timestamptz`,
    [claim.id, claim.claimedAt]
  )
  return 'processed'
}

/** The webhook response for an outcome: 200 for processed and duplicate, 409 for in progress so the gateway retries. */
export function webhookOutcomeResponse(outcome: WebhookEventOutcome): Response {
  if (outcome === 'duplicate') return Response.json({ received: true, status: 'duplicate' })
  if (outcome === 'in_progress') {
    return Response.json({ error: 'Event is being processed', status: 'in_progress' }, { status: 409 })
  }
  return Response.json({ received: true })
}
