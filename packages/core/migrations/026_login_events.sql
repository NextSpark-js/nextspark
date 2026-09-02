-- Migration: 026_login_events.sql
-- Description: login_events — per-user device/login history for built-in
--              security email notifications (new-device login alerts).
-- Date: 2026-09-01
-- Issue: #75
--
-- Why 026 (and not 022 as the issue text proposed, nor 025):
--   The issue was written when the migration sequence ended earlier. By the
--   time this branch was authored the sequence already went through
--   024_teams_soft_delete.sql (022 and 023 are taken by rls_runtime_roles and
--   the invitations index), so this migration was originally 025. It was
--   renumbered to 026 when merging to main, because 025 had in the meantime
--   been taken by 025_api_audit_log_nullable_api_key.sql (issue #105).
--
-- What this backs:
--   The security-notifications dispatcher records one row per successful sign-in
--   with a device fingerprint = sha256(normalizedUA | ip/24). A sign-in whose
--   (userId, deviceFingerprint) pair has never been seen is flagged isNew=true
--   and triggers a "new device" email via the auth:security-notification
--   scheduled action. Known fingerprints are still logged (isNew=false) but send
--   no email. The table is also the substrate for a future login-history UI
--   (out of scope here — see issue #75 "Out of scope").
--
-- Append-only: rows are never updated, so there is no "updatedAt"/set_updated_at
-- trigger (unlike mutable entity tables). city/country are nullable for a future
-- geolocation enhancement (also out of scope).

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."login_events" CASCADE;

CREATE TABLE IF NOT EXISTS public."login_events" (
  -- Primary Key (TEXT not UUID — Better Auth convention)
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields
  "userId"            TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,

  -- Entity-specific fields
  "ipAddress"         TEXT,
  "userAgent"         TEXT,
  "deviceFingerprint" TEXT NOT NULL,
  city                TEXT,
  country             TEXT,
  "isNew"             BOOLEAN NOT NULL DEFAULT false,

  -- System fields (append-only: created only, never updated)
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public."login_events"                     IS 'Per-user login/device history backing built-in new-device security email notifications (issue #75).';
COMMENT ON COLUMN public."login_events"."userId"            IS 'Owner of the login event.';
COMMENT ON COLUMN public."login_events"."ipAddress"         IS 'Best-effort client IP captured at sign-in (may be a proxy address).';
COMMENT ON COLUMN public."login_events"."userAgent"         IS 'Raw User-Agent header captured at sign-in.';
COMMENT ON COLUMN public."login_events"."deviceFingerprint" IS 'sha256(normalizedUA | ip/24). Stable across patch-version UA churn and within a /24 network so routine re-logins from the same device do not re-alert.';
COMMENT ON COLUMN public."login_events".city                IS 'Reserved for future geolocation enrichment (nullable, unused today).';
COMMENT ON COLUMN public."login_events".country             IS 'Reserved for future geolocation enrichment (nullable, unused today).';
COMMENT ON COLUMN public."login_events"."isNew"             IS 'True when this (userId, deviceFingerprint) pair had not been seen before this row → a new-device email was queued.';

-- ============================================
-- INDEXES
-- ============================================
-- Most-recent-first history lookups per user (login-history UI, TTL checks).
CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON public."login_events" ("userId", "createdAt" DESC);

-- "Have we seen this fingerprint for this user?" — the new-device decision.
CREATE INDEX IF NOT EXISTS idx_login_events_user_fingerprint
  ON public."login_events" ("userId", "deviceFingerprint");

-- ============================================
-- RLS
-- ============================================
-- A user may read ONLY their own login events; superadmin/developer bypass via
-- can_bypass_rls() (defined in 001). Writes are service-only: the dispatcher
-- inserts with no user GUC (service/bypass pool), matching how session/account
-- rows are written in 002. Mirrors the "self read + service write" pattern.
ALTER TABLE public."login_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Login events self read"      ON public."login_events";
DROP POLICY IF EXISTS "Login events service write"  ON public."login_events";

CREATE POLICY "Login events self read" ON public."login_events"
FOR SELECT TO authenticated
USING (public.can_bypass_rls() OR "userId" = public.get_auth_user_id());

CREATE POLICY "Login events service write" ON public."login_events"
FOR ALL TO authenticated
USING (public.can_bypass_rls())
WITH CHECK (public.can_bypass_rls());
