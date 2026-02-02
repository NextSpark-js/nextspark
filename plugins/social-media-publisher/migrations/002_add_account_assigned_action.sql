-- Migration: Add account_assigned action to audit_logs CHECK constraint
-- Description: Adds 'account_assigned' as a valid action for when accounts are linked to clients
-- Author: Claude
-- Date: 2026-02-01

-- Drop the existing CHECK constraint
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_action_check";

-- Re-create with the additional action
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_action_check"
  CHECK (action IN (
    'account_connected',
    'account_disconnected',
    'account_assigned',
    'post_published',
    'post_failed',
    'token_refreshed'
  ));

COMMENT ON COLUMN "audit_logs".action IS
  'Action type: account_connected (OAuth), account_assigned (linked to client), account_disconnected, post_published, post_failed, token_refreshed';
