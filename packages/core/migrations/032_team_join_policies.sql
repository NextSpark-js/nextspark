-- Migration: 032_team_join_policies.sql
-- Description: On the RLS-enforced connection (the nextspark_app cutover), a user can create a team and an existing
-- user can accept an invitation.
--
-- POST /api/v1/teams and POST /api/v1/team-invitations/:token/accept write on the request user's RLS connection.
-- Before this migration both failed there:
-- - teams_select_policy (010) shows a team only to its members, so the creator could not read back the row the
--   INSERT ... RETURNING had just written;
-- - team_members_insert_policy (008) let a user add a row only to a team they were already a member of, which neither
--   the creator nor the invitee is;
-- - invitations_update_policy (009) had no WITH CHECK, so the USING clause (status = 'pending') also applied to the
--   new row and the invitee could not mark the invitation accepted, declined or expired.
--
-- After it:
-- - a team's owner (teams."ownerId") sees the team row, and a user sees their own membership rows;
-- - a user adds only themself to a team, as its owner while the team they own has no member yet, or with the role of
--   a pending, unexpired invitation to their email. Every other membership is added by the server on the service
--   connection, after its own checks;
-- - the invitee moves their pending invitation to accepted, declined or expired; owners and admins of the team
--   update its invitations as before; nobody changes an invitation's team, email, role, token or inviter.
-- Idempotent.

-- The caller's email, for the invitation checks (users' own RLS is not evaluated inside the policies).
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email) FROM public."users" WHERE id = public.get_auth_user_id();
$$;

-- May the caller add themself to p_team_id with p_role?
CREATE OR REPLACE FUNCTION public.auth_can_join_team(p_team_id TEXT, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role = 'owner' THEN
      EXISTS (SELECT 1 FROM public."teams" t WHERE t.id = p_team_id AND t."ownerId" = public.get_auth_user_id())
      AND NOT EXISTS (SELECT 1 FROM public."team_members" m WHERE m."teamId" = p_team_id)
    ELSE
      EXISTS (
        SELECT 1 FROM public."team_invitations" i
        WHERE i."teamId" = p_team_id
          AND lower(i.email) = public.get_auth_user_email()
          AND i.role = p_role
          AND i.status = 'pending'
          AND i."expiresAt" > now()
      )
  END;
$$;

DROP POLICY IF EXISTS "teams_select_policy" ON public."teams";
CREATE POLICY "teams_select_policy" ON public."teams"
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR "ownerId" = public.get_auth_user_id()
    OR id IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- A user's own membership rows are visible to them, also the one an INSERT ... RETURNING has just written.
DROP POLICY IF EXISTS "team_members_select_policy" ON public."team_members";
CREATE POLICY "team_members_select_policy" ON public."team_members"
  FOR SELECT TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR "teamId" IN (SELECT public.get_user_team_ids(public.get_auth_user_id()))
  );

DROP POLICY IF EXISTS "team_members_insert_policy" ON public."team_members";
CREATE POLICY "team_members_insert_policy" ON public."team_members"
  FOR INSERT TO authenticated
  WITH CHECK (
    "userId" = public.get_auth_user_id()
    AND public.auth_can_join_team("teamId", role)
  );

-- The invitee is matched by email without case, as the accept route compares it.
DROP POLICY IF EXISTS "invitations_select_policy" ON public."team_invitations";
CREATE POLICY "invitations_select_policy" ON public."team_invitations"
  FOR SELECT TO authenticated
  USING (
    lower(email) = public.get_auth_user_email()
    OR "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

DROP POLICY IF EXISTS "invitations_update_policy" ON public."team_invitations";
CREATE POLICY "invitations_update_policy" ON public."team_invitations"
  FOR UPDATE TO authenticated
  USING (
    (lower(email) = public.get_auth_user_email() AND status = 'pending')
    OR "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    (lower(email) = public.get_auth_user_email() AND status IN ('pending', 'accepted', 'declined', 'expired'))
    OR "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
  );

-- An invitation's terms are fixed once it is sent: the join check above trusts its team, email, role and expiry.
CREATE OR REPLACE FUNCTION public.team_invitations_fixed_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."teamId" IS DISTINCT FROM OLD."teamId"
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.token IS DISTINCT FROM OLD.token
     OR NEW."invitedBy" IS DISTINCT FROM OLD."invitedBy"
     OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
    RAISE EXCEPTION 'An invitation''s team, email, role, token, inviter and expiry cannot change'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invitations_fixed_terms ON public."team_invitations";
CREATE TRIGGER team_invitations_fixed_terms
BEFORE UPDATE ON public."team_invitations"
FOR EACH ROW EXECUTE FUNCTION public.team_invitations_fixed_terms();

-- Joining a team consumes the invitations to it: a member removed later cannot rejoin with the same invitation.
CREATE OR REPLACE FUNCTION public.team_members_claim_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public."team_invitations" i
  SET status = 'accepted', "acceptedAt" = COALESCE(i."acceptedAt", now()), "updatedAt" = now()
  FROM public."users" u
  WHERE u.id = NEW."userId" AND i."teamId" = NEW."teamId" AND lower(i.email) = lower(u.email) AND i.status = 'pending';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS team_members_claim_invitations ON public."team_members";
CREATE TRIGGER team_members_claim_invitations
AFTER INSERT ON public."team_members"
FOR EACH ROW EXECUTE FUNCTION public.team_members_claim_invitations();
