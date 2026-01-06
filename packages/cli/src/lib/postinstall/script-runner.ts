import { existsSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import type { PostinstallContext } from '../../types/nextspark-package.js'

export async function runCustomScript(
  scriptPath: string,
  installedPath: string,
  context: PostinstallContext
): Promise<void> {
  const fullPath = join(installedPath, scriptPath)

  if (!existsSync(fullPath)) {
    console.log(chalk.yellow(`  Warning: Postinstall script not found: ${scriptPath}`))
    return
  }

  console.log('')
  console.log(chalk.yellow('  Warning: This package wants to run a custom postinstall script:'))
  console.log(chalk.gray(`     ${scriptPath}`))
  console.log('')
  console.log(chalk.gray('  Custom scripts can execute arbitrary code.'))
  console.log(chalk.gray('  Only allow if you trust the package author.'))
  console.log(chalk.gray('  Skipping script execution (manual approval required).'))
  console.log('')

  // In MVP, we skip custom scripts by default for security
  // In future versions, we could add --allow-scripts flag or prompts
}
