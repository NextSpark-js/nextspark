/**
 * Project code that still imports next-themes (#371). Core renders its own theme provider since 0.1.0-beta.200, and
 * the hook of next-themes does not see it. What counts as an import, and which files are looked at, is the installed
 * core's: its code migrations (scripts/maintenance/code-migrations.mjs) export both, so what update-core rewrites is
 * what `nextspark doctor` and `nextspark prepare` report. Read-only.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CODE_MIGRATIONS = join('scripts', 'maintenance', 'code-migrations.mjs')
export const NEXT_THEMES_MIGRATION_COMMAND = 'node node_modules/@nextsparkjs/core/scripts/maintenance/code-migrations.mjs 0.1.0-beta.200'

/**
 * `file:line` of each line of the project at `root` that loads next-themes. Empty when the core in `coreDir` predates
 * its own theme provider (it has no code migrations), where next-themes is still the one to use.
 */
export async function findNextThemesImports(root: string, coreDir: string): Promise<string[]> {
  const module = join(coreDir, CODE_MIGRATIONS)
  if (!existsSync(module)) return []
  const migrations = (await import(pathToFileURL(module).href)) as { findNextThemesImports?: (root: string) => string[] }
  return migrations.findNextThemesImports?.(root) ?? []
}

/** The lines `nextspark prepare`, dev and build print when project code still imports next-themes */
export async function nextThemesImportLines(root: string, coreDir: string): Promise<string[]> {
  const found = await findNextThemesImports(root, coreDir)
  if (found.length === 0) return []
  return [
    `NS_NEXT_THEMES_IMPORT: project code imports next-themes, whose hook does not see the theme provider core renders: ${found.join(', ')}`,
    `  Rewrite the named imports with: ${NEXT_THEMES_MIGRATION_COMMAND}`,
  ]
}
