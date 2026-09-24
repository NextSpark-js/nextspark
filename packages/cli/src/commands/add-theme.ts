import chalk from '../utils/colors.js'
import type { InstallOptions } from '../types/nextspark-package.js'

const MESSAGE = 'Themes are install-once project templates. Select starter, blog, crm, or productivity when creating the project.'

export async function addTheme(_packageSpec: string, _options: InstallOptions = {}): Promise<never> {
  throw new Error(MESSAGE)
}

export async function addThemeCommand(_packageSpec: string, _options: Record<string, unknown>): Promise<void> {
  console.error(chalk.red(MESSAGE))
  process.exitCode = 1
}
