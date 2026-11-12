-- Migration: 004_social_audit_logs_team.sql
-- Plugin: social-media-publisher
--
-- The audit-logs entity is read through core's generic entity API, which selects "teamId" and "updatedAt" and
-- filters by team. This gives the table both columns and the team-isolation policies core's entities use.
--
-- - "teamId": the team a row belongs to. The plugin's routes fill it from now on (the team of the entity the account
--   is assigned to, else the request's team). Existing rows take the team of their user when the user belongs to
--   exactly one team (that is not deleted); a user in several teams leaves it NULL rather than showing an action to
--   a team it may not belong to. Such a row is not lost: a superadmin still reads it, and an UPDATE can assign it.
-- - "updatedAt": the row's "createdAt" for existing rows (a log row is never changed), now() for new ones.
-- - Policies: a member of the row's team reads it; a user inserts rows of their own in one of their teams; no one
--   updates a row; only a superadmin (or a developer) deletes. What each team role may see is the project's
--   permissions.config.ts (`audit-logs.list` / `audit-logs.read`), checked by the API.
--
-- Idempotent: every statement can run again without changing what the first run did.

ALTER TABLE public."social_audit_logs"
  ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

UPDATE public."social_audit_logs" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE public."social_audit_logs"
  ALTER COLUMN "updatedAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Backfill: the only team of the row's user
UPDATE public."social_audit_logs" l
SET "teamId" = only_team."teamId"
FROM (
  SELECT tm."userId", min(tm."teamId") AS "teamId"
  FROM public."team_members" tm
  JOIN public."teams" t ON t.id = tm."teamId" AND t."deletedAt" IS NULL
  GROUP BY tm."userId"
  HAVING count(*) = 1
) only_team
WHERE l."teamId" IS NULL AND l."userId" = only_team."userId";

CREATE INDEX IF NOT EXISTS idx_social_audit_logs_team_created
  ON public."social_audit_logs"("teamId", "createdAt" DESC);

-- Policies: the ones of 001 (renamed by 003) read app.current_user_id, a setting the app never sets
DROP POLICY IF EXISTS "social_audit_logs_select_own" ON public."social_audit_logs";
DROP POLICY IF EXISTS "social_audit_logs_insert_system" ON public."social_audit_logs";
DROP POLICY IF EXISTS "social_audit_logs_delete_admin" ON public."social_audit_logs";
DROP POLICY IF EXISTS "social_audit_logs_select_team" ON public."social_audit_logs";
DROP POLICY IF EXISTS "social_audit_logs_insert_team" ON public."social_audit_logs";
DROP POLICY IF EXISTS "social_audit_logs_delete_superadmin" ON public."social_audit_logs";

ALTER TABLE public."social_audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_audit_logs_select_team"
  ON public."social_audit_logs"
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_superadmin())
    OR "teamId" = ANY ((SELECT public.get_user_team_ids())::text[])
  );

CREATE POLICY "social_audit_logs_insert_team"
  ON public."social_audit_logs"
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_superadmin())
    OR (
      "userId" = (SELECT public.get_auth_user_id())
      AND "teamId" = ANY ((SELECT public.get_user_team_ids())::text[])
    )
  );

-- No UPDATE policy: a log row is not changed

CREATE POLICY "social_audit_logs_delete_superadmin"
  ON public."social_audit_logs"
  FOR DELETE TO authenticated
  USING ((SELECT public.is_superadmin()));

DROP TRIGGER IF EXISTS social_audit_logs_set_updated_at ON public."social_audit_logs";
CREATE TRIGGER social_audit_logs_set_updated_at
  BEFORE UPDATE ON public."social_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nextspark_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_audit_logs" TO nextspark_app;
  END IF;
END $$;

COMMENT ON COLUMN public."social_audit_logs"."teamId" IS
  'Team the action belongs to (the team of the entity the account is assigned to, else the request''s team). NULL only for rows written before the column whose user was in several teams.';
