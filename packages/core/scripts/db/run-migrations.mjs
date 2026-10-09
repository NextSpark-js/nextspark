import fs from "fs";
import path from "path";
import { migrationTimeLimit, migrationClient, ignoredParametersNotice, runAndRecordMigration, migrationFailure } from './migration-time-limit.mjs';
import { getConfig } from '../build/registry/config.mjs';
import { isSampleDataMigration, sampleDataPolicy } from './sample-data.mjs';
import { setProjectEnv } from './ssl-config.mjs';

const projectConfig = getConfig();
const projectRoot = projectConfig.projectRoot;
const packageRoot = projectConfig.coreDir;
const PROJECT_NAME = projectConfig.projectName;

// Read environment variables: prefer .env file if it exists, fallback to process.env (e.g. Vercel/CI).
// `--no-env-file` skips the .env file, so the connection comes only from the
// environment this process was started with (the template verifier uses it that way).
const envPath = path.join(projectRoot, '.env');
const readEnvFile = !process.argv.includes('--no-env-file');

let DATABASE_URL = process.env.DATABASE_URL ?? null;
// Migrations and seeds run as the table OWNER. After the runtime cutover the app
// connects DATABASE_URL as the non-owner `nextspark_app` role, so the owner
// credential for migrations is provided separately via MIGRATE_DATABASE_URL.
// Falls back to DATABASE_URL when unset (pre-cutover: same owner connection).
let MIGRATE_DATABASE_URL = process.env.MIGRATE_DATABASE_URL ?? null;
let MIGRATION_TIMEOUT_SECONDS = process.env.MIGRATION_TIMEOUT_SECONDS;
// Only read to tell which theme a 0.x project came from (see legacyTheme below)
let ACTIVE_THEME = process.env.NEXT_PUBLIC_ACTIVE_THEME || null;
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
        DATABASE_URL = value;
      }
      if (key?.trim() === 'MIGRATE_DATABASE_URL' && valueParts.length > 0) {
        MIGRATE_DATABASE_URL = value;
      }
      if (key?.trim() === 'MIGRATION_TIMEOUT_SECONDS' && valueParts.length > 0) {
        MIGRATION_TIMEOUT_SECONDS = value;
      }
      if (key?.trim() === 'NEXT_PUBLIC_ACTIVE_THEME' && valueParts.length > 0) {
        ACTIVE_THEME = value || ACTIVE_THEME;
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

async function runMigrations() {
  const client = migrationClient(MIGRATION_URL, TIME_LIMIT);
  
  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Before anything runs: an upgrade whose theme cannot be told stops here
    LEGACY_THEME = await legacyTheme(client);

    // 029_sample_accounts_outside_development.sql reads it: a run that applies sample data keeps the sample accounts
    await client.query("SELECT set_config('nextspark.seed_sample_data', $1, false)", [SAMPLE_DATA.apply ? 'on' : 'off']);
    client.on('notice', notice => {
      if (notice.message?.startsWith('Sample accounts:')) console.log(`🔐 ${notice.message}`);
    });
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of migration files (from package, not project root)
    const migrationsDir = path.join(packageRoot, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
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
          file, sql, table: '_migrations', row: { filename: file }, limit: TIME_LIMIT, connectionString: MIGRATION_URL,
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
    console.error("❌ Migration error:", error.message);
    process.exit(1);
  }
}

// Read enabled local plugins from nextspark.config.ts.
async function getActivePlugins() {
  return projectConfig.plugins;
}

// Helper: Collect all migration files from a directory (theme/plugin level)
function collectContentMigrations(migrationsPath, sourceType, sourceName) {
  if (!fs.existsSync(migrationsPath)) return [];

  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => ({
    type: 'content',
    sourceType,
    sourceName,
    filename: file,
    fullPath: path.join(migrationsPath, file),
    isSampleData: isSampleDataMigration(file, fs.readFileSync(path.join(migrationsPath, file), 'utf8'))
  }));
}

