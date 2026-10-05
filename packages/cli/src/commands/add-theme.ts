import chalk from '../utils/colors.js'
import type { InstallOptions } from '../types/nextspark-package.js'

const MESSAGE =
  'add:theme is not supported: themes are install-once project templates, extracted from @nextsparkjs/core when the project is created. ' +
  'Select one with create-nextspark-app --theme <starter|blog|crm|productivity> (blog, crm and productivity are experimental).'

export async function addTheme(_packageSpec: string, _options: InstallOptions = {}): Promise<never> {
  throw new Error(MESSAGE)
}

export async function addThemeCommand(_packageSpec: string, _options: Record<string, unknown>): Promise<void> {
  console.error(chalk.red(MESSAGE))
  process.exitCode = 1
}
