-- Migration: 034_media_taxonomy_cleanup_trigger.sql
-- Description: Deleting a media row removes its taxonomy relations, whatever order the migrations ran in.
--
-- 021 creates the cleanup_media_entity_taxonomy trigger only when entity_taxonomy_relations already exists. That table
-- and its cleanup function come from the posts entity migration, which runs after core's, so on a fresh database the
-- trigger was never created and a hard-deleted media item left its relations behind.
--
-- This creates the trigger on media unconditionally, with a core function that removes the relations when the table
-- exists and does nothing otherwise. It runs as the function owner, as the posts entity's cleanup does: the media row
-- the relations' RLS policies would check is already gone. On a database where 021 did create the trigger, it is
-- replaced by this one with the same effect. Idempotent.

CREATE OR REPLACE FUNCTION public.cleanup_media_entity_taxonomy_relations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.entity_taxonomy_relations') IS NOT NULL THEN
    DELETE FROM public."entity_taxonomy_relations"
    WHERE "entityType" = 'media' AND "entityId" = OLD.id::text;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_media_entity_taxonomy ON public."media";

CREATE TRIGGER cleanup_media_entity_taxonomy
AFTER DELETE ON public."media"
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_media_entity_taxonomy_relations();