// Helper: Collect all entity migration files recursively
function collectEntityMigrations(baseDir, sourceType, sourceName, depth = 0) {
  const migrations = [];

  if (!fs.existsSync(baseDir)) return migrations;

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const entityPath = path.join(baseDir, entry.name);
    const entityName = entry.name;

    // Check for migrations in this entity
    const migrationsPath = path.join(entityPath, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        migrations.push({
          type: 'entity',
          sourceType,
          sourceName,
          entityName,
          filename: file,
          fullPath: path.join(migrationsPath, file),
          isSampleData: isSampleDataMigration(file, fs.readFileSync(path.join(migrationsPath, file), 'utf8')),
          depth
        });
      }
    }

    // Check for children entities
    const possibleChildrenDirs = ['children', 'childs'];
    for (const childDirName of possibleChildrenDirs) {
      const childrenDir = path.join(entityPath, childDirName);
      if (fs.existsSync(childrenDir)) {
        const childMigrations = collectEntityMigrations(childrenDir, sourceType, sourceName, depth + 1);
        migrations.push(...childMigrations);
        break;
      }
    }
  }

  return migrations;
}

// Every project and plugin migration, in the order found
function collectAllMigrations(activePlugins) {
  const allContentMigrations = [];
  const allEntityMigrations = [];

  const projectMigrationsDir = path.join(projectRoot, 'migrations');
  allContentMigrations.push(...collectContentMigrations(projectMigrationsDir, 'project', PROJECT_NAME));

  // Collect project entity migrations
  const projectEntitiesDir = path.join(projectRoot, 'entities');
  allEntityMigrations.push(...collectEntityMigrations(projectEntitiesDir, 'project', PROJECT_NAME));

  // Collect project settings migrations (settings/<area>/migrations/)
  const projectSettingsDir = path.join(projectRoot, 'settings');
  if (fs.existsSync(projectSettingsDir)) {
    const settingAreas = fs.readdirSync(projectSettingsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
    for (const area of settingAreas) {
      const settingsMigrationsDir = path.join(projectSettingsDir, area, 'migrations');
      allContentMigrations.push(...collectContentMigrations(
        settingsMigrationsDir, 'project-settings', `${PROJECT_NAME}/settings/${area}`
      ));
    }
  }

  // Collect plugin migrations
  const pluginsDir = path.join(projectRoot, 'plugins');
  if (fs.existsSync(pluginsDir) && activePlugins.length > 0) {
    for (const pluginName of activePlugins) {
      const pluginDir = path.join(pluginsDir, pluginName);

      // Plugin-level migrations
      const pluginMigrationsDir = path.join(pluginDir, 'migrations');
      allContentMigrations.push(...collectContentMigrations(pluginMigrationsDir, 'plugin', pluginName));

      // Plugin entity migrations
      const pluginEntitiesDir = path.join(pluginDir, 'entities');
      allEntityMigrations.push(...collectEntityMigrations(pluginEntitiesDir, 'plugin', pluginName));

      // Plugin settings migrations (settings/<area>/migrations/)
      const pluginSettingsDir = path.join(pluginDir, 'settings');
      if (fs.existsSync(pluginSettingsDir)) {
        const settingAreas = fs.readdirSync(pluginSettingsDir, { withFileTypes: true })
          .filter(e => e.isDirectory()).map(e => e.name);
        for (const area of settingAreas) {
          const settingsMigrationsDir = path.join(pluginSettingsDir, area, 'migrations');
          allContentMigrations.push(...collectContentMigrations(
            settingsMigrationsDir, 'plugin-settings', `${pluginName}/settings/${area}`
          ));
        }
      }
    }
  }

  return { allContentMigrations, allEntityMigrations };
}

// Where 0.1.0-beta.184 and earlier recorded a project migration, while it lived in
// contents/themes/<theme>: ('theme', <theme>) and ('theme-settings', '<theme>/settings/<area>').
// `nextspark migrate` moves the files but not those rows.
function legacyKey({ sourceType, sourceName }, theme) {
  if (sourceType === 'project') return ['theme', theme];
  if (sourceType === 'project-settings') return ['theme-settings', `${theme}${sourceName.slice(PROJECT_NAME.length)}`];
  return null;
}

// The underscore spelling a 0.x entity directory had (see executeEntityMigration), or null
function legacyEntityName(entityName) {
  const legacyName = entityName.replaceAll('-', '_');
  if (legacyName === entityName || MIGRATIONS.allEntityMigrations.some(m => m.entityName === legacyName)) return null;
  return legacyName;
}

// The theme a 0.x project was migrated from, when a project migration (or a renamed
// project entity's migration) that has no record of its own is recorded under a theme;
// null otherwise (and on a fresh database).
// Several themes are told apart only by NEXT_PUBLIC_ACTIVE_THEME, never guessed.
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
      .filter(m => m.sourceType === 'project' && runs(m) && legacyEntityName(m.entityName) && !own.has(`${m.entityName}\0${m.filename}`))
      .some(m => fromTheme.some(row => row.entity_name === legacyEntityName(m.entityName) && row.filename === m.filename));
  }
  if (!pending.content && !pending.entity) return null;
  const names = [...new Set([...(pending.content ? contentThemes : []), ...(pending.entity ? entityThemes : [])])].sort();
  if (names.length === 1) return names[0];
  if (names.includes(ACTIVE_THEME)) return ACTIVE_THEME;
  throw new Error(
    `Migrations are recorded under more than one theme: ${names.join(', ')}. ` +
    `Set NEXT_PUBLIC_ACTIVE_THEME to the theme this project was migrated from (in the environment or the project .env) ` +
    `and run db:migrate again; its migrations that are already applied are then recorded for the project instead of run again. Nothing was run.`
  );
}

