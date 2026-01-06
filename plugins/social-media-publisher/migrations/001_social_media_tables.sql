-- Migration: 009_social_media_publisher.sql
-- Description: Tables for social media publishing plugin
-- Date: 2025-10-20
-- Plugin: social-media-publisher

-- ============================================
-- TABLES
-- ============================================

-- Social Accounts Table
-- Stores OAuth-connected social media accounts for publishing
-- Supports multiple accounts per platform per user
CREATE TABLE IF NOT EXISTS "social_accounts" (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"                    TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  platform                    TEXT NOT NULL CHECK (platform IN ('instagram_business', 'facebook_page')),
  "platformAccountId"         TEXT NOT NULL,
  "username"                  TEXT NOT NULL,
  "accessToken"               TEXT NOT NULL, -- Encrypted (format: encrypted:iv:keyId)
  "tokenExpiresAt"            TIMESTAMPTZ NOT NULL,
  permissions                 JSONB DEFAULT '[]'::jsonb,
  "accountMetadata"           JSONB DEFAULT '{}'::jsonb,
  "isActive"                  BOOLEAN DEFAULT true,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE("platformAccountId") -- Prevent same account connected multiple times
);

-- Audit Logs Table
-- Tracks all actions performed through social media plugin
-- Note: accountId references clients_social_platforms.id (not enforced with FK to preserve historical logs)
CREATE TABLE IF NOT EXISTS "audit_logs" (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"                    TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  "accountId"                 UUID, -- References clients_social_platforms.id (nullable, no FK to preserve historical logs)
  action                      TEXT NOT NULL CHECK (action IN (
    'account_connected',
    'account_disconnected',
    'post_published',
    'post_failed',
    'token_refreshed',
    'token_refresh_failed'
  )),
  details                     JSONB DEFAULT '{}'::jsonb,
  "ipAddress"                 TEXT,
  "userAgent"                 TEXT,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Social Accounts indexes
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform
  ON "social_accounts"("userId", platform);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_id_unique
  ON "social_accounts"("platformAccountId");

CREATE INDEX IF NOT EXISTS idx_social_accounts_active
  ON "social_accounts"("isActive");

CREATE INDEX IF NOT EXISTS idx_social_accounts_token_expiry
  ON "social_accounts"("tokenExpiresAt");

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON "audit_logs"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_audit_logs_account_action
  ON "audit_logs"("accountId", action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON "audit_logs"(action, "createdAt");

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc
  ON "audit_logs"("createdAt" DESC);

-- ============================================
-- RLS (Enable)
-- ============================================

ALTER TABLE "social_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES
-- ============================================

-- Social Accounts Policies
-- Users can only see and manage their own accounts
CREATE POLICY "social_accounts_select_own"
  ON "social_accounts" FOR SELECT
  USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY "social_accounts_insert_own"
  ON "social_accounts" FOR INSERT
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY "social_accounts_update_own"
  ON "social_accounts" FOR UPDATE
  USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY "social_accounts_delete_own"
  ON "social_accounts" FOR DELETE
  USING ("userId" = current_setting('app.current_user_id', true));

-- Audit Logs Policies
-- Users can only view their own audit logs
CREATE POLICY "audit_logs_select_own"
  ON "audit_logs" FOR SELECT
  USING ("userId" = current_setting('app.current_user_id', true));

-- Only system can insert audit logs
CREATE POLICY "audit_logs_insert_system"
  ON "audit_logs" FOR INSERT
  WITH CHECK (true); -- System role bypasses RLS

-- Audit logs are immutable (no updates)
-- No update policy = no one can update

-- Only admins can delete old audit logs
CREATE POLICY "audit_logs_delete_admin"
  ON "audit_logs" FOR DELETE
  USING (current_setting('app.current_user_role', true) = 'admin');

-- ============================================
-- TRIGGERS (updatedAt)
-- ============================================

DROP TRIGGER IF EXISTS social_accounts_set_updated_at ON "social_accounts";
CREATE TRIGGER social_accounts_set_updated_at
BEFORE UPDATE ON "social_accounts"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Note: audit_logs doesn't need updatedAt trigger (immutable)

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE "social_accounts" IS
  'OAuth-connected social media accounts for publishing (Instagram Business & Facebook Pages)';

COMMENT ON COLUMN "social_accounts"."accessToken" IS
  'Encrypted OAuth access token (format: encrypted:iv:keyId using AES-256-GCM)';

COMMENT ON COLUMN "social_accounts"."platformAccountId" IS
  'Instagram Business Account ID or Facebook Page ID from platform';

COMMENT ON COLUMN "social_accounts"."permissions" IS
  'Array of granted OAuth scopes (e.g., ["instagram_business_basic", "instagram_business_content_publish"])';

COMMENT ON COLUMN "social_accounts"."accountMetadata" IS
  'Platform-specific metadata: profile picture URL, follower count, linked page info, etc.';

COMMENT ON TABLE "audit_logs" IS
  'Immutable audit trail for all social media actions (security & compliance)';

COMMENT ON COLUMN "audit_logs"."accountId" IS
  'References social platform account ID (clients_social_platforms.id). Nullable to preserve historical logs even after account deletion.';

COMMENT ON COLUMN "audit_logs".details IS
  'Action details: platform, success status, error messages, post IDs, etc.';
