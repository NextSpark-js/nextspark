/**
 * next-themes Imports Check
 *
 * Core renders its own theme provider since 0.1.0-beta.200, and the hook of next-themes does not see it: a project
 * file that reads useTheme from next-themes gets no theme and a setTheme that does nothing (#371).
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'
import { sourceFiles } from './query-client.js'

/** An import, re-export, import() or require() of next-themes */
const NEXT_THEMES = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])next-themes\1/

/** `file:line` of each line of a project file of `root` that loads next-themes. */
export async function findNextThemesImports(root: string): Promise<string[]> {
  const found: string[] = []
  for await (const file of sourceFiles(root, root)) {
    const text = await fs.readFile(file, 'utf8')
    if (!text.includes('next-themes')) continue
    text.split('\n').forEach((line, index) => {
      if (NEXT_THEMES.test(line) && !/^\s*(?:\/\/|\*)/.test(line)) found.push(`${path.relative(root, file)}:${index + 1}`)
    })
  }
  return found
}

export async function checkNextThemesImports(): Promise<HealthCheckResult> {
  const name = 'Theme imports'
  const found = await findNextThemesImports(process.cwd())
  if (found.length === 0) return { name, status: 'pass', message: 'No import of next-themes' }
  const shown = found.slice(0, 3).join(', ') + (found.length > 3 ? ` (+${found.length - 3} more)` : '')
  return {
    name,
    status: 'warn',
    code: 'NS_NEXT_THEMES_IMPORT',
    message: `NS_NEXT_THEMES_IMPORT: project code imports next-themes, whose hook does not see the theme provider core renders (${shown})`,
    fix: "Import useTheme and ThemeProvider from '@nextsparkjs/core/providers/theme-provider', or run pnpm update-core, which rewrites the named imports",
  }
}