// Execute a single content migration
async function executeContentMigration(client, migration) {
  const { sourceType, sourceName, filename, fullPath } = migration;

  // Check if already executed
  const result = await client.query(
    'SELECT * FROM "_content_migrations" WHERE source_type = $1 AND source_name = $2 AND filename = $3',
    [sourceType, sourceName, filename]
  );

  if (result.rows.length > 0) {
    console.log(`  ⏭️  ${filename} (already executed)`);
    return false;
  }

  // Applied before the project left contents/themes: record it under the new key, keep the old row
  const legacy = LEGACY_THEME && legacyKey(migration, LEGACY_THEME);
  if (legacy) {
    const taken = await client.query(
      `INSERT INTO "_content_migrations" (source_type, source_name, filename, executed_at)
       SELECT $1, $2, filename, executed_at FROM "_content_migrations" WHERE source_type = $3 AND source_name = $4 AND filename = $5
       ON CONFLICT DO NOTHING`,
      [sourceType, sourceName, ...legacy, filename]
    );
    if (taken.rowCount > 0) {
      console.log(`  ⏭️  ${filename}: already applied as theme ${LEGACY_THEME}; recorded for the project`);
      return false;
    }
  }

  console.log(`  🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runAndRecordMigration(client, {
    file: filename,
    sql,
    table: '_content_migrations',
    row: { source_type: sourceType, source_name: sourceName, filename },
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
  const result = await client.query(
    'SELECT * FROM "_entity_migrations" WHERE entity_name = $1 AND filename = $2',
    [entityName, filename]
  );

  if (result.rows.length > 0) {
    console.log(`${indent}⏭️  ${filename} (already executed)`);
    return false;
  }

  // An entity slug is a lowercase identifier with hyphens, so a 0.x campaign_members
  // directory became campaign-members: the same entity, recorded under the old name.
  // Only that exact rename counts, not while a directory still has the old name, and only
  // from where this entity lived before: a project entity from the theme it came from,
  // a plugin entity from the same plugin.
  const legacyName = legacyEntityName(entityName);
  const origin = sourceType === 'project' ? LEGACY_THEME && ['theme', LEGACY_THEME]
    : sourceType === 'plugin' ? ['plugin', sourceName] : null;
  if (legacyName && origin) {
    const taken = await client.query(
      `INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename, executed_at)
       SELECT $1, $2, $3, filename, executed_at FROM "_entity_migrations"
       WHERE entity_name = $4 AND filename = $5 AND source_type = $6 AND source_name = $7
       ON CONFLICT DO NOTHING`,
      [entityName, sourceType, sourceName, legacyName, filename, ...origin]
    );
    if (taken.rowCount > 0) {
      console.log(`${indent}⏭️  ${filename}: already applied as entity ${legacyName}; recorded for ${entityName}`);
      return false;
    }
  }

  console.log(`${indent}🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runAndRecordMigration(client, {
    file: filename,
    sql,
    table: '_entity_migrations',
    row: { entity_name: entityName, source_type: sourceType, source_name: sourceName, filename },
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
    console.log("🔄 Running content & entity migrations (sample_data deferred)...\n");
    console.log(`📌 Project: ${PROJECT_NAME}\n`);

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

    // Get active plugins
    const activePlugins = await getActivePlugins();
    console.log(`🔌 Active plugins: ${activePlugins.length > 0 ? activePlugins.join(', ') : 'none'}\n`);
    console.log("📦 Collecting all migrations...\n");

    // =========================================================================
    // PHASE 2A: COLLECT ALL MIGRATIONS (done once, before PHASE 1: see MIGRATIONS)
    // =========================================================================
    const { allContentMigrations, allEntityMigrations } = MIGRATIONS;

    // =========================================================================
    // PHASE 2B: SEPARATE SCHEMA vs SAMPLE_DATA AND SORT GLOBALLY
    // =========================================================================
    // Sort by filename globally to handle inter-entity dependencies
    // e.g., 001_* runs before 010_*, regardless of entity name
    const sortByFilename = (a, b) => a.filename.localeCompare(b.filename);

    const contentSchema = allContentMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const contentSampleData = allContentMigrations.filter(m => m.isSampleData && SAMPLE_DATA.apply).sort(sortByFilename);
    const entitySchema = allEntityMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const entitySampleData = allEntityMigrations.filter(m => m.isSampleData && SAMPLE_DATA.apply).sort(sortByFilename);

    console.log(`📊 Migration breakdown:`);
    console.log(`   - Content schema: ${contentSchema.length}`);
    console.log(`   - Content sample_data: ${contentSampleData.length}`);
    console.log(`   - Entity schema: ${entitySchema.length}`);
    console.log(`   - Entity sample_data: ${entitySampleData.length}`);
    for (const m of [...allContentMigrations, ...allEntityMigrations].filter(m => m.isSampleData && !SAMPLE_DATA.apply)) {
      console.log(`⏭️  Skipping ${m.filename} (sample data, ${m.sourceName})`);
    }
    console.log('');

    let totalContentMigrations = 0;
    let totalEntityMigrations = 0;

    // =========================================================================
    // PHASE 2C: EXECUTE SCHEMA MIGRATIONS FIRST
    // =========================================================================
    console.log("🏗️  STEP 1: Schema migrations (tables, indexes, RLS)\n");

    // Content schema migrations
    if (contentSchema.length > 0) {
      console.log(`🎨 Theme/Plugin schema migrations:`);
      for (const migration of contentSchema) {
        try {
          const executed = await executeContentMigration(client, migration);
          if (executed) totalContentMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      console.log('');
    }

    // Entity schema migrations (grouped by entity for readability)
    if (entitySchema.length > 0) {
      console.log(`🎨 Entity schema migrations:`);
      const entitiesSeen = new Set();
      for (const migration of entitySchema) {
        if (!entitiesSeen.has(migration.entityName)) {
          const entityCount = entitySchema.filter(m => m.entityName === migration.entityName).length;
          console.log(`  📁 ${migration.entityName} (${entityCount} schema migration(s))`);
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
      console.log('');
    }

    // =========================================================================
    // PHASE 2D: EXECUTE SAMPLE_DATA MIGRATIONS LAST
    // =========================================================================
    console.log("🌱 STEP 2: Sample data migrations (INSERT statements)\n");

    // Content sample_data migrations
    if (contentSampleData.length > 0) {
      console.log(`🎨 Theme/Plugin sample_data migrations:`);
      for (const migration of contentSampleData) {
        try {
          const executed = await executeContentMigration(client, migration);
          if (executed) totalContentMigrations++;
        } catch (error) {
          console.error(`  ❌ ${migrationFailure(migration.filename, error)}`);
          throw error;
        }
      }
      console.log('');
    }

    // Entity sample_data migrations
    if (entitySampleData.length > 0) {
      console.log(`🎨 Entity sample_data migrations:`);
      const entitiesSeen = new Set();
      for (const migration of entitySampleData) {
        if (!entitiesSeen.has(migration.entityName)) {
          const entityCount = entitySampleData.filter(m => m.entityName === migration.entityName).length;
          console.log(`  📁 ${migration.entityName} (${entityCount} sample_data migration(s))`);
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
      console.log('');
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
    console.error("❌ Entity migration error:", error.message);
    await client.end();
    process.exit(1);
  }
}

// Main migration runner
async function runAllMigrations() {
  console.log("🚀 Starting migration process...\n");
  console.log(`🌱 ${SAMPLE_DATA.notice}\n`);
  
  // First run core migrations
  console.log("📋 PHASE 1: Core migrations");
  await runMigrations();
  
  console.log("\n📋 PHASE 2: Entity migrations");
  await runEntityMigrations();
  
  console.log("\n🎉 All migrations completed successfully!");
}

let MIGRATIONS;
try {
  MIGRATIONS = collectAllMigrations(projectConfig.plugins);
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
// The theme a 0.x project came from, when it has migrations to take over (set before PHASE 1)
let LEGACY_THEME = null;

// Run all migrations
runAllMigrations();
