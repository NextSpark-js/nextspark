/**
 * NextSpark ASCII Banner
 *
 * Beautiful ASCII art banner for the CLI wizard.
 */

import chalk from 'chalk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Get CLI version from package.json
 */
function getCliVersion(): string {
  // Try multiple possible paths (bundled in dist/ or running from src/)
  const possiblePaths = [
    join(__dirname, '../package.json'),      // from dist/
    join(__dirname, '../../package.json'),   // from dist/wizard/ or src/wizard/
    join(__dirname, '../../../package.json'), // fallback
  ]

  for (const packageJsonPath of possiblePaths) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (packageJson.name === '@nextsparkjs/cli' && packageJson.version) {
        return packageJson.version
      }
    } catch {
      // Try next path
    }
  }

  return 'unknown'
}

/**
 * NextSpark ASCII logo
 */
const BANNER = `
    _   __          __  _____                  __
   / | / /__  _  __/ /_/ ___/____  ____ ______/ /__
  /  |/ / _ \\| |/_/ __/\\__ \\/ __ \\/ __ \`/ ___/ //_/
 / /|  /  __/>  </ /_ ___/ / /_/ / /_/ / /  / ,<
/_/ |_/\\___/_/|_|\\__//____/ .___/\\__,_/_/  /_/|_|
                         /_/
`

/**
 * Display the welcome banner
 */
export function showBanner(): void {
  const version = getCliVersion()
  console.log(chalk.cyan(BANNER))
  console.log(chalk.bold.white('  Welcome to NextSpark - The Complete SaaS Framework for Next.js'))
  console.log(chalk.gray(`  Version ${version} - Create production-ready SaaS applications in minutes\n`))
  console.log(chalk.gray('  ' + '='.repeat(60) + '\n'))
}

/**
 * Display section header
 */
export function showSection(title: string, step: number, totalSteps: number): void {
  console.log('')
  console.log(chalk.cyan(`  Step ${step}/${totalSteps}: ${title}`))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
}

/**
 * Display success message
 */
export function showSuccess(message: string): void {
  console.log(chalk.green(`  ✓ ${message}`))
}

/**
 * Display warning message
 */
export function showWarning(message: string): void {
  console.log(chalk.yellow(`  ⚠ ${message}`))
}

/**
 * Display error message
 */
export function showError(message: string): void {
  console.log(chalk.red(`  ✗ ${message}`))
}

/**
 * Display info message
 */
export function showInfo(message: string): void {
  console.log(chalk.blue(`  ℹ ${message}`))
}
