import fs from "fs";
import path from "path";
import { migrationTimeLimit, migrationClient, ignoredParametersNotice, runMigrationSql, recordMigration, migrationFailure } from './migration-time-limit.mjs';
import { getConfig } from '../build/registry/config.mjs';

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

async function runMigrations() {
  const client = migrationClient(MIGRATION_URL, TIME_LIMIT);
  
  try {
    await client.connect();
    console.log("✅ Connected to database\n");
    
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
      
      // Read and execute migration
      console.log(`🔄 Running ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await runMigrationSql(client, { sql, limit: TIME_LIMIT, connectionString: MIGRATION_URL });
        
        // Record successful migration
        await recordMigration(client, { file, table: '_migrations', row: { filename: file }, limit: TIME_LIMIT });
        
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

// Run content-level migrations (theme/plugin root-level, not entity-specific)
async function runContentMigrations(client, migrationsPath, sourceType, sourceName) {
  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    return 0;
  }

  let executedCount = 0;

  for (const file of files) {
    // Check if migration has already been executed
    const result = await client.query(
      'SELECT * FROM "_content_migrations" WHERE source_type = $1 AND source_name = $2 AND filename = $3',
      [sourceType, sourceName, file]
    );

    if (result.rows.length > 0) {
      console.log(`  ⏭️  ${file} (already executed)`);
      continue;
    }

    // Read and execute migration
    console.log(`  🔄 ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');

    try {
      await client.query(sql);

      // Record successful migration with source tracking
      await client.query(
        'INSERT INTO "_content_migrations" (source_type, source_name, filename) VALUES ($1, $2, $3)',
        [sourceType, sourceName, file]
      );

      console.log(`  ✅ ${file} executed successfully`);
      executedCount++;
    } catch (error) {
      console.error(`  ❌ Failed to execute ${file}:`, error.message);
      throw error;
    }
  }

  return executedCount;
}

// Helper: Check if a filename is a sample_data migration
function isSampleDataMigration(filename) {
  return filename.toLowerCase().includes('sample_data') || filename.toLowerCase().includes('sample-data');
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
    isSampleData: isSampleDataMigration(file)
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
          isSampleData: isSampleDataMigration(file),
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

  console.log(`  🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runMigrationSql(client, { sql, limit: TIME_LIMIT, connectionString: MIGRATION_URL });
  await recordMigration(client, {
    file: filename,
    table: '_content_migrations',
    row: { source_type: sourceType, source_name: sourceName, filename },
    limit: TIME_LIMIT,
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

  console.log(`${indent}🔄 ${filename}...`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  await runMigrationSql(client, { sql, limit: TIME_LIMIT, connectionString: MIGRATION_URL });
  await recordMigration(client, {
    file: filename,
    table: '_entity_migrations',
    row: { entity_name: entityName, source_type: sourceType, source_name: sourceName, filename },
    limit: TIME_LIMIT,
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

    // =========================================================================
    // PHASE 2A: COLLECT ALL MIGRATIONS
    // =========================================================================
    console.log("📦 Collecting all migrations...\n");

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

    // =========================================================================
    // PHASE 2B: SEPARATE SCHEMA vs SAMPLE_DATA AND SORT GLOBALLY
    // =========================================================================
    // Sort by filename globally to handle inter-entity dependencies
    // e.g., 001_* runs before 010_*, regardless of entity name
    const sortByFilename = (a, b) => a.filename.localeCompare(b.filename);

    const contentSchema = allContentMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const contentSampleData = allContentMigrations.filter(m => m.isSampleData).sort(sortByFilename);
    const entitySchema = allEntityMigrations.filter(m => !m.isSampleData).sort(sortByFilename);
    const entitySampleData = allEntityMigrations.filter(m => m.isSampleData).sort(sortByFilename);

    console.log(`📊 Migration breakdown:`);
    console.log(`   - Content schema: ${contentSchema.length}`);
    console.log(`   - Content sample_data: ${contentSampleData.length}`);
    console.log(`   - Entity schema: ${entitySchema.length}`);
    console.log(`   - Entity sample_data: ${entitySampleData.length}`);
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

// Recursively discover and run migrations from entity directories
async function discoverAndRunMigrations(client, baseDir, sourceType, sourceName, depth = 0) {
  let stats = { entities: 0, migrations: 0 };

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const entityPath = path.join(baseDir, entry.name);
    const entityStats = await processEntityDirectory(client, entityPath, entry.name, sourceType, sourceName, depth);

    stats.entities += entityStats.entities;
    stats.migrations += entityStats.migrations;
  }

  return stats;
}

// Process a single entity directory and its potential children
async function processEntityDirectory(client, entityPath, entityName, sourceType, sourceName, depth) {
  let stats = { entities: 0, migrations: 0 };
  const indent = '  '.repeat(depth + 1);

  // Check if this directory has migrations
  const migrationsPath = path.join(entityPath, 'migrations');
  if (fs.existsSync(migrationsPath)) {
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'));

    if (migrationFiles.length > 0) {
      console.log(`${indent}📁 ${entityName} (${migrationFiles.length} migration(s))`);
      const executed = await runMigrationsFromDir(client, migrationsPath, entityName, sourceType, sourceName, depth + 1);
      stats.entities++;
      stats.migrations += executed;
    }
  }

  // Intelligently detect and process children entities
  const childrenStats = await discoverChildrenEntities(client, entityPath, entityName, sourceType, sourceName, depth);
  stats.entities += childrenStats.entities;
  stats.migrations += childrenStats.migrations;

  return stats;
}

// Intelligent children entity detection
async function discoverChildrenEntities(client, entityPath, parentEntityName, sourceType, sourceName, depth) {
  let stats = { entities: 0, migrations: 0 };
  const indent = '  '.repeat(depth + 1);

  // Check for both 'children' and 'childs' for backward compatibility
  const possibleChildrenDirs = ['children', 'childs'];

  for (const childDirName of possibleChildrenDirs) {
    const childrenDir = path.join(entityPath, childDirName);

    if (fs.existsSync(childrenDir)) {
      console.log(`${indent}🔍 Found ${childDirName} entities in ${parentEntityName}`);

      // Recursively process children entities
      const childStats = await discoverAndRunMigrations(client, childrenDir, sourceType, sourceName, depth + 1);
      stats.entities += childStats.entities;
      stats.migrations += childStats.migrations;

      // Only process the first found children directory to avoid duplicates
      break;
    }
  }

  return stats;
}

// Helper function to run migrations from a specific directory
async function runMigrationsFromDir(client, migrationsPath, entityName, sourceType, sourceName, depth = 0) {
  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    return 0;
  }

  let executedCount = 0;
  const indent = '  '.repeat(depth + 1);

  for (const file of files) {
    // Check if migration has already been executed for this entity
    const result = await client.query(
      'SELECT * FROM "_entity_migrations" WHERE entity_name = $1 AND filename = $2',
      [entityName, file]
    );

    if (result.rows.length > 0) {
      console.log(`${indent}⏭️  ${file} (already executed)`);
      continue;
    }

    // Read and execute migration
    console.log(`${indent}🔄 ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');

    try {
      await client.query(sql);

      // Record successful migration with source tracking
      await client.query(
        'INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename) VALUES ($1, $2, $3, $4)',
        [entityName, sourceType, sourceName, file]
      );

      console.log(`${indent}✅ ${file} executed successfully`);
      executedCount++;
    } catch (error) {
      console.error(`${indent}❌ Failed to execute ${file}:`, error.message);
      throw error;
    }
  }

  return executedCount;
}

// Main migration runner
async function runAllMigrations() {
  console.log("🚀 Starting migration process...\n");
  
  // First run core migrations
  console.log("📋 PHASE 1: Core migrations");
  await runMigrations();
  
  console.log("\n📋 PHASE 2: Entity migrations");
  await runEntityMigrations();
  
  console.log("\n🎉 All migrations completed successfully!");
}

// Run all migrations
runAllMigrations();
