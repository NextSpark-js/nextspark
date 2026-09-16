// Where db:verify-theme finds a theme, and the directory run-migrations.mjs has
// to run in to migrate it.
//
// run-migrations.mjs reads the active theme from `<cwd>/contents/themes/<theme>`.
// The monorepo's themes reach it through apps/dev/contents, which links to
// themes/. The starter a generated project ships is not among them: it lives in
// packages/core/templates/contents/themes/starter, and themes/starter holds only
// its tests. packages/core/templates has the same contents/ layout a generated
// project has, so the runner reads the starter from there.

import fs from 'fs';
import path from 'path';

/** The directories the runner can run in, each with its own contents/themes. */
export const THEME_PROJECTS = ['apps/dev', 'packages/core/templates'];

// The runner reads a theme's plugins from one of these; a directory with
// neither is not a theme, and migrating it migrates core alone.
const THEME_CONFIGS = ['config/theme.config.ts', 'theme.config.ts'];

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

/**
 * The theme called `theme`: its directory, the directory to run the runner in,
 * and the migration files it holds. `{ error }` when there is no such theme,
 * when the name is a theme in more than one place, or when it has no
 * migrations, since a run over none of them proves nothing about it.
 */
export function findTheme(repoRoot, theme) {
  const candidates = THEME_PROJECTS.map(project => ({
    projectDir: path.join(repoRoot, project),
    themeDir: path.join(repoRoot, project, 'contents', 'themes', theme),
  }));
  // A theme reached through a link is shown where it really lives: themes/blog, not apps/dev/contents/themes/blog.
  const shown = dir =>
    fs.existsSync(dir) ? path.relative(fs.realpathSync(repoRoot), fs.realpathSync(dir)) : path.relative(repoRoot, dir);
  const found = candidates.filter(({ themeDir }) => THEME_CONFIGS.some(config => fs.existsSync(path.join(themeDir, config))));

  if (found.length === 0) {
    return {
      error: `no theme "${theme}": none of ${candidates.map(({ themeDir }) => shown(themeDir)).join(', ')} has a theme config`,
    };
  }
  if (found.length > 1) {
    return { error: `"${theme}" is a theme in more than one place: ${found.map(({ themeDir }) => shown(themeDir)).join(', ')}` };
  }

  const [{ projectDir, themeDir }] = found;
  const migrations = migrationFiles(themeDir);
  if (migrations.length === 0) {
    return { error: `theme "${theme}" at ${shown(themeDir)} has no migrations to verify` };
  }
  return { projectDir, themeDir, shownDir: shown(themeDir), migrations };
}
