import fs from "fs";
import path from "path";
import { migrationTimeLimit, migrationClient, ignoredParametersNotice, runAndRecordMigration, migrationFailure } from './migration-time-limit.mjs';
import { getConfig } from '../build/registry/config.mjs';
import { isSampleDataMigration, sampleDataPolicy } from './sample-data.mjs';
import { compareMigrations } from './migration-order.mjs';
import { collectAllMigrations, collectCoreMigrations } from './migration-files.mjs';
import { LEDGERS, ledgerFiles, ledgerFindings, readLedger, ensureHashColumns, lockdownLedgers, editedReport, renamedReport, migrationHash, HASH_COLUMN } from './migration-ledger.mjs';
import { setProjectEnv } from './ssl-config.mjs';
import { describeDestination, rememberSecrets, scrub, unexpectedTarget } from './destination.mjs';
import { nestedSlugsSetting } from './nested-slugs.mjs';
import { authSchemaProblems, authSchemaReport } from './check-auth-schema.mjs';

const projectConfig = getConfig();
const projectRoot = projectConfig.projectRoot;
const packageRoot = projectConfig.coreDir;
const PROJECT_NAME = projectConfig.projectName;

// An exported variable beats the project .env (as dotenv, Next.js and Prisma do): the .env
// only fills what the environment leaves unset. `--no-env-file` skips the .env file, so the
// connection comes only from the environment this process was started with (the template
// verifier uses it that way).
const envPath = path.join(projectRoot, '.env');
const readEnvFile = !process.argv.includes('--no-env-file');

let DATABASE_URL = process.env.DATABASE_URL || null;
// Migrations and seeds run as the table OWNER. After the runtime cutover the app
// connects DATABASE_URL as the non-owner `nextspark_app` role, so the owner
// credential for migrations is provided separately via MIGRATE_DATABASE_URL.
// Falls back to DATABASE_URL when unset (pre-cutover: same owner connection).
let MIGRATE_DATABASE_URL = process.env.MIGRATE_DATABASE_URL || null;
let MIGRATION_TIMEOUT_SECONDS = process.env.MIGRATION_TIMEOUT_SECONDS;
// `--legacy-theme <theme>`: the theme a 0.x project was migrated from, needed only when its database recorded the
// migrations to take over under several themes (see legacyTheme below). A root-first project reads no variable for it.
const legacyThemeArgument = process.argv.findIndex(arg => arg === '--legacy-theme' || arg.startsWith('--legacy-theme='));
const LEGACY_THEME_FLAG = legacyThemeArgument < 0 ? null
  : process.argv[legacyThemeArgument].startsWith('--legacy-theme=') ? process.argv[legacyThemeArgument].slice('--legacy-theme='.length)
    : process.argv[legacyThemeArgument + 1] ?? '';
if (LEGACY_THEME_FLAG !== null && (LEGACY_THEME_FLAG === '' || LEGACY_THEME_FLAG.startsWith('-'))) {
  console.error('❌ --legacy-theme needs the name of the theme the project was migrated from: --legacy-theme <theme>');
  process.exit(1);
}
// `--strict`: an applied migration that was edited stops the run before anything is applied, instead of a warning (#428)
const STRICT = process.argv.includes('--strict');
// `--dry-run`: connect, list the migrations a real run would apply, in run order, and write nothing, not even the ledger tables (#429)
const DRY_RUN = process.argv.includes('--dry-run');
// `--expect-database <name>` and `--expect-host <host>`: stop before connecting when the target the run resolved is another (#429)
function optionValue(name) {
  const at = process.argv.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
  if (at < 0) return null;
  const value = process.argv[at].startsWith(`${name}=`) ? process.argv[at].slice(name.length + 1) : process.argv[at + 1] ?? '';
  if (value === '' || value.startsWith('-')) {
    console.error(`❌ ${name} needs a value: ${name} <value>`);
    process.exit(1);
  }
  return value;
}
const EXPECT_DATABASE = optionValue('--expect-database');
const EXPECT_HOST = optionValue('--expect-host');
// What the .env says about NODE_ENV and the sample-data switch (see sample-data.mjs)
const fileEnv = {};

