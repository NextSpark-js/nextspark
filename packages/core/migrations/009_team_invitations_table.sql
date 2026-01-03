-- Migration: 011_team_invitations_table.sql
-- Description: Team invitations table with indexes, triggers, and RLS policies
-- Date: 2025-11-26

-- ============================================
-- TEAM INVITATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public."team_invitations" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role team_role NOT NULL DEFAULT 'member',
  status invitation_status NOT NULL DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  "invitedBy" TEXT NOT NULL REFERENCES public."users"(id),
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  "acceptedAt" TIMESTAMPTZ,
  "declinedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation: email format
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

  -- Only one pending invitation per email and team
  CONSTRAINT unique_pending_invitation UNIQUE ("teamId", email, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- ============================================
-- TEAM INVITATIONS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invitations_team ON public."team_invitations"("teamId");
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public."team_invitations"(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public."team_invitations"(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public."team_invitations"(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires
  ON public."team_invitations"("expiresAt")
  WHERE status = 'pending';

-- Partial unique index for pending invitations only
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
  ON public."team_invitations" ("teamId", email)
  WHERE status = 'pending';

-- ============================================
-- TEAM INVITATIONS TRIGGERS
-- ============================================

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS team_invitations_set_updated_at ON public."team_invitations";
CREATE TRIGGER team_invitations_set_updated_at
BEFORE UPDATE ON public."team_invitations"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-expire invitations
CREATE OR REPLACE FUNCTION auto_expire_invitations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW."expiresAt" <= now() THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_expire_invitations_trigger ON public."team_invitations";
CREATE TRIGGER auto_expire_invitations_trigger
BEFORE UPDATE ON public."team_invitations"
FOR EACH ROW EXECUTE FUNCTION auto_expire_invitations();

-- ============================================
-- TEAM INVITATIONS ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public."team_invitations" ENABLE ROW LEVEL SECURITY;

-- Invitations: visible to invited user or team members
CREATE POLICY "invitations_select_policy" ON public."team_invitations"
  FOR SELECT TO authenticated
  USING (
    -- User is the invitee
    email = (SELECT email FROM public."users" WHERE id = public.get_auth_user_id())
    OR
    -- User is a member of the team
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- Invitations: owners and admins can create invitations
CREATE POLICY "invitations_insert_policy" ON public."team_invitations"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
    AND "invitedBy" = public.get_auth_user_id()
    AND status = 'pending'
  );

-- Invitations: can be updated by invitee (accept/decline) or team admins (cancel)
CREATE POLICY "invitations_update_policy" ON public."team_invitations"
  FOR UPDATE TO authenticated
  USING (
    -- Invitee can accept/decline
    (email = (SELECT email FROM public."users" WHERE id = public.get_auth_user_id())
     AND status = 'pending')
    OR
    -- Team admins can cancel
    ("teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    ))
  );

-- Invitations: team admins can delete
CREATE POLICY "invitations_delete_policy" ON public."team_invitations"
  FOR DELETE TO authenticated
  USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  );
