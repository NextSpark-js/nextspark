#!/usr/bin/env node

/**
 * `nextspark db:demo-reset`: returns a public demo to its sample state. Drops every table of the `public` schema,
 * runs the migrations with the sample data and empties UPLOADS_DIR. `--status` prints the last reset and changes nothing.
 *
 * Destructive, so it refuses to run unless all of this holds, before connecting or changing anything:
 * - NEXTSPARK_DEMO_MODE is exactly `true` and the environment has no real email, payment or storage service;
 * - the database has no table or view in any schema, or an earlier reset marked it (a `_nextspark_demo` table). A database with tables and
 *   no mark is someone's data, so there is no flag to override it.
 *
 * It is a command for a cron on the demo's host, not a scheduled action: those live in the tables it drops, and the
 * migration files and UPLOADS_DIR are on that host.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scriptClient } from './ssl-config.mjs';
import { describeDestination, rememberSecrets, scrub } from './destination.mjs';
import { DEMO_RESET_FLAG } from './sample-data.mjs';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MARK = '_nextspark_demo';
const env = process.env;

function refuse(message) {
  console.error(`❌ ${message} Nothing was changed.`);
  process.exit(1);
}

const unknown = process.argv.slice(2).find(argument => argument !== '--status');
if (unknown) refuse(`Unknown argument: ${JSON.stringify(unknown)}. The only one is --status.`);

let demoMode, storageNames;
try {
  demoMode = await import(pathToFileURL(path.join(CORE, 'dist/lib/demo/mode.js')).href);
  storageNames = await import(pathToFileURL(path.join(CORE, 'dist/lib/media/storage/names.js')).href);
} catch {
  refuse("core's dist/ could not be loaded: build @nextsparkjs/core first.");
}

if (!demoMode.isDemoMode(env)) refuse('db:demo-reset only runs with NEXTSPARK_DEMO_MODE=true.');
const refusal = demoMode.demoModeRefusal(env);
if (refusal) refuse(refusal);

const url = env.MIGRATE_DATABASE_URL || env.DATABASE_URL;
if (!url) refuse('DATABASE_URL is not set.');
rememberSecrets(url, env.DATABASE_URL, env.MIGRATE_DATABASE_URL);
console.log(`🎯 Demo database: ${describeDestination(url)}`);

const client = scriptClient(url);

/** Null when the database has never been reset; `lastReset` is null while a reset is unfinished or after one failed. */
async function readMark() {
  const { rows: [{ exists }] } = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public."${MARK}"`]);
  if (!exists) return null;
  const { rows: [row] } = await client.query(`SELECT last_reset_at AS "lastReset" FROM "${MARK}"`);
  return row ?? { lastReset: null };
}

async function status() {
  const mark = await readMark();
  if (!mark) console.log('Last reset: never (this database has not been reset).');
  else if (!mark.lastReset) console.log('Last reset: unfinished. A reset started and did not complete: run db:demo-reset again.');
  else console.log(`Last reset: ${mark.lastReset.toISOString()}`);
}

async function clearDatabase() {
  const mark = await readMark();
  if (!mark) {
    // Every schema: DROP SCHEMA public CASCADE also takes what elsewhere depends on something in public
    const { rows: [{ relations }] } = await client.query(`SELECT count(*)::int AS relations FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema'`);
    if (relations > 0) refuse(`This database has ${relations} table(s) or view(s) and was not created by db:demo-reset. Point DATABASE_URL at an empty database made for the demo.`);
  }
  // One transaction: the mark exists again the moment the tables are gone, so a reset that fails later can be run again.
  // USAGE for PUBLIC is what a new database's public schema has.
  await client.query(`BEGIN;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT USAGE ON SCHEMA public TO PUBLIC;
    CREATE TABLE "${MARK}" (last_reset_at TIMESTAMPTZ);
    INSERT INTO "${MARK}" (last_reset_at) VALUES (NULL);
    COMMIT;`);
}

function migrateWithSampleData() {
  // --no-env-file: this process already has the environment that was just checked
  const run = spawnSync(process.execPath, [path.join(CORE, 'scripts/db/run-migrations.mjs'), '--no-env-file', DEMO_RESET_FLAG], { stdio: 'inherit', env });
  if (run.status !== 0) throw new Error('the migrations failed; see the output above');
}

/**
 * The sample accounts' password is public here, so none of them keeps a global role, and nothing created with a
 * documented value stays usable: the sample sessions and API keys. The team loses its system-admin flag first, or
 * the role change would take the accounts out of the only team they have (027's trigger).
 */
async function lockSampleAccounts() {
  await client.query(`UPDATE "teams" SET metadata = metadata - 'systemAdmin' WHERE metadata ? 'systemAdmin';
    UPDATE "users" SET role = 'member', "updatedAt" = now() WHERE role IN ('superadmin', 'developer');
    DELETE FROM "session";
    UPDATE "api_key" SET status = 'inactive', "updatedAt" = now();`);
}

/** Only files with a name the server generates, so a wrong UPLOADS_DIR loses nothing else. */
function clearUploads() {
  const dir = path.resolve(env.UPLOADS_DIR.trim());
  if (!fs.existsSync(dir)) return 0;
  const uploads = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && storageNames.isObjectName(entry.name));
  for (const entry of uploads) fs.rmSync(path.join(dir, entry.name));
  return uploads.length;
}

try {
  await client.connect();
  if (process.argv.includes('--status')) {
    await status();
  } else {
    await clearDatabase();
    try {
      migrateWithSampleData();
      await lockSampleAccounts();
    } catch (error) {
      // The sample accounts may be in and not locked yet: an empty database is the only safe thing to leave
      await clearDatabase();
      throw error;
    }
    const removed = clearUploads();
    await client.query(`UPDATE "${MARK}" SET last_reset_at = now()`);
    console.log(`\n✅ Demo reset: sample data restored, ${removed} upload(s) removed.`);
    await status();
  }
  await client.end();
} catch (error) {
  console.error(`❌ Demo reset failed: ${scrub(error.message)}`);
  process.exit(1);
}