if (readEnvFile && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');

  envLines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '').trim();

      if (key?.trim() === 'DATABASE_URL' && valueParts.length > 0) {
        DATABASE_URL ||= value;
      }
      if (key?.trim() === 'MIGRATE_DATABASE_URL' && valueParts.length > 0) {
        MIGRATE_DATABASE_URL ||= value;
      }
      if (key?.trim() === 'MIGRATION_TIMEOUT_SECONDS' && valueParts.length > 0) {
        MIGRATION_TIMEOUT_SECONDS ||= value;
      }
      // `export NODE_ENV=...` counts too; sample-data.mjs reads the value itself (case, trailing comment)
      const name = key?.trim().replace(/^export\s+/, '');
      if (['NODE_ENV', 'NEXTSPARK_SEED_SAMPLE_DATA'].includes(name) && valueParts.length > 0) {
        fileEnv[name] = value;
      }
    }
  });
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

// The URL used for the actual migration connection (owner credential).
const MIGRATION_URL = MIGRATE_DATABASE_URL || DATABASE_URL;

// Name the destination before anything runs: host and database only, never the user, password or URL.
// Error messages from the server can name the role, so they go through scrub() too.
rememberSecrets(MIGRATION_URL, DATABASE_URL, MIGRATE_DATABASE_URL);
// A target that is not the expected one stops here, before anything connects (see unexpectedTarget)
const unexpected = unexpectedTarget(MIGRATION_URL, { database: EXPECT_DATABASE, host: EXPECT_HOST });
if (unexpected) {
  console.error(`❌ ${unexpected} Nothing was run.`);
  process.exit(1);
}
const expectedNote = EXPECT_DATABASE !== null || EXPECT_HOST !== null ? ' (the expected target)' : '';
console.log(DRY_RUN
  ? `🎯 Dry run against ${describeDestination(MIGRATION_URL)}${expectedNote}: nothing will be written\n`
  : `🎯 Migrating ${describeDestination(MIGRATION_URL)}${expectedNote}\n`);

// How long each migration may run, when MIGRATION_TIMEOUT_SECONDS asks for a limit
// (see migration-time-limit.mjs). Without it, a migration runs for as long as it takes.
let TIME_LIMIT;
try {
  TIME_LIMIT = migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS });
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

const ignoredParameters = ignoredParametersNotice(MIGRATION_URL, TIME_LIMIT);
if (ignoredParameters) console.log(`⚠️  ${ignoredParameters}\n`);

const SAMPLE_DATA = sampleDataPolicy({ argv: process.argv, env: process.env, fileEnv });
// A production .env also means a URL without sslmode needs a validated certificate (see ssl-config.mjs).
// Call it before anything connects: the first client is made in runMigrations() below. ignoredParametersNotice
// above only builds clients to read their parameters and never connects.
setProjectEnv(fileEnv);

// The role steps 022 could not run, to say again at the very end of the output
const roleSetupWarnings = [];
// The ledgers that have the content_hash column: a migration recorded in one of them is recorded with its hash (#428)
let hashedLedgers = new Set();
// What the run said about migration files edited after they were applied, to say again at the very end
let editedWarning = null;
const reportedFailures = new Set();
// Keeps the ledgers that have the column, and says once which could not get it (the role does not own the table)
function useHashColumns({ hashed, failures }) {
  hashedLedgers = hashed;
  for (const { table, message } of failures) {
    if (reportedFailures.has(table)) continue;
    reportedFailures.add(table);
    console.log(`⚠️  Could not add ${HASH_COLUMN} to "${table}" (${scrub(message)}): edits to the migrations it records will not be noticed.\n`);
  }
}
// The ledgers the runner creates are born restricted to the migration role (see lockdownLedgers)
async function lockLedgers(client) {
  for (const warning of await lockdownLedgers(client)) console.log(`⚠️  ${scrub(warning)}`);
}
/** The row that records `sql` as run in `table`: the hash goes along where the ledger has the column. */
const withHash = (table, row, sql) => (hashedLedgers.has(table) ? { ...row, [HASH_COLUMN]: migrationHash(sql) } : row);

// What a dry run found it would apply, in run order, and the migrations it would only record as already applied
const pending = [];
const takenOver = [];
const dryRunNotes = [];
// A dry run does not create the ledgers: one that does not exist yet has no rows to read
const missingLedgers = new Set();
const ledgerQuery = (client, table, text, params) => (missingLedgers.has(table) ? Promise.resolve({ rows: [], rowCount: 0 }) : client.query(text, params));
// The per-file chatter of a real run; a dry run prints only its report
const log = (...args) => { if (!DRY_RUN) console.log(...args); };

