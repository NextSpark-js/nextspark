// Runs a single theme's migrations end to end against an explicitly-named
// database, to catch problems like #193 (sample data referencing a row no
// migration creates) before they ship. Refuses to run against a database that
// already holds anything, since running a theme's migrations there would mix
// that theme's schema and sample data into whatever is already there.
//
// Usage: VERIFY_THEME_DATABASE_URL=<database-url> pnpm db:verify-theme <theme>
//
// The database URL comes from the environment, never from an argument:
// arguments show up in pnpm's command echo and in the process list, and the
// URL carries the password. The output names only the host and the database.
//
// The migrations run through run-migrations.mjs, the same script
// `pnpm db:migrate` uses, with `--no-env-file` and the theme and database in
// its environment. No file is read or written for that: apps/dev/.env stays
// untouched even if this process is killed mid-run. Runs for different
// themes still can't share a Postgres server at the same time, because the
// core migrations alter cluster-wide roles.
//
// MIGRATE_DATABASE_URL is removed from the child's environment because
// run-migrations.mjs connects to it in preference to DATABASE_URL, which
// would migrate a database this script never checked.

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..', '..', '..', '..'); // scripts/db/ -> core/ -> packages/ -> repo root
const appsDevDir = path.join(repoRoot, 'apps', 'dev');
const runnerPath = path.join(repoRoot, 'packages', 'core', 'scripts', 'db', 'run-migrations.mjs');

const USAGE = 'Usage: VERIFY_THEME_DATABASE_URL=<database-url> pnpm db:verify-theme <theme>';

const args = process.argv.slice(2);
const theme = args[0];
const databaseUrl = process.env.VERIFY_THEME_DATABASE_URL;

// An extra argument, or a theme that looks like a URL, is most likely the
// database URL passed the old way: reject it without printing it.
if (!theme || args.length > 1 || theme.includes('://')) {
  if (theme) console.error('❌ Pass the database URL in VERIFY_THEME_DATABASE_URL, not as an argument.');
  console.error(USAGE);
  process.exit(1);
}

if (!databaseUrl) {
  console.error(`❌ VERIFY_THEME_DATABASE_URL is not set.\n${USAGE}`);
  process.exit(1);
}

let target;
try {
  const url = new URL(databaseUrl);
  target = `${url.host}${url.pathname}`;
} catch {
  console.error('❌ VERIFY_THEME_DATABASE_URL is not a valid URL.');
  process.exit(1);
}

const themeDir = path.join(repoRoot, 'themes', theme);
if (!fs.existsSync(themeDir)) {
  console.error(`❌ Theme "${theme}" not found at ${themeDir}`);
  process.exit(1);
}

// Everything that can be created in a non-system schema: relations (tables,
// views, sequences, indexes), functions and standalone types. Objects that
// belong to an extension don't count, since the server's template database
// can bring extensions along. Functions and types count because the
// migrations' CREATE OR REPLACE would replace them without an error.
const EXISTING_OBJECTS_SQL = `
  SELECT kind, name
    FROM (
      SELECT 'relation' AS kind, n.nspname || '.' || c.relname AS name, n.nspname,
             'pg_class'::regclass AS classid, c.oid AS objid
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      UNION ALL
      SELECT 'function', n.nspname || '.' || p.proname, n.nspname,
             'pg_proc'::regclass, p.oid
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      UNION ALL
      SELECT 'type', n.nspname || '.' || t.typname, n.nspname,
             'pg_type'::regclass, t.oid
        FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typrelid = 0 AND t.typcategory <> 'A'
    ) objects
   WHERE nspname NOT IN ('pg_catalog', 'information_schema')
     AND nspname !~ '^pg_(toast|temp)'
     AND NOT EXISTS (
       SELECT 1 FROM pg_depend d
        WHERE d.classid = objects.classid AND d.objid = objects.objid AND d.deptype = 'e'
     )
   ORDER BY kind, name
   LIMIT 5
`;

async function findExistingObjects(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false, require: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const result = await client.query(EXISTING_OBJECTS_SQL);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`🔎 Verifying theme "${theme}" migrations against ${target}...\n`);

  let existingObjects;
  try {
    existingObjects = await findExistingObjects(databaseUrl);
  } catch (error) {
    console.error(`❌ Could not connect to ${target}: ${error.message}`);
    process.exit(1);
  }

  if (existingObjects.length > 0) {
    const examples = existingObjects.map(({ kind, name }) => `${name} (${kind})`).join(', ');
    console.error(
      `❌ Refusing to run: ${target} already holds objects, for example ${examples}.\n` +
      '   This script only runs against a fresh, empty database, to avoid mixing\n' +
      '   this theme\'s schema and sample data into whatever is already there.'
    );
    process.exit(1);
  }

  const { MIGRATE_DATABASE_URL: _migrateUrl, VERIFY_THEME_DATABASE_URL: _verifyUrl, ...inheritedEnv } = process.env;

  const result = spawnSync(process.execPath, [runnerPath, '--no-env-file'], {
    cwd: appsDevDir,
    stdio: 'inherit',
    env: {
      ...inheritedEnv,
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_ACTIVE_THEME: theme,
    },
  });

  if (result.status !== 0) {
    const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    console.error(`\n❌ Theme "${theme}" migrations failed (${reason}).`);
    process.exit(result.status ?? 1);
  }

  console.log(`\n✅ Theme "${theme}" migrations ran cleanly against ${target}.`);
}

main();
