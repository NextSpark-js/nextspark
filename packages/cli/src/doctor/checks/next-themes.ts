/**
 * next-themes Imports Check
 *
 * Core renders its own theme provider since 0.1.0-beta.200, and the hook of next-themes does not see it: a project
 * file that reads useTheme from next-themes gets no theme and a setTheme that does nothing (#371).
 */

import type { HealthCheckResult } from '../index.js'
import { getCoreDir } from '../../utils/paths.js'
import { findNextThemesImports, NEXT_THEMES_MIGRATION_COMMAND } from '../../utils/next-themes-imports.js'

export async function checkNextThemesImports(): Promise<HealthCheckResult> {
  const name = 'Theme imports'
  let found: string[]
  try {
    found = await findNextThemesImports(process.cwd(), getCoreDir())
  } catch (error) {
    // Only a notice: a project whose files cannot be looked at is not failing
    return { name, status: 'warn', message: `Could not look for imports of next-themes: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (found.length === 0) return { name, status: 'pass', message: 'No import of next-themes' }
  const shown = found.slice(0, 3).join(', ') + (found.length > 3 ? ` (+${found.length - 3} more)` : '')
  return {
    name,
    status: 'warn',
    code: 'NS_NEXT_THEMES_IMPORT',
    message: `NS_NEXT_THEMES_IMPORT: project code imports next-themes, whose hook does not see the theme provider core renders (${shown})`,
    fix: `Import useTheme and ThemeProvider from '@nextsparkjs/core/providers/theme-provider', or run ${NEXT_THEMES_MIGRATION_COMMAND}`,
  }
}