// The recorded migrations against the files, before anything runs. Ledgers written by an earlier version have no
// hash: it is filled in here, from the files as they are. An edited file only warns (see editedWarning): the run
// is still right for everything that is pending, and an edit is often a comment, so stopping every deploy over one
// would teach people to bypass the check; --strict stops. A renamed file always stops, because the run would
// apply it again, which duplicates its effects or fails halfway through.
async function checkRecordedMigrations(client) {
  const files = ledgerFiles({ core: collectCoreMigrations(packageRoot), migrations: MIGRATIONS });
  const { edited, renamed, hashed, failures } = await ledgerFindings(client, files, { write: !DRY_RUN });
  useHashColumns({ hashed, failures });
  const destination = describeDestination(MIGRATION_URL);
  const renamedText = renamedReport(renamed, destination);
  if (renamedText) throw new Error(`${renamedText}\nNothing was run.`);
  editedWarning = editedReport(edited, destination);
  if (editedWarning) {
    if (STRICT) throw new Error(`${editedWarning}\n--strict: nothing was run.`);
    console.log(`⚠️  ${editedWarning}\n`);
  }
}

async function runMigrations() {
  const client = migrationClient(MIGRATION_URL, TIME_LIMIT);
  
  try {
    await client.connect();
    console.log("✅ Connected to database\n");
    // The server refuses every write of this session, so a dry run cannot change the database whatever the code below does
    if (DRY_RUN) await client.query('SET default_transaction_read_only = on');

    // Before anything runs: an upgrade whose theme cannot be told stops here
    LEGACY_THEME = await legacyTheme(client);
    await checkRecordedMigrations(client);

    if (DRY_RUN) {
      const recorded = new Set((await readLedger(client, LEDGERS[0])).map(row => row.filename));
      for (const { filename } of collectCoreMigrations(packageRoot)) {
        if (recorded.has(filename)) continue;
        if (!SAMPLE_DATA.apply && isSampleDataMigration(filename, fs.readFileSync(path.join(packageRoot, 'migrations', filename), 'utf8'))) continue;
        pending.push({ where: 'core', filename });
      }
      await client.end();
      return;
    }

    // 029_sample_accounts_outside_development.sql reads it: a run that applies sample data keeps the sample accounts
    await client.query("SELECT set_config('nextspark.seed_sample_data', $1, false)", [SAMPLE_DATA.apply ? 'on' : 'off']);
    client.on('notice', notice => {
      if (notice.message?.startsWith('Sample accounts:')) console.log(`🔐 ${notice.message}`);
      // 044: credential accounts it fixed, and the ones it left that need a manual step
      else if (notice.message?.startsWith('Credential accounts:')) console.log(`${notice.severity === 'WARNING' ? '⚠️ ' : '🔐'} ${notice.message}`);
      // a migration that leaves something as it was says so (043: a policy it did not rewrite)
      else if (notice.severity === 'WARNING' && notice.message?.includes('left unchanged')) console.log(`⚠️  ${notice.message}`);
      // 022: a role step the migration role has no privilege for is skipped, and says what to do by hand
      else if (notice.severity === 'WARNING' && notice.message?.startsWith('Role setup:')) {
        console.log(`⚠️  ${notice.message}`);
        // the comment on the role is only a description: nothing to repeat
        if (!notice.message.includes('only a description')) roleSetupWarnings.push(notice.message);
      }
      // 045: a bookkeeping table the migration role does not own stays as it was
      else if (notice.severity === 'WARNING' && notice.message?.startsWith('Ledger lockdown:')) console.log(`⚠️  ${notice.message}`);
    });
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await lockLedgers(client);
    useHashColumns(await ensureHashColumns(client));
    
    // Get list of migration files (from package, not project root)
    const migrationsDir = path.join(packageRoot, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(compareMigrations);
    
    console.log(`Found ${files.length} migration file(s)\n`);
    
    for (const file of files) {
      // Check if migration has already been executed
      const result = await client.query(
        'SELECT * FROM "_migrations" WHERE filename = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (!SAMPLE_DATA.apply && isSampleDataMigration(file, sql)) {
        console.log(`⏭️  Skipping ${file} (sample data)`);
        continue;
      }

      // Read and execute migration
      console.log(`🔄 Running ${file}...`);
      
      try {
        // Runs the file and records it in one transaction (see runAndRecordMigration)
        await runAndRecordMigration(client, {
          file, sql, table: '_migrations', row: withHash('_migrations', { filename: file }, sql), limit: TIME_LIMIT, connectionString: MIGRATION_URL,
        });
        
        console.log(`✅ Successfully executed ${file}\n`);
      } catch (error) {
        console.error(`❌ ${migrationFailure(file, error)}`);
        throw error;
      }
    }
    
    // Show migration history
    const history = await client.query(
      'SELECT * FROM "_migrations" ORDER BY executed_at DESC LIMIT 10'
    );
    
    console.log("\n📊 Migration History:");
    history.rows.forEach(row => {
      console.log(`   - ${row.filename} (${new Date(row.executed_at).toLocaleString()})`);
    });
    
    await client.end();
    console.log("\n✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", scrub(error.message));
    process.exit(1);
  }
}

// Read enabled local plugins from nextspark.config.ts.
async function getActivePlugins() {
  return projectConfig.plugins;
}

// Where 0.1.0-beta.184 and earlier recorded a project migration, while it lived in
// contents/themes/<theme>: ('theme', <theme>) and ('theme-settings', '<theme>/settings/<area>').
// `nextspark migrate` moves the files but not those rows.
function legacyKey({ sourceType, sourceName }, theme) {
  if (sourceType === 'project') return ['theme', theme];
  if (sourceType === 'project-settings') return ['theme-settings', `${theme}${sourceName.slice(PROJECT_NAME.length)}`];
  return null;
}

// The name an entity directory had before it was renamed (see executeEntityMigration), or null: the one its
// .renamed-from says, else the underscore spelling of a 0.x directory
function legacyEntityName({ entityName, renamedFrom }) {
  const legacyName = renamedFrom ?? entityName.replaceAll('-', '_');
  if (legacyName === entityName || MIGRATIONS.allEntityMigrations.some(m => m.entityName === legacyName)) return null;
  return legacyName;
}

// The theme a 0.x project was migrated from, when a project migration (or a renamed
// project entity's migration) that has no record of its own is recorded under a theme;
// null otherwise (and on a fresh database).
// Several themes are told apart only by --legacy-theme, never guessed; a flag that names
// none of them stops the run too.
async function legacyTheme(client) {
  const tables = await client.query(
    `SELECT to_regclass('public."_content_migrations"')::text AS content, to_regclass('public."_entity_migrations"')::text AS entity`
  );
  const runs = m => !m.isSampleData || SAMPLE_DATA.apply;
  const recorded = new Set();
  // Kept apart: only the kind that has something to take over can make the theme ambiguous
  const contentThemes = new Set();
  const entityThemes = new Set();
  const pending = { content: false, entity: false };
  if (tables.rows[0]?.content) {
    const { rows } = await client.query(
      `SELECT source_type, source_name, filename FROM "_content_migrations" WHERE source_type IN ('theme', 'theme-settings', 'project', 'project-settings')`
    );
    for (const row of rows) {
      recorded.add(`${row.source_type}\0${row.source_name}\0${row.filename}`);
      if (row.source_type.startsWith('theme')) contentThemes.add(row.source_name.split('/settings/')[0]);
    }
    pending.content = MIGRATIONS.allContentMigrations
      .filter(m => legacyKey(m, '') && runs(m) && !recorded.has(`${m.sourceType}\0${m.sourceName}\0${m.filename}`))
      .some(m => [...contentThemes].some(theme => recorded.has(`${legacyKey(m, theme).join('\0')}\0${m.filename}`)));
  }
  if (tables.rows[0]?.entity) {
    // to_jsonb: a table older than its source columns (added in PHASE 2) reads them as null
    const { rows } = await client.query(
      `SELECT entity_name, filename, to_jsonb(e)->>'source_type' AS source_type, to_jsonb(e)->>'source_name' AS source_name FROM "_entity_migrations" e`
    );
    const own = new Set(rows.map(row => `${row.entity_name}\0${row.filename}`));
    const fromTheme = rows.filter(row => row.source_type === 'theme');
    for (const row of fromTheme) entityThemes.add(row.source_name);
    pending.entity = MIGRATIONS.allEntityMigrations
      .filter(m => m.sourceType === 'project' && runs(m) && legacyEntityName(m) && !own.has(`${m.entityName}\0${m.filename}`))
      .some(m => fromTheme.some(row => row.entity_name === legacyEntityName(m) && row.filename === m.filename));
  }
  if (!pending.content && !pending.entity) return null;
  const names = [...new Set([...(pending.content ? contentThemes : []), ...(pending.entity ? entityThemes : [])])].sort();
  if (LEGACY_THEME_FLAG === null && names.length === 1) return names[0];
  if (names.includes(LEGACY_THEME_FLAG)) return LEGACY_THEME_FLAG;
  if (LEGACY_THEME_FLAG !== null) {
    throw new Error(
      `--legacy-theme ${LEGACY_THEME_FLAG}: the migrations this project takes over are recorded under ${names.join(', ')}, not under ${LEGACY_THEME_FLAG}. ` +
      `Pass the theme this project was migrated from${names.length === 1 ? ', or leave the flag out' : ''}. Nothing was run.`
    );
  }
  throw new Error(
    `Migrations are recorded under more than one theme: ${names.join(', ')}. ` +
    `Run db:migrate again with --legacy-theme <theme>, naming the theme this project was migrated from (the directory under contents/themes that nextspark migrate moved); ` +
    `its migrations that are already applied are then recorded for the project instead of run again. Nothing was run.`
  );
}

// Execute a single content migration
async function executeContentMigration(client, migration) {
  const { sourceType, sourceName, filename, fullPath } = migration;

  // Check if already executed
  const result = await ledgerQuery(
    client,
    '_content_migrations',
    'SELECT * FROM "_content_migrations" WHERE source_type = $1 AND source_name = $2 AND filename = $3',
    [sourceType, sourceName, filename]
  );

  if (result.rows.length > 0) {
    log(`  ⏭️  ${filename} (already executed)`);
    return false;
  }

  // Applied before the project left contents/themes: record it under the new key, keep the old row
  // (a dry run only looks for the row that would be copied)
  const legacy = LEGACY_THEME && legacyKey(migration, LEGACY_THEME);
  if (legacy) {
    const taken = DRY_RUN
      ? await ledgerQuery(client, '_content_migrations', 'SELECT 1 FROM "_content_migrations" WHERE source_type = $1 AND source_name = $2 AND filename = $3', [...legacy, filename])
      : await client.query(
        `INSERT INTO "_content_migrations" (source_type, source_name, filename, executed_at)
         SELECT $1, $2, filename, executed_at FROM "_content_migrations" WHERE source_type = $3 AND source_name = $4 AND filename = $5
         ON CONFLICT DO NOTHING`,
        [sourceType, sourceName, ...legacy, filename]
      );
    if (taken.rowCount > 0) {
      if (DRY_RUN) takenOver.push({ where: `${sourceType} ${sourceName}`, filename, from: `theme ${LEGACY_THEME}` });
      else console.log(`  ⏭️  ${filename}: already applied as theme ${LEGACY_THEME}; recorded for the project`);
      return false;
    }
  }

  if (DRY_RUN) {
    pending.push({ where: `${sourceType} ${sourceName}`, filename, sampleData: migration.isSampleData });
    return false;
  }

  console.log(`  🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runAndRecordMigration(client, {
    file: filename,
    sql,
    table: '_content_migrations',
    row: withHash('_content_migrations', { source_type: sourceType, source_name: sourceName, filename }, sql),
    limit: TIME_LIMIT,
    connectionString: MIGRATION_URL,
  });

  console.log(`  ✅ ${filename} executed successfully`);
  return true;
}

// Execute a single entity migration
async function executeEntityMigration(client, migration) {
  const { sourceType, sourceName, entityName, filename, fullPath, depth = 0 } = migration;
  const indent = '  '.repeat(depth + 1);

  // Check if already executed
  const result = await ledgerQuery(
    client,
    '_entity_migrations',
    'SELECT * FROM "_entity_migrations" WHERE entity_name = $1 AND filename = $2',
    [entityName, filename]
  );

  if (result.rows.length > 0) {
    log(`${indent}⏭️  ${filename} (already executed)`);
    return false;
  }

  // An entity directory renamed since its migrations ran: the same entity, recorded under the old name.
  // Two kinds of rename count, and only those: a 0.x campaign_members directory that is now
  // campaign-members (from where this entity lived before: a project entity from the theme it came
  // from, a plugin entity from the same plugin), and a directory that `nextspark migrate
  // --rename-entity-slugs` renamed, which says so in .renamed-from (from where the entity is recorded now).
  const legacyName = legacyEntityName(migration);
  const origins = [];
  if (legacyName) {
    if (LEGACY_THEME && sourceType === 'project') origins.push(['theme', LEGACY_THEME]);
    if (sourceType === 'plugin') origins.push(['plugin', sourceName]);
    if (migration.renamedFrom) origins.push([sourceType, sourceName]);
  }
  for (const origin of origins) {
    // The row of a directory `migrate` renamed is moved, so it can be taken only once; a 0.x spelling is copied
    const moved = migration.renamedFrom && origin[0] === sourceType && origin[1] === sourceName;
    const taken = DRY_RUN
      ? await ledgerQuery(
        client,
        '_entity_migrations',
        `SELECT 1 FROM "_entity_migrations" e WHERE entity_name = $1 AND filename = $2 AND to_jsonb(e)->>'source_type' = $3 AND to_jsonb(e)->>'source_name' = $4`,
        [legacyName, filename, ...origin]
      )
      : moved
      ? await client.query(
        `UPDATE "_entity_migrations" SET entity_name = $1
         WHERE entity_name = $2 AND filename = $3 AND source_type = $4 AND source_name = $5`,
        [entityName, legacyName, filename, ...origin]
      )
      : await client.query(
        `INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename, executed_at)
         SELECT $1, $2, $3, filename, executed_at FROM "_entity_migrations"
         WHERE entity_name = $4 AND filename = $5 AND source_type = $6 AND source_name = $7
         ON CONFLICT DO NOTHING`,
        [entityName, sourceType, sourceName, legacyName, filename, ...origin]
      );
    if (taken.rowCount > 0) {
      if (DRY_RUN) takenOver.push({ where: `entity ${entityName}, ${sourceType} ${sourceName}`, filename, from: `entity ${legacyName}` });
      else console.log(`${indent}⏭️  ${filename}: already applied as entity ${legacyName}; recorded for ${entityName}`);
      return false;
    }
  }

  if (DRY_RUN) {
    pending.push({ where: `entity ${entityName}, ${sourceType} ${sourceName}`, filename, sampleData: migration.isSampleData });
    return false;
  }

  console.log(`${indent}🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runAndRecordMigration(client, {
    file: filename,
    sql,
    table: '_entity_migrations',
    row: withHash('_entity_migrations', { entity_name: entityName, source_type: sourceType, source_name: sourceName, filename }, sql),
    limit: TIME_LIMIT,
    connectionString: MIGRATION_URL,
  });

  console.log(`${indent}✅ ${filename} executed successfully`);
  return true;
}

// Entity migrations runner - WordPress-like architecture with sample_data deferred execution
async function runEntityMigrations() {
  const client = migrationClient(MIGRATION_URL, TIME_LIMIT);

  try {
    await client.connect();
    // The server refuses every write of this session, so a dry run cannot change the database whatever the code below does
    if (DRY_RUN) await client.query('SET default_transaction_read_only = on');
    // 004_pages_slug_check.sql reads it: the slug CHECK of pages follows access.allowNestedSlugs
    const nested = await nestedSlugsSetting(projectRoot);
    if (nested.warning) console.warn(`⚠️  ${nested.warning}`);
    if (!DRY_RUN) await client.query("SELECT set_config('nextspark.pages_allow_nested_slugs', $1, false)", [nested.setting]);
    log("🔄 Running content & entity migrations (sample_data deferred)...\n");
    log(`📌 Project: ${PROJECT_NAME}\n`);

    if (DRY_RUN) {
      // Nothing is created: a ledger that is not there has no rows
      const { rows } = await client.query(`SELECT to_regclass('"_content_migrations"') IS NULL AS no_content, to_regclass('"_entity_migrations"') IS NULL AS no_entity, to_regclass('"_theme_migrations"') IS NOT NULL AS old_theme`);
      if (rows[0].no_content) missingLedgers.add('_content_migrations');
      if (rows[0].no_entity) missingLedgers.add('_entity_migrations');
      if (rows[0].old_theme) dryRunNotes.push('"_theme_migrations" exists: a real run first moves its rows into "_content_migrations", so some project or plugin migration listed here may already be applied.');
    } else {
      // Create tracking tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS "_entity_migrations" (
          id SERIAL PRIMARY KEY,
          entity_name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(entity_name, filename)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS "_content_migrations" (
          id SERIAL PRIMARY KEY,
          source_type TEXT NOT NULL,
          source_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source_type, source_name, filename)
        )
      `);

      // Migrate old _theme_migrations table if exists
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_theme_migrations'
          ) THEN
            INSERT INTO "_content_migrations" (source_type, source_name, filename, executed_at)
            SELECT source_type, source_name, filename, executed_at
            FROM "_theme_migrations"
            ON CONFLICT DO NOTHING;
            DROP TABLE "_theme_migrations";
          END IF;
        END $$;
      `);

      // Auto-update table if columns are missing
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '_entity_migrations' AND column_name = 'source_type'
          ) THEN
            ALTER TABLE "_entity_migrations" ADD COLUMN source_type TEXT;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '_entity_migrations' AND column_name = 'source_name'
          ) THEN
            ALTER TABLE "_entity_migrations" ADD COLUMN source_name TEXT;
          END IF;
        END $$;
      `);

      await lockLedgers(client);
      useHashColumns(await ensureHashColumns(client));
    }

    // Get active plugins
    const activePlugins = await getActivePlugins();
    log(`🔌 Active plugins: ${activePlugins.length > 0 ? activePlugins.join(', ') : 'none'}\n`);
    log("📦 Collecting all migrations...\n");

    // =========================================================================
    // PHASE 2A: COLLECT ALL MIGRATIONS (done once, before PHASE 1: see MIGRATIONS)
    // =========================================================================
    const { allContentMigrations, allEntityMigrations } = MIGRATIONS;

    // =========================================================================
    // PHASE 2B: SEPARATE SCHEMA vs SAMPLE_DATA AND SORT GLOBALLY
    // =========================================================================
    // Sort by the number in the file name, then by name, globally to handle inter-entity dependencies
    // e.g., 151_* runs before 1001_*, regardless of entity name (see migration-order.mjs)
    const sortByFilename = compareMigrations;

    const contentSchema = allContentMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const contentSampleData = allContentMigrations.filter(m => m.isSampleData && SAMPLE_DATA.apply).sort(sortByFilename);
    const entitySchema = allEntityMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const entitySampleData = allEntityMigrations.filter(m => m.isSampleData && SAMPLE_DATA.apply).sort(sortByFilename);

    log(`📊 Migration breakdown:`);
    log(`   - Content schema: ${contentSchema.length}`);
    log(`   - Content sample_data: ${contentSampleData.length}`);
    log(`   - Entity schema: ${entitySchema.length}`);
    log(`   - Entity sample_data: ${entitySampleData.length}`);
    for (const m of [...allContentMigrations, ...allEntityMigrations].filter(m => m.isSampleData && !SAMPLE_DATA.apply)) {
      log(`⏭️  Skipping ${m.filename} (sample data, ${m.sourceName})`);
    }
    log('');

    let totalContentMigrations = 0;
    let totalEntityMigrations = 0;

    // =========================================================================
    // PHASE 2C: EXECUTE SCHEMA MIGRATIONS FIRST
    // =========================================================================
    log("🏗️  STEP 1: Schema migrations (tables, indexes, RLS)\n");

    // Content schema migrations
    if (contentSchema.length > 0) {
      log(`🎨 Theme/Plugin schema migrations:`);
      for (const migration of contentSchema) {
        try {
          const executed = await executeContentMigration(client, migration);
          if (executed) totalContentMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      log('');
    }

    // Entity schema migrations (grouped by entity for readability)
    if (entitySchema.length > 0) {
      log(`🎨 Entity schema migrations:`);
      const entitiesSeen = new Set();
      for (const migration of entitySchema) {
        if (!entitiesSeen.has(migration.entityName)) {
          const entityCount = entitySchema.filter(m => m.entityName === migration.entityName).length;
          log(`  📁 ${migration.entityName} (${entityCount} schema migration(s))`);
          entitiesSeen.add(migration.entityName);
        }
        try {
          const executed = await executeEntityMigration(client, migration);
          if (executed) totalEntityMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      log('');
    }

    // =========================================================================
    // PHASE 2D: EXECUTE SAMPLE_DATA MIGRATIONS LAST
    // =========================================================================
    log("🌱 STEP 2: Sample data migrations (INSERT statements)\n");

    // Content sample_data migrations
    if (contentSampleData.length > 0) {
      log(`🎨 Theme/Plugin sample_data migrations:`);
      for (const migration of contentSampleData) {
        try {
          const executed = await executeContentMigration(client, migration);
          if (executed) totalContentMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      log('');
    }

    // Entity sample_data migrations
    if (entitySampleData.length > 0) {
      log(`🎨 Entity sample_data migrations:`);
      const entitiesSeen = new Set();
      for (const migration of entitySampleData) {
        if (!entitiesSeen.has(migration.entityName)) {
          const entityCount = entitySampleData.filter(m => m.entityName === migration.entityName).length;
          log(`  📁 ${migration.entityName} (${entityCount} sample_data migration(s))`);
          entitiesSeen.add(migration.entityName);
        }
        try {
          const executed = await executeEntityMigration(client, migration);
          if (executed) totalEntityMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      log('');
    }

    // A dry run has listed what it found
    if (DRY_RUN) {
      await client.end();
      return;
    }

    // Show migration history
    const contentHistory = await client.query(
      'SELECT source_type, source_name, filename, executed_at FROM "_content_migrations" ORDER BY executed_at DESC LIMIT 20'
    );

    if (contentHistory.rows.length > 0) {
      console.log("📊 Content Migration History:");
      contentHistory.rows.forEach(row => {
        const source = `${row.source_type}:${row.source_name}`;
        console.log(`   - [${source}] ${row.filename} (${new Date(row.executed_at).toLocaleString()})`);
      });
    }

    const entityHistory = await client.query(
      'SELECT entity_name, source_type, source_name, filename, executed_at FROM "_entity_migrations" ORDER BY executed_at DESC LIMIT 30'
    );

    if (entityHistory.rows.length > 0) {
      console.log("\n📊 Entity Migration History:");
      entityHistory.rows.forEach(row => {
        const source = `${row.source_type}:${row.source_name}`;
        console.log(`   - [${source}] ${row.entity_name}: ${row.filename} (${new Date(row.executed_at).toLocaleString()})`);
      });
    }

    await client.end();
    console.log(`\n✅ Content & Entity migrations completed!`);
    console.log(`   - Content migrations: ${totalContentMigrations}`);
    console.log(`   - Entity migrations: ${totalEntityMigrations}`);
  } catch (error) {
    console.error("❌ Entity migration error:", scrub(error.message));
    await client.end();
    process.exit(1);
  }
}

// What a dry run found: the migrations a real run would apply, in the order it applies them
function printDryRun() {
  console.log(pending.length === 0
    ? 'Nothing is pending: a real run would apply no migration.'
    : `Pending migrations, in the order a real run applies them (${pending.length}):`);
  pending.forEach(({ where, filename, sampleData }, index) => {
    console.log(`${String(index + 1).padStart(5)}. [${where}] ${filename}${sampleData ? ' (sample data)' : ''}`);
  });
  if (takenOver.length > 0) {
    console.log(`\nApplied before the project was moved, which a real run only records (${takenOver.length}):`);
    for (const { where, filename, from } of takenOver) console.log(`       [${where}] ${filename} (recorded as ${from})`);
  }
  for (const note of dryRunNotes) console.log(`\n⚠️  ${note}`);
  console.log('\n✅ Dry run finished. Nothing was written: no migration ran, and the ledgers were neither created nor changed.');
}

// Main migration runner
async function runAllMigrations() {
  console.log(DRY_RUN ? "🔎 Dry run: reading what is pending, writing nothing\n" : "🚀 Starting migration process...\n");
  console.log(`🌱 ${SAMPLE_DATA.notice}\n`);
  
  // First run core migrations
  log("📋 PHASE 1: Core migrations");
  await runMigrations();
  
  log("\n📋 PHASE 2: Entity migrations");
  await runEntityMigrations();

  if (DRY_RUN) {
    printDryRun();
    if (editedWarning) console.log(`\n⚠️  ${editedWarning}`);
    return;
  }

  // A theme or project migration can leave an auth table Better Auth refuses to start on
  await checkAuthSchema();

  console.log("\n🎉 All migrations completed successfully!");
  // The warning about edited files is at the top of a long output: say it again as the last thing printed
  if (editedWarning) console.log(`\n⚠️  ${editedWarning}`);
  // 022 goes on after a role step it cannot run, in the middle of a long output: say it again as the last thing printed
  if (roleSetupWarnings.length > 0) {
    console.log("\n⚠️  Needs a superuser, by hand (022 could not run it):");
    for (const warning of roleSetupWarnings) console.log(`   - ${warning}`);
  }
}

async function checkAuthSchema() {
  const client = migrationClient(MIGRATION_URL, TIME_LIMIT);
  let problems;
  try {
    await client.connect();
    problems = await authSchemaProblems(client);
  } catch (error) {
    console.error("❌ Could not check the auth tables:", scrub(error.message));
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
  if (problems.length > 0) {
    console.error(`\n❌ ${authSchemaReport(problems)}`);
    process.exit(1);
  }
}

let MIGRATIONS;
try {
  MIGRATIONS = collectAllMigrations({ projectRoot, projectName: PROJECT_NAME, plugins: projectConfig.plugins });
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
// The theme a 0.x project came from, when it has migrations to take over (set before PHASE 1)
let LEGACY_THEME = null;

// Run all migrations
runAllMigrations();
