// Root-first project/template lookup used only by the repository migration-verification harness.
// The migration runner itself always reads the project in its cwd and never selects a theme.

import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist']);

/** Every .sql file inside a `migrations` directory under `dir`, at any depth. */
export function migrationFiles(dir, insideMigrations = false, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      migrationFiles(entryPath, insideMigrations || entry.name === 'migrations', found);
    } else if (insideMigrations && entry.name.endsWith('.sql')) {
      found.push(entryPath);
    }
  }
  return found;
}

function configuredName(projectDir) {
  const config = path.join(projectDir, 'config/theme.config.ts');
  if (!fs.existsSync(config)) return null;
  return fs.readFileSync(config, 'utf8').match(/\bname:\s*['"]([^'"]+)['"]/)?.[1] ?? null;
}

/** Locate apps/dev or one core-owned install-once project template by catalog name. */
export function findTheme(repoRoot, name) {
  const devDir = path.join(repoRoot, 'apps/dev');
  const templateDir = path.join(repoRoot, 'packages/core/templates/projects', name);
  const candidates = [];
  if (configuredName(devDir) === name) candidates.push({ projectDir: devDir, sourceDir: devDir, kind: 'project' });
  if (configuredName(templateDir) === name) candidates.push({ projectDir: templateDir, sourceDir: templateDir, kind: 'template' });

  const shown = dir => path.relative(repoRoot, dir);
  if (candidates.length === 0) return { error: `no root-first project or project template named "${name}"` };
  if (candidates.length > 1) {
    return { error: `"${name}" exists as more than one project source: ${candidates.map(({ sourceDir }) => shown(sourceDir)).join(', ')}` };
  }

  const [found] = candidates;
  const migrations = migrationFiles(found.sourceDir);
  if (migrations.length === 0) return { error: `${found.kind} "${name}" at ${shown(found.sourceDir)} has no migrations to verify` };
  return { ...found, themeDir: found.sourceDir, shownDir: shown(found.sourceDir), migrations };
}
