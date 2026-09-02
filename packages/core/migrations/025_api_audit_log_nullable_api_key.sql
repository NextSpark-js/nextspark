-- Migration: 025_api_audit_log_nullable_api_key.sql
-- Description: Allow api_audit_log rows without an API key (#105)
--
-- The generic entity routes (/api/v1/[entity], /api/v1/[entity]/[id]) now
-- write an audit row for every authenticated request, whether it was
-- authenticated with an API key or with a browser session. Session requests
-- have no key, so "apiKeyId" must accept NULL. The foreign key stays as-is:
-- a FK only constrains non-null values.
--
-- Idempotent: DROP NOT NULL on an already-nullable column is a no-op.

ALTER TABLE "api_audit_log" ALTER COLUMN "apiKeyId" DROP NOT NULL;
