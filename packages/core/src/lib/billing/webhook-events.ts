/**
 * Webhook event deduplication shared by every billing gateway (#266).
 *
 * A gateway's webhook handler calls processWebhookEventOnce() right after it verifies the signature.
 * The event is claimed in "billing_webhook_events" with INSERT ... ON CONFLICT on UNIQUE (gateway, "eventId"),
 * so of two concurrent deliveries only one gets the row back and runs `handle`. The claim commits on its own, so a
 * concurrent delivery sees it; `handle` and the update that marks the row processed then run in one transaction
 * (withServiceTransaction: the db helpers `handle` calls use it):
 * - `handle` succeeds: the row is marked processed, and every later delivery is a duplicate;
 * - `handle` throws: everything it wrote rolls back, the row is deleted and the error rethrown, so the handler
 *   answers 500 and the gateway's retry processes the event;
 * - the process dies mid-way: the row stays 'processing'; once its claim is older than the lease, the next
 *   retry takes it over.
 * A delivery that arrives while another one holds a live claim gets 'in_progress': answer it with a non-2xx
 * so the gateway retries it later, because the delivery holding the claim may still fail. A delivery whose claim was
 * taken over while `handle` ran (its lease ran out) rolls back and gets 'in_progress' too.
 * What `handle` does outside Postgres (emails, API calls) is not rolled back: a retry does it again.
 *
 * Usage in a gateway's handler:
 *   const outcome = await processWebhookEventOnce('paddle', event.id, event.type, () => handleEvent(event))
 *   return webhookOutcomeResponse(outcome)
 */

import { query, servicePool, withServiceTransaction } from '../db'

/** How long a claim blocks other deliveries before a retry may take it over. */
export const WEBHOOK_CLAIM_LEASE_SECONDS = 300

export type WebhookEventOutcome = 'processed' | 'duplicate' | 'in_progress'

const CLAIM_LOST = new Error('The webhook event claim was taken over by another delivery')

// The claim and its release run on the pool, never in a transaction of the caller: the claim must commit on its own.
async function poolQueryOne<T>(text: string, params: unknown[]): Promise<T | null> {
  return ((await servicePool.query(text, params)).rows[0] as T | undefined) ?? null
}

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
  const claim = await poolQueryOne<{ id: string; claimedAt: string }>(
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
    const existing = await poolQueryOne<{ status: string }>(
      `SELECT status FROM "billing_webhook_events" WHERE gateway = $1 AND "eventId" = $2`,
      [gateway, eventId]
    )
    return existing?.status === 'processed' ? 'duplicate' : 'in_progress'
  }

  // "claimedAt" (as text: a JS Date drops its microseconds) identifies this claim, so a delivery whose lease ran out
  // does not touch the claim that replaced it.
  try {
    await withServiceTransaction(async () => {
      await handle()
      const done = await query(
        `UPDATE "billing_webhook_events" SET status = 'processed', "processedAt" = clock_timestamp()
         WHERE id = $1 AND "claimedAt" = $2::timestamptz`,
        [claim.id, claim.claimedAt]
      )
      // another delivery took the claim over: it owns the event, so nothing this one wrote is kept
      if (done.rowCount === 0) throw CLAIM_LOST
    })
  } catch (error) {
    if (error === CLAIM_LOST) return 'in_progress'
    await servicePool.query(
      `DELETE FROM "billing_webhook_events" WHERE id = $1 AND "claimedAt" = $2::timestamptz`,
      [claim.id, claim.claimedAt]
    )
    throw error
  }

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
