-- Migration: 023_team_invitations_pending_email_index.sql
-- Description: Partial functional index supporting the pending-invitation-by-email lookup added for nextspark#78 (hasPendingInvitationForEmail in lib/auth.ts)
-- Date: 2026-07-17

CREATE INDEX IF NOT EXISTS idx_invitations_pending_email_lower
  ON public."team_invitations" (lower(email))
  WHERE status = 'pending';
