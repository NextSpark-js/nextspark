-- Migration: 010_team_members_table.sql
-- Description: Team members table with indexes, triggers, and RLS policies
-- Date: 2025-11-26

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public."team_members" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  "invitedBy" TEXT REFERENCES public."users"(id),
  "joinedAt" TIMESTAMPTZ DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user can only have one role per team
  UNIQUE("teamId", "userId")
);

-- ============================================
-- TEAM MEMBERS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public."team_members"("teamId");
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public."team_members"("userId");
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public."team_members"(role);
CREATE INDEX IF NOT EXISTS idx_team_members_joined ON public."team_members"("joinedAt");

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_team_members_user_role
  ON public."team_members"("userId", role);

-- ============================================
-- TEAM MEMBERS TRIGGERS
-- ============================================

-- Trigger for updatedAt
DROP TRIGGER IF EXISTS team_members_set_updated_at ON public."team_members";
CREATE TRIGGER team_members_set_updated_at
BEFORE UPDATE ON public."team_members"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TEAM MEMBERS ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public."team_members" ENABLE ROW LEVEL SECURITY;

-- Team members: visible to members of the same team
CREATE POLICY "team_members_select_policy" ON public."team_members"
  FOR SELECT TO authenticated
  USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- Team members: owners and admins can add members
CREATE POLICY "team_members_insert_policy" ON public."team_members"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  );

-- Team members: owners and admins can update roles
CREATE POLICY "team_members_update_policy" ON public."team_members"
  FOR UPDATE TO authenticated
  USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  );

-- Team members: owners and admins can remove members (except themselves)
CREATE POLICY "team_members_delete_policy" ON public."team_members"
  FOR DELETE TO authenticated
  USING (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
    -- Cannot remove yourself
    AND "userId" != public.get_auth_user_id()
  );
