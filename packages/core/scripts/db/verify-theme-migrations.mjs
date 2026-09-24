// Runs a single theme's migrations end to end against an explicitly-named
// database, to catch problems like #193 (sample data referencing a row no
// migration creates) before they ship. Refuses to run against a database that
// already holds anything, since running a theme's migrations there would mix
// that theme's schema and sample data into whatever is already there.
//
// Usage: VERIFY_THEME_DATABASE_URL=<database-url> pnpm db:verify-theme <theme>
//
// The theme is looked up among the monorepo's themes and the starter core
// ships to generated projects (see theme-location.mjs). A name that is not a
// theme, or a theme with no migrations, is refused: a run over core's
// migrations alone would pass without saying anything about the theme.
//
// The run reaches past that database: the core migrations create and alter
// cluster-wide roles (see cluster-changes.mjs), which every database on the
// same Postgres server shares. The output names those roles before the
// migrations run, and the run is refused when the server shows signs of being
// in use — one of those roles already exists, another database lives there, or
// the server will not say, or not in time, what is on it.
// VERIFY_THEME_ALLOW_CLUSTER_CHANGES=1 says the server is yours to change and
// runs anyway. A disposable server, one per run, needs neither.
//
// The database URL comes from the environment, never from an argument:
// arguments show up in pnpm's command echo and in the process list, and the
// URL carries the password. The output names only the host and the database.
//
// The migrations run through run-migrations.mjs, the same script
// `pnpm db:migrate` uses. Templates are first extracted into a clean temporary
// root-first project; apps/dev already is one. No .env is read or written.
//
// MIGRATE_DATABASE_URL is removed from the child's environment because
// run-migrations.mjs connects to it in preference to DATABASE_URL, which
// would migrate a database this script never checked.
//
// Every migration runs under a time limit, MIGRATION_TIMEOUT_SECONDS (30 s
// unless set; see migration-time-limit.mjs). A migration that runs past it
// fails the run with the migration's name, and its session on the server is
// ended, instead of leaving the command waiting.

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { GLOBAL_OBJECTS, inspectCluster } from './cluster-changes.mjs';
import { inspectTarget, inspectMaintenanceDatabase } from './inspect-server.mjs';
import { findTheme } from './theme-location.mjs';
import { TIME_LIMIT_VARIABLE, migrationTimeLimit } from './migration-time-limit.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..', '..', '..', '..'); // scripts/db/ -> core/ -> packages/ -> repo root
const runnerPath = path.join(repoRoot, 'packages', 'core', 'scripts', 'db', 'run-migrations.mjs');

const USAGE = 'Usage: VERIFY_THEME_DATABASE_URL=<database-url> pnpm db:verify-theme <theme>';

const ACKNOWLEDGEMENT_VAR = 'VERIFY_THEME_ALLOW_CLUSTER_CHANGES';
const acknowledgesClusterChanges = process.env[ACKNOWLEDGEMENT_VAR] === '1';

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

const located = findTheme(repoRoot, theme);
if (located.error) {
  console.error(`❌ ${located.error}`);
  process.exit(1);
}

// Against an empty database no migration a theme ships takes a second; the
// default leaves a slow runner room many times over, and a migration that needs
// more can be given it.
const DEFAULT_TIME_LIMIT_SECONDS = '30';
const timeLimitSetting = process.env[TIME_LIMIT_VARIABLE] || DEFAULT_TIME_LIMIT_SECONDS;
let timeLimit;
try {
  timeLimit = migrationTimeLimit({ [TIME_LIMIT_VARIABLE]: timeLimitSetting });
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

async function main() {
  console.log(`🔎 Verifying theme "${theme}" (${located.shownDir}, ${located.migrations.length} migration files) against ${target}...\n`);

  let inspection;
  try {
    inspection = await inspectTarget(databaseUrl);
  } catch (error) {
    console.error(`❌ Could not inspect ${target}: ${error.message}`);
    process.exit(1);
  }

  if (inspection.existingObjects.length > 0) {
    const examples = inspection.existingObjects.map(({ kind, name }) => `${name} (${kind})`).join(', ');
    console.error(
      `❌ Refusing to run: ${target} already holds objects, for example ${examples}.\n` +
      '   This script only runs against a fresh, empty database, to avoid mixing\n' +
      '   this theme\'s schema and sample data into whatever is already there.'
    );
    process.exit(1);
  }

  console.log('This run also changes these cluster-wide roles, which every database on this server shares:');
  for (const { role, change } of GLOBAL_OBJECTS) console.log(`   ${role}: ${change}`);
  console.log('');

  const maintenance = await inspectMaintenanceDatabase(databaseUrl);
  const cluster = inspectCluster({ ...inspection, maintenance });
  if (!cluster.disposable && !acknowledgesClusterChanges) {
    console.error(
      `❌ Refusing to run: ${target} is on a Postgres server that is not this run's to change.\n` +
      cluster.reasons.map(reason => `   - ${reason}\n`).join('') +
      '   The roles above are cluster-wide: altering them here reaches every database\n' +
      '   on this server. Point the run at a disposable Postgres server, or, if this\n' +
      `   server is yours to change, re-run it with ${ACKNOWLEDGEMENT_VAR}=1.`
    );
    process.exit(1);
  }
  if (!cluster.disposable) {
    console.log(`⚠️  ${ACKNOWLEDGEMENT_VAR}=1: changing those roles on a server in use (${cluster.reasons.join('; ')}).\n`);
  }

  console.log(`Each migration may run for ${timeLimit.seconds} s; ${TIME_LIMIT_VARIABLE} changes that.\n`);

  const { MIGRATE_DATABASE_URL: _migrateUrl, VERIFY_THEME_DATABASE_URL: _verifyUrl, ...inheritedEnv } = process.env;

  let runDir = located.projectDir;
  let extracted = null;
  if (located.kind === 'template') {
    extracted = fs.mkdtempSync(path.join(os.tmpdir(), `nextspark-template-${theme}-`));
    fs.cpSync(located.sourceDir, extracted, { recursive: true });
    fs.writeFileSync(path.join(extracted, 'nextspark.config.ts'), `export default { plugins: [], template: { name: ${JSON.stringify(theme)}, version: 'test' } }\n`);
    fs.writeFileSync(path.join(extracted, 'package.json'), JSON.stringify({ name: `nextspark-template-${theme}`, private: true, dependencies: { next: '16.3.5' } }, null, 2));
    runDir = extracted;
  }

  const result = spawnSync(process.execPath, [runnerPath, '--no-env-file'], {
    cwd: runDir,
    stdio: 'inherit',
    env: {
      ...inheritedEnv,
      DATABASE_URL: databaseUrl,
      [TIME_LIMIT_VARIABLE]: timeLimitSetting,
    },
  });
  if (extracted) fs.rmSync(extracted, { recursive: true, force: true });

  if (result.status !== 0) {
    const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    console.error(`\n❌ Theme "${theme}" migrations failed (${reason}).`);
    process.exit(result.status ?? 1);
  }

  console.log(`\n✅ Theme "${theme}" migrations ran cleanly against ${target}.`);
}

main();
