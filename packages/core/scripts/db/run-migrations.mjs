import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is where the user runs the command (process.cwd())
// Package root is where @nextsparkjs/core is installed (relative to this script)
const projectRoot = process.cwd();
const packageRoot = path.join(__dirname, '..', '..'); // scripts/db/ -> core/

// Legacy: support old monorepo structure
const isMonorepoMode = fs.existsSync(path.join(projectRoot, 'packages', 'core'));
const rootDir = projectRoot; // For backward compatibility with code below

// Read .env from the project root (where user runs the command)
const envPath = path.join(projectRoot, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let DATABASE_URL = null;
let ACTIVE_THEME = null;

envLines.forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '').trim();

    if (key?.trim() === 'DATABASE_URL' && valueParts.length > 0) {
      DATABASE_URL = value;
    }
    if (key?.trim() === 'NEXT_PUBLIC_ACTIVE_THEME' && valueParts.length > 0) {
      ACTIVE_THEME = value;
    }
  }
});

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

if (!ACTIVE_THEME) {
  console.error("❌ NEXT_PUBLIC_ACTIVE_THEME not found in environment variables");
  process.exit(1);
}

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false,
      require: true
    },
    connectionTimeoutMillis: 10000
  });
  
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
    const migrationsDir = isMonorepoMode
      ? path.join(projectRoot, 'packages', 'core', 'migrations')
      : path.join(packageRoot, 'migrations');
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
        await client.query(sql);
        
        // Record successful migration
        await client.query(
          'INSERT INTO "_migrations" (filename) VALUES ($1)',
          [file]
        );
        
        console.log(`✅ Successfully executed ${file}\n`);
      } catch (error) {
        console.error(`❌ Failed to execute ${file}:`, error.message);
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

// Get active plugins from theme config
async function getActivePlugins() {
  try {
    // Determine contents directory based on mode
    const contentsDir = isMonorepoMode
      ? path.join(projectRoot, 'apps', 'dev', 'contents')
      : path.join(projectRoot, 'contents');

    // Try both locations: config/theme.config.ts (new) and theme.config.ts (legacy)
    let themeConfigPath = path.join(contentsDir, 'themes', ACTIVE_THEME, 'config', 'theme.config.ts');

    if (!fs.existsSync(themeConfigPath)) {
      // Fallback to legacy location
      themeConfigPath = path.join(contentsDir, 'themes', ACTIVE_THEME, 'theme.config.ts');
    }

    if (!fs.existsSync(themeConfigPath)) {
      console.warn(`⚠️  Theme config not found in either config/theme.config.ts or theme.config.ts`);
      return [];
    }

    // Read and parse theme config
    const configContent = fs.readFileSync(themeConfigPath, 'utf8');
    const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]*)\]/);

    if (!pluginsMatch) {
      console.warn(`⚠️  No plugins found in theme config`);
      return [];
    }

    const pluginsStr = pluginsMatch[1];
    const plugins = pluginsStr
      .split(',')
      .map(p => p.trim().replace(/['"`]/g, ''))
      .filter(Boolean);

    return plugins;
  } catch (error) {
    console.error(`❌ Error reading theme config:`, error.message);
    return [];
  }
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

  await client.query(sql);
  await client.query(
    'INSERT INTO "_content_migrations" (source_type, source_name, filename) VALUES ($1, $2, $3)',
    [sourceType, sourceName, filename]
  );

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

  await client.query(sql);
  await client.query(
    'INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename) VALUES ($1, $2, $3, $4)',
    [entityName, sourceType, sourceName, filename]
  );

  console.log(`${indent}✅ ${filename} executed successfully`);
  return true;
}

// Entity migrations runner - WordPress-like architecture with sample_data deferred execution
async function runEntityMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      require: true
    },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("🔄 Running content & entity migrations (sample_data deferred)...\n");
    console.log(`📌 Active theme: ${ACTIVE_THEME}\n`);

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

    // Determine contents directory based on mode
    const contentsDir = isMonorepoMode
      ? path.join(projectRoot, 'apps', 'dev', 'contents')
      : path.join(projectRoot, 'contents');

    // Collect theme-level migrations
    const themeMigrationsDir = path.join(contentsDir, 'themes', ACTIVE_THEME, 'migrations');
    allContentMigrations.push(...collectContentMigrations(themeMigrationsDir, 'theme', ACTIVE_THEME));

    // Collect theme entity migrations
    const themeEntitiesDir = path.join(contentsDir, 'themes', ACTIVE_THEME, 'entities');
    allEntityMigrations.push(...collectEntityMigrations(themeEntitiesDir, 'theme', ACTIVE_THEME));

    // Collect plugin migrations
    const pluginsDir = path.join(contentsDir, 'plugins');
    if (fs.existsSync(pluginsDir) && activePlugins.length > 0) {
      for (const pluginName of activePlugins) {
        const pluginDir = path.join(pluginsDir, pluginName);

        // Plugin-level migrations
        const pluginMigrationsDir = path.join(pluginDir, 'migrations');
        allContentMigrations.push(...collectContentMigrations(pluginMigrationsDir, 'plugin', pluginName));

        // Plugin entity migrations
        const pluginEntitiesDir = path.join(pluginDir, 'entities');
        allEntityMigrations.push(...collectEntityMigrations(pluginEntitiesDir, 'plugin', pluginName));
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
          console.error(`  ❌ Failed to execute ${migration.filename}:`, error.message);
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
          console.error(`  ❌ Failed to execute ${migration.filename}:`, error.message);
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
          console.error(`  ❌ Failed to execute ${migration.filename}:`, error.message);
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
          console.error(`  ❌ Failed to execute ${migration.filename}:`, error.message);
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