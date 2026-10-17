-- Migration: 040_billing_webhook_events.sql
-- Description: One row per payment-gateway webhook event, so each event is processed once (#266).
--
-- The Stripe and Polar handlers looked for an earlier billing_events row before processing an event: two concurrent
-- deliveries both passed that check, and an event whose handler writes no billing_events row was never recorded.
-- A handler now claims the event first with INSERT ... ON CONFLICT on UNIQUE (gateway, "eventId"); only the delivery
-- that gets the row back processes it (lib/billing/webhook-events.ts):
-- - status 'processing' while a delivery works on it, 'processed' once it succeeded;
-- - a delivery that fails deletes its row, so the gateway's retry processes the event;
-- - a 'processing' row whose "claimedAt" is older than the lease belongs to a delivery that died; the next retry takes
--   it over.
-- RLS is enabled with no policy: like the other billing tables, only the service connection (webhooks, which have no
-- user) writes it, and no user reads it. Idempotent.

CREATE TABLE IF NOT EXISTS public."billing_webhook_events" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gateway       TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "eventType"   TEXT,
  status        TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed')),
  "claimedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_events_gateway_event_id_key UNIQUE (gateway, "eventId")
);

COMMENT ON TABLE  public."billing_webhook_events"               IS 'Payment gateway webhook events claimed for processing, one row per (gateway, eventId)';
COMMENT ON COLUMN public."billing_webhook_events".gateway       IS 'Gateway name: stripe, polar, ...';
COMMENT ON COLUMN public."billing_webhook_events"."eventId"     IS 'The gateway''s event id';
COMMENT ON COLUMN public."billing_webhook_events".status        IS 'processing while a delivery handles it, processed once it succeeded';
COMMENT ON COLUMN public."billing_webhook_events"."claimedAt"   IS 'When the processing delivery claimed it; a stale claim is taken over by a retry';

ALTER TABLE public."billing_webhook_events" ENABLE ROW LEVEL SECURITY;
