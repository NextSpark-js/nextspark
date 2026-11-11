// The migration files of a project, as the runner (run-migrations.mjs) and `nextspark doctor`
// (check-migration-ledger.mjs) read them: where they live, which are sample data, and the hash of each.

import fs from 'fs';
import path from 'path';
import { isSampleDataMigration } from './sample-data.mjs';
import { compareMigrations } from './migration-order.mjs';
import { migrationHash } from './migration-ledger.mjs';

/** The migrations that ship with core, in run order: `{ filename, hash }`. */
export function collectCoreMigrations(packageRoot) {
  const migrationsDir = path.join(packageRoot, 'migrations');
  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(compareMigrations)
    .map(filename => ({ filename, hash: migrationHash(fs.readFileSync(path.join(migrationsDir, filename), 'utf8')) }));
}

// Helper: Collect all migration files from a directory (theme/plugin level)
function collectContentMigrations(migrationsPath, sourceType, sourceName) {
  if (!fs.existsSync(migrationsPath)) return [];

  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort(compareMigrations);

  return files.map(file => {
    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
    return {
      type: 'content',
      sourceType,
      sourceName,
      filename: file,
      fullPath: path.join(migrationsPath, file),
      isSampleData: isSampleDataMigration(file, sql),
      hash: migrationHash(sql),
    };
  });
}

// `nextspark migrate --rename-entity-slugs` renames an entity directory and writes the old name in
// <entity>/.renamed-from as `old -> new`, so the rows recorded under the old name are taken over (see
// executeEntityMigration). It counts only in the directory it names: a copy of that directory under another
// name, or a directory renamed again, ignores it.
function readRenamedFrom(entityPath, entityName) {
  try {
    const match = /^([a-z][a-z0-9_-]*)\s*->\s*([a-z][a-z0-9_-]*)$/.exec(fs.readFileSync(path.join(entityPath, '.renamed-from'), 'utf8').trim());
    return match && match[2] === entityName && match[1] !== entityName ? match[1] : null;
  } catch {
    return null;
  }
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
    const renamedFrom = readRenamedFrom(entityPath, entityName);

    // Check for migrations in this entity
    const migrationsPath = path.join(entityPath, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort(compareMigrations);

      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        migrations.push({
          type: 'entity',
          sourceType,
          sourceName,
          entityName,
          renamedFrom,
          filename: file,
          fullPath: path.join(migrationsPath, file),
          isSampleData: isSampleDataMigration(file, sql),
          hash: migrationHash(sql),
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

/** Every project and plugin migration, in the order found: `{ allContentMigrations, allEntityMigrations }`. */
export function collectAllMigrations({ projectRoot, projectName, plugins }) {
  const allContentMigrations = [];
  const allEntityMigrations = [];

  const projectMigrationsDir = path.join(projectRoot, 'migrations');
  allContentMigrations.push(...collectContentMigrations(projectMigrationsDir, 'project', projectName));

  // Collect project entity migrations
  const projectEntitiesDir = path.join(projectRoot, 'entities');
  allEntityMigrations.push(...collectEntityMigrations(projectEntitiesDir, 'project', projectName));

  // Collect project settings migrations (settings/<area>/migrations/)
  const projectSettingsDir = path.join(projectRoot, 'settings');
  if (fs.existsSync(projectSettingsDir)) {
    const settingAreas = fs.readdirSync(projectSettingsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
    for (const area of settingAreas) {
      const settingsMigrationsDir = path.join(projectSettingsDir, area, 'migrations');
      allContentMigrations.push(...collectContentMigrations(
        settingsMigrationsDir, 'project-settings', `${projectName}/settings/${area}`
      ));
    }
  }

  // Collect plugin migrations
  const pluginsDir = path.join(projectRoot, 'plugins');
  if (fs.existsSync(pluginsDir) && plugins.length > 0) {
    for (const pluginName of plugins) {
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
