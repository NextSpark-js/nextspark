-- ============================================================================
-- 045 · The migration bookkeeping tables are for the migration role only
-- ============================================================================
-- _migrations, _content_migrations and _entity_migrations record what db:migrate has run. Only the migration
-- role (their owner) reads or writes them, so the runtime roles need no access to them. This takes back what
-- the blanket grants of 022 (to nextspark_app) and a managed host's default privileges (to authenticated and
-- anon) give a table.
--
-- This enables row-level security on each (no policy, so nothing is visible to a role that is subject to it; no
-- FORCE, so the owner that runs the migrations is not) and revokes every privilege on the table, and on its id
-- sequence, from nextspark_app, authenticated and anon where those roles exist.
--
-- A table that does not exist yet is skipped: on a new database _content_migrations and _entity_migrations are
-- created after the core migrations, and db:migrate creates them with these settings. It changes nothing on a
-- table that is already so, takes no lock then, and a table this role does not own is left with a WARNING.
-- scripts/db/migration-ledger.mjs (lockdownLedgers) does the same for the tables the runner creates.

DO $$
DECLARE
  ledger text;
  runtime_role text;
  ledger_oid regclass;
  ledger_sequence text;
BEGIN
  FOREACH ledger IN ARRAY ARRAY['_migrations', '_content_migrations', '_entity_migrations'] LOOP
    BEGIN
      ledger_oid := to_regclass(format('public.%I', ledger));
      CONTINUE WHEN ledger_oid IS NULL;
      IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ledger_oid) THEN
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', ledger_oid);
      END IF;
      ledger_sequence := pg_get_serial_sequence(ledger_oid::text, 'id');
      FOREACH runtime_role IN ARRAY ARRAY['nextspark_app', 'authenticated', 'anon'] LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_role);
        IF has_table_privilege(runtime_role, ledger_oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
          EXECUTE 'REVOKE ALL ON TABLE ' || ledger_oid || ' FROM ' || quote_ident(runtime_role);
        END IF;
        IF ledger_sequence IS NOT NULL AND has_sequence_privilege(runtime_role, ledger_sequence, 'USAGE, SELECT, UPDATE') THEN
          EXECUTE 'REVOKE ALL ON SEQUENCE ' || ledger_sequence || ' FROM ' || quote_ident(runtime_role);
        END IF;
      END LOOP;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'Ledger lockdown: could not restrict % (%). Ask its owner to run: ALTER TABLE % ENABLE ROW LEVEL SECURITY; REVOKE ALL ON % FROM nextspark_app, authenticated, anon;', ledger, SQLERRM, ledger, ledger;
    END;
  END LOOP;
END $$;
