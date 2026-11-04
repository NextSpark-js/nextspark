-- Migration: 044_credential_account_id_is_user_id.sql
-- Description: a "credential" account row carries the user's id as its "accountId".
--
-- Better Auth 1.7 signs a user in with a password only when the credential account's "accountId" is the id of the
-- user; Better Auth 1.6 matched on "providerId" alone. Rows written with another value, such as the email (the sample
-- accounts of core and the project templates up to 0.1.0-beta.200, or a script that imported users), answer
-- "Invalid email or password" with the right password. This sets "accountId" = "userId" on those rows.
--
-- Left as they are:
-- - every provider other than 'credential' (OAuth accounts keep the id the provider gave),
-- - the credential rows of a user that has more than one: which one holds the password in use cannot be told, so
--   nothing is guessed (a warning counts them; list them with
--   SELECT "userId" FROM account WHERE "providerId" = 'credential' GROUP BY 1 HAVING count(*) > 1, keep the right row
--   and run the migrations again, or set "accountId" by hand),
-- - a row whose target key ("providerId", "accountId") = ('credential', "userId") another row already holds, since
--   that pair is unique (see 038).
-- Idempotent: a second run finds nothing to change.

DO $$
DECLARE
  fixed integer;
  ambiguous integer;
  taken integer;
BEGIN
  IF to_regclass('"account"') IS NULL THEN
    RETURN;
  END IF;

  UPDATE "account" a
  SET "accountId" = a."userId", "updatedAt" = now()
  WHERE a."providerId" = 'credential'
    AND a."accountId" IS DISTINCT FROM a."userId"
    AND (SELECT count(*) FROM "account" c WHERE c."providerId" = 'credential' AND c."userId" = a."userId") = 1
    AND NOT EXISTS (
      SELECT 1 FROM "account" t WHERE t."providerId" = 'credential' AND t."accountId" = a."userId" AND t.id <> a.id
    );
  GET DIAGNOSTICS fixed = ROW_COUNT;

  -- what is left, counted once: users with several credential rows, and single rows whose target key is taken
  SELECT count(DISTINCT a."userId") FILTER (WHERE n.cnt > 1), count(*) FILTER (WHERE n.cnt = 1)
  INTO ambiguous, taken
  FROM "account" a
  JOIN (SELECT "userId", count(*) AS cnt FROM "account" WHERE "providerId" = 'credential' GROUP BY "userId") n USING ("userId")
  WHERE a."providerId" = 'credential' AND a."accountId" IS DISTINCT FROM a."userId";

  IF ambiguous + taken > 0 THEN
    RAISE WARNING 'Credential accounts: % set to accountId = userId; % user(s) with several credential rows and % row(s) whose target key is taken left unchanged. Those users cannot sign in with a password on Better Auth 1.7: keep one credential row per user and set its "accountId" to the user id (see the upgrade guide), then run db:migrate again.',
      fixed, ambiguous, taken;
  ELSE
    RAISE NOTICE 'Credential accounts: % set to accountId = userId.', fixed;
  END IF;
END $$;
