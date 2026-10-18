-- Migration: 042_billing_webhook_events_processed_at_index.sql
-- Description: Index for the cleanup of processed billing webhook events (#266).
--
-- billing_webhook_events (040) keeps one row per webhook event. Processed rows are only needed while a gateway may
-- still redeliver the event, so after a processed event the webhook helper deletes, in a bounded batch, the processed
-- rows whose "processedAt" is older than the retention (30 days by default; lib/billing/webhook-events.ts). This
-- partial index serves that DELETE, so it does not scan the table. Idempotent.

CREATE INDEX IF NOT EXISTS billing_webhook_events_processed_at_idx
  ON public."billing_webhook_events" ("processedAt")
  WHERE status = 'processed';

COMMENT ON COLUMN public."billing_webhook_events"."processedAt" IS 'When the event was processed; processed rows older than the retention are deleted';
