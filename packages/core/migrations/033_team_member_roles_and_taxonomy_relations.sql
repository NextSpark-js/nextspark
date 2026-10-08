-- Migration: 033_team_member_roles_and_taxonomy_relations.sql
-- Description: The RLS policies of team_members and entity_taxonomy_relations follow the API's rules.
--
-- team_members (008 let any member of a team update or delete any row of it):
-- - a role is changed by the team's owner, or by an admin on a row that is neither owner nor admin;
-- - nobody sets or changes the owner row through RLS: an ownership transfer runs on the service connection;
-- - a member is removed by the owner, or by an admin when the row is neither owner nor admin; anyone but the owner
--   leaves a team on their own (deleting a user removes their memberships through the foreign key's cascade);
-- - a row never moves to another user or team (adding someone is 032's insert policy).
-- entity_taxonomy_relations (the posts entity migration let any signed-in user read, link and unlink every row):
-- - a relation is read, added and removed only when its entity belongs to one of the caller's teams (or to the caller,
--   for an entity table with "userId" and no "teamId"), and its taxonomy has no team or the entity's team. The entity
--   table is the one named by "entityType" (an entity's slug, which is its table name unless the entity sets another
--   tableName: such an entity's relations are refused on the RLS connection);
-- - is_superadmin() keeps every row, as on the entity tables;
-- - the anonymous read of the relations of published posts and pages is unchanged;
-- - the cleanup trigger that removes an entity's relations after the entity is deleted runs as the table owner, since
--   the entity it checks is already gone.
-- Idempotent. The entity_taxonomy_relations part runs only when the table exists; the posts entity migration of the
-- templates declares the same policies for projects created later.

CREATE OR REPLACE FUNCTION public.auth_team_role(p_team_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public."team_members" WHERE "teamId" = p_team_id AND "userId" = public.get_auth_user_id();
$$;

-- May the caller change or remove a member row that has p_role, in p_team_id?
CREATE OR REPLACE FUNCTION public.auth_can_manage_member(p_team_id TEXT, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_role IS DISTINCT FROM 'owner' AND CASE public.auth_team_role(p_team_id)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN p_role IS DISTINCT FROM 'admin'
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "team_members_update_policy" ON public."team_members";
CREATE POLICY "team_members_update_policy" ON public."team_members"
  FOR UPDATE TO authenticated
  USING (public.auth_can_manage_member("teamId", role))
  WITH CHECK (public.auth_can_manage_member("teamId", role));

DROP POLICY IF EXISTS "team_members_delete_policy" ON public."team_members";
CREATE POLICY "team_members_delete_policy" ON public."team_members"
  FOR DELETE TO authenticated
  USING (
    public.auth_can_manage_member("teamId", role)
    OR ("userId" = public.get_auth_user_id() AND role <> 'owner')
  );

CREATE OR REPLACE FUNCTION public.team_members_fixed_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."teamId" IS DISTINCT FROM OLD."teamId" OR NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'A membership''s team and user cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_fixed_identity ON public."team_members";
CREATE TRIGGER team_members_fixed_identity
BEFORE UPDATE ON public."team_members"
FOR EACH ROW EXECUTE FUNCTION public.team_members_fixed_identity();

-- May the caller see or write the relation of entity p_entity_id (table p_entity_type) to taxonomy p_taxonomy_id?
-- ponytail: one dynamic lookup of the entity per row checked; fine for the relations of a page of entities, add an
-- index-friendly per-entity policy if a theme lists thousands of relations on the RLS connection.
CREATE OR REPLACE FUNCTION public.auth_can_use_entity_taxonomy(p_entity_type TEXT, p_entity_id TEXT, p_taxonomy_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table REGCLASS;
  v_team TEXT;
  v_owner TEXT;
BEGIN
  IF public.is_superadmin() THEN
    RETURN TRUE;
  END IF;
  v_table := to_regclass(format('public.%I', p_entity_type));
  IF v_table IS NULL THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = v_table AND attname = 'teamId' AND NOT attisdropped) THEN
    EXECUTE format('SELECT "teamId"::text FROM %s WHERE id::text = $1', v_table) INTO v_team USING p_entity_id;
    IF v_team IS NULL OR NOT (v_team = ANY (public.get_user_team_ids())) THEN
      RETURN FALSE;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = v_table AND attname = 'userId' AND NOT attisdropped) THEN
    EXECUTE format('SELECT "userId"::text FROM %s WHERE id::text = $1', v_table) INTO v_owner USING p_entity_id;
    IF v_owner IS DISTINCT FROM public.get_auth_user_id() THEN
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.taxonomies t
    WHERE t.id = p_taxonomy_id AND (t."teamId" IS NULL OR t."teamId" = v_team)
  );
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.entity_taxonomy_relations') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Entity taxonomy relations authenticated read" ON public."entity_taxonomy_relations";
  DROP POLICY IF EXISTS "Entity taxonomy relations authenticated insert" ON public."entity_taxonomy_relations";
  DROP POLICY IF EXISTS "Entity taxonomy relations authenticated delete" ON public."entity_taxonomy_relations";

  CREATE POLICY "Entity taxonomy relations authenticated read"
  ON public."entity_taxonomy_relations"
  FOR SELECT TO authenticated
  USING (public.auth_can_use_entity_taxonomy("entityType", "entityId", "taxonomyId"));

  CREATE POLICY "Entity taxonomy relations authenticated insert"
  ON public."entity_taxonomy_relations"
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_can_use_entity_taxonomy("entityType", "entityId", "taxonomyId"));

  CREATE POLICY "Entity taxonomy relations authenticated delete"
  ON public."entity_taxonomy_relations"
  FOR DELETE TO authenticated
  USING (public.auth_can_use_entity_taxonomy("entityType", "entityId", "taxonomyId"));

  IF to_regprocedure('public.cleanup_entity_taxonomy_relations()') IS NOT NULL THEN
    ALTER FUNCTION public.cleanup_entity_taxonomy_relations() SECURITY DEFINER SET search_path = public;
  END IF;
END $$;
