-- Migration: 029_sample_accounts_outside_development.sql
-- Description: sample accounts keep no usable credentials outside development
--
-- Sample data (090_sample_data.sql and the projects' *sample_data* files) is
-- only applied by an explicit development opt-in (`nextspark db:seed`,
-- `--sample-data` or NEXTSPARK_SEED_SAMPLE_DATA=1). Databases migrated before
-- that may still hold the sample accounts. This migration finds them by the
-- sample password, never by name, so a renamed account is found and an account
-- whose password was changed is left alone; for each one it:
--   - removes the sample password (its "credential" account row),
--   - removes its sessions,
--   - deactivates its API keys (status 'inactive'; deleting them would delete
--     their api_audit_log rows),
--   - sets its global role to 'member' (027's trigger then removes it from the
--     System Admin Team, as for any user who loses that role).
-- It also removes the sample sessions and deactivates the sample API key by
-- their fixed values, whoever owns them now. Nothing else is changed.
--
-- It runs once, everywhere, except in a development run that opted into sample
-- data (the runner sets nextspark.seed_sample_data to 'on' then), where those
-- accounts are wanted. To keep using one of them deliberately, give it a new
-- password before upgrading; to restore one afterwards, set its role back and
-- reset its password.

DO $$
DECLARE
  sample_passwords CONSTANT TEXT[] := ARRAY[
    '22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f',
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866'
  ];
  sample_session_tokens CONSTANT TEXT[] := ARRAY['tmt_superadmin_session_token_001', 'tmt_developer_session_token_001'];
  sample_key_hashes CONSTANT TEXT[] := ARRAY[
    '205f13ae4d2e18df417e61123bb84030c124fcb5013699046379ae1b5ec04324',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  ];
  sample_users TEXT[];
BEGIN
  IF current_setting('nextspark.seed_sample_data', true) = 'on' THEN
    RAISE NOTICE 'Sample accounts: kept (development run with sample data).';
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT "userId"), '{}') INTO sample_users
  FROM "account"
  WHERE "providerId" = 'credential' AND "password" = ANY (sample_passwords);

  DELETE FROM "account" WHERE "providerId" = 'credential' AND "password" = ANY (sample_passwords);
  DELETE FROM "session" WHERE "userId" = ANY (sample_users) OR token = ANY (sample_session_tokens);
  UPDATE "api_key" SET status = 'inactive', "updatedAt" = now()
  WHERE status IS DISTINCT FROM 'inactive' AND ("userId" = ANY (sample_users) OR "keyHash" = ANY (sample_key_hashes));
  UPDATE "users" SET role = 'member', "updatedAt" = now()
  WHERE id = ANY (sample_users) AND role <> 'member';

  RAISE NOTICE 'Sample accounts: % disabled (no password, sessions or active API keys; role member).', cardinality(sample_users);
END $$;
