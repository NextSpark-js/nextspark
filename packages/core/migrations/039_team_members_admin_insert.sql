-- Migration: 039_team_members_admin_insert.sql
-- Description: On the RLS-enforced connection (the nextspark_app cutover), a team's owner or admin adds a member.
--
-- 032 left team_members_insert_policy to self-join only (an invitation's role, or the owner of an empty team they
-- own), so a project that adds a member as the acting user, not on the service connection, was refused. INSERT now
-- also accepts the hierarchy 033 gave UPDATE and DELETE, auth_can_manage_member("teamId", role):
-- - the owner adds any role but owner; an admin adds any role but owner and admin;
-- - a member, a viewer or anyone outside the team adds nobody;
-- - self-join is unchanged.
-- That is the API's rule: POST /api/v1/teams/:teamId/members invites a role strictly below the inviter's (with core's
-- roles, the owner invites admin, member and viewer, an admin invites member and viewer). The API also checks the
-- theme's team.members.invite permission and role hierarchy, which RLS cannot see, as for 033's UPDATE and DELETE.
-- Core itself still adds members on the service connection, after its own checks.
-- Idempotent.

DROP POLICY IF EXISTS "team_members_insert_policy" ON public."team_members";
CREATE POLICY "team_members_insert_policy" ON public."team_members"
  FOR INSERT TO authenticated
  WITH CHECK (
    ("userId" = public.get_auth_user_id() AND public.auth_can_join_team("teamId", role))
    OR public.auth_can_manage_member("teamId", role)
  );
