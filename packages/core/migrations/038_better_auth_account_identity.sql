-- Migration: 038_better_auth_account_identity.sql
-- Description: the auth tables Better Auth 1.6 and 1.7 both accept.
--
-- - account.issuer: Better Auth 1.7.0 to 1.7.2 added it NOT NULL, with a unique index on (issuer, "accountId"); 1.7.3
--   removed both, and no other version writes the column. A project whose schema one of those versions generated
--   cannot create an account (1.6), or answers every auth call with a schema error (1.7.3 and later). The column and its
--   values stay; it becomes nullable, and every unique index or constraint that includes it is dropped.
-- - account ("providerId", "accountId") is unique, as 002 declares. A table Better Auth created before 002 ran kept
--   no such constraint; it is added here, and the migration stops if rows already share a key (resolve them first).
-- - users.name: Better Auth expects a string. 002's trigger fills it on insert; a row without one gets '' (or its
--   first and last names), and the column defaults to ''. It stays nullable.
-- Idempotent; on a schema 002 created it only sets the default of users.name.

DO $$
DECLARE
  ix record;
  dupes integer;
BEGIN
  IF to_regclass('"account"') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"account"'::regclass AND attname = 'issuer' AND NOT attisdropped
  ) THEN
    FOR ix IN
      SELECT i.indexrelid::regclass AS index_name, c.conname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) AND a.attname = 'issuer'
      LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid AND c.conrelid = i.indrelid
      WHERE i.indrelid = '"account"'::regclass AND i.indisunique
    LOOP
      IF ix.conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE "account" DROP CONSTRAINT %I', ix.conname);
      ELSE
        EXECUTE format('DROP INDEX %s', ix.index_name);
      END IF;
    END LOOP;
    ALTER TABLE "account" ALTER COLUMN issuer DROP NOT NULL;
  END IF;

  -- any unique index on exactly these two columns, in either order
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = '"account"'::regclass AND i.indisunique AND i.indpred IS NULL AND i.indnkeyatts = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      ) = ARRAY['accountId', 'providerId']
  ) THEN
    SELECT count(*) INTO dupes FROM (
      SELECT 1 FROM "account" GROUP BY "providerId", "accountId" HAVING count(*) > 1
    ) d;
    IF dupes > 0 THEN
      RAISE EXCEPTION 'account has % ("providerId", "accountId") key(s) shared by more than one row', dupes
        USING HINT = 'List them with: SELECT "providerId", "accountId", count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1; '
          'resolve each one (see the Better Auth 1.7 upgrade guide, "Account identity keeps the provider key"), then run the migrations again.';
    END IF;
    CREATE UNIQUE INDEX "account_providerId_accountId_uidx" ON "account" ("providerId", "accountId");
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"users"') IS NULL THEN
    RETURN;
  END IF;
  UPDATE "users"
  SET name = trim(concat_ws(' ', "firstName", "lastName"))
  WHERE name IS NULL;
  ALTER TABLE "users" ALTER COLUMN name SET DEFAULT '';
END $$;
